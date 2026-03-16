import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  LinkTokenCreateRequest,
  ItemPublicTokenExchangeRequest,
  AccountsGetRequest,
  TransactionsSyncRequest,
} from 'plaid';
import { PrismaService } from '../../common/prisma.service';
import { ExchangeTokenDto, SyncTransactionsDto } from './dto';

@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private readonly plaidClient: PlaidApi;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[this.configService.get('PLAID_ENV') || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.configService.get('PLAID_CLIENT_ID'),
          'PLAID-SECRET': this.configService.get('PLAID_SECRET'),
        },
      },
    });

    this.plaidClient = new PlaidApi(configuration);
  }

  async createLinkToken(userId: string, orgId: string) {
    try {
      const request: LinkTokenCreateRequest = {
        user: {
          client_user_id: userId,
        },
        client_name: 'OpenLedger',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
      };

      const response = await this.plaidClient.linkTokenCreate(request);

      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      this.logger.error('Failed to create link token', error);
      throw new BadRequestException('Failed to create Plaid link token');
    }
  }

  async exchangePublicToken(dto: ExchangeTokenDto, orgId: string) {
    try {
      const request: ItemPublicTokenExchangeRequest = {
        public_token: dto.publicToken,
      };

      const tokenResponse = await this.plaidClient.itemPublicTokenExchange(request);
      const accessToken = tokenResponse.data.access_token;
      const itemId = tokenResponse.data.item_id;

      // Get institution info
      const itemRequest = { access_token: accessToken };
      const itemResponse = await this.plaidClient.itemGet(itemRequest);
      const institutionId = itemResponse.data.item.institution_id;

      let institutionName = 'Unknown';
      if (institutionId) {
        const institutionRequest = {
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        };
        const institutionResponse = await this.plaidClient.institutionsGetById(institutionRequest);
        institutionName = institutionResponse.data.institution.name;
      }

      // Store PlaidItem
      const plaidItem = await this.prisma.plaidItem.upsert({
        where: {
          orgId_plaidItemId: {
            orgId,
            plaidItemId: itemId,
          },
        },
        create: {
          orgId,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          plaidInstitutionId: institutionId || '',
          plaidInstitutionName: institutionName,
          status: 'active',
        },
        update: {
          plaidAccessToken: accessToken,
          status: 'active',
        },
      });

      // Fetch and store accounts
      const accountsRequest: AccountsGetRequest = {
        access_token: accessToken,
      };
      const accountsResponse = await this.plaidClient.accountsGet(accountsRequest);

      const accounts = await Promise.all(
        accountsResponse.data.accounts.map(async (account) => {
          return this.prisma.plaidAccount.upsert({
            where: {
              plaidItemId_plaidAccountId: {
                plaidItemId: plaidItem.id,
                plaidAccountId: account.account_id,
              },
            },
            create: {
              plaidItemId: plaidItem.id,
              plaidAccountId: account.account_id,
              name: account.name,
              officialName: account.official_name || null,
              type: account.type,
              subtype: account.subtype || null,
              mask: account.mask || null,
              currentBalance: account.balances.current || null,
              availableBalance: account.balances.available || null,
              isoCurrencyCode: account.balances.iso_currency_code || null,
            },
            update: {
              name: account.name,
              officialName: account.official_name || null,
              currentBalance: account.balances.current || null,
              availableBalance: account.balances.available || null,
            },
          });
        }),
      );

      return {
        plaidItem,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to exchange public token', error);
      throw new BadRequestException('Failed to exchange Plaid public token');
    }
  }

  async getAccounts(orgId: string) {
    const plaidItems = await this.prisma.plaidItem.findMany({
      where: { orgId },
      include: {
        accounts: true,
      },
    });

    return plaidItems;
  }

  async disconnectAccount(plaidItemId: string, orgId: string) {
    try {
      // Find the plaid item
      const plaidItem = await this.prisma.plaidItem.findFirst({
        where: { id: plaidItemId, orgId },
      });

      if (!plaidItem) {
        throw new BadRequestException('Plaid account not found');
      }

      // Remove the item from Plaid
      try {
        await this.plaidClient.itemRemove({
          access_token: plaidItem.plaidAccessToken,
        });
      } catch (error) {
        this.logger.warn('Failed to remove item from Plaid API (may already be removed)', error);
      }

      // Delete associated transactions first (due to foreign key constraints)
      await this.prisma.sourceTransaction.deleteMany({
        where: {
          orgId,
          plaidAccount: {
            plaidItemId: plaidItem.id,
          },
        },
      });

      // Delete the plaid item (this will cascade delete plaid accounts)
      await this.prisma.plaidItem.delete({
        where: { id: plaidItemId },
      });

      return { success: true, message: 'Account disconnected successfully' };
    } catch (error) {
      this.logger.error('Failed to disconnect account', error);
      throw new BadRequestException('Failed to disconnect account');
    }
  }

  async syncTransactions(orgId: string, dto?: SyncTransactionsDto) {
    try {
      let plaidItems = await this.prisma.plaidItem.findMany({
        where: {
          orgId,
          ...(dto?.plaidItemId && { id: dto.plaidItemId }),
        },
        include: {
          accounts: true,
        },
      });

      this.logger.log(`Found ${plaidItems.length} Plaid items to sync for org ${orgId}`);

      const syncResults: {
        plaidItemId: string;
        institutionName: string;
        added: number;
        modified: number;
        removed: number;
        hasMore: boolean;
      }[] = [];

      for (const plaidItem of plaidItems) {
        this.logger.log(`Syncing transactions for ${plaidItem.plaidInstitutionName} (${plaidItem.accounts.length} accounts)`);

        let hasMore = true;
        let cursor: string | undefined = undefined;
        let totalAdded: any[] = [];
        let totalModified: any[] = [];
        let totalRemoved: any[] = [];

        // Loop to get all transactions (Plaid returns paginated results)
        while (hasMore) {
          const request: TransactionsSyncRequest = {
            access_token: plaidItem.plaidAccessToken,
            ...(cursor && { cursor }),
          };

          this.logger.log(`Calling transactionsSync with cursor: ${cursor || 'initial'}`);
          const response = await this.plaidClient.transactionsSync(request);
          this.logger.log(`Received ${response.data.added.length} added, ${response.data.modified.length} modified, ${response.data.removed.length} removed transactions`);

          cursor = response.data.next_cursor;
          hasMore = response.data.has_more;

          totalAdded = [...totalAdded, ...response.data.added];
          totalModified = [...totalModified, ...response.data.modified];
          totalRemoved = [...totalRemoved, ...response.data.removed];
        }

        const added = totalAdded;
        const modified = totalModified;
        const removed = totalRemoved;

        // Process added transactions
        for (const transaction of added) {
          const plaidAccount = plaidItem.accounts.find(
            (acc) => acc.plaidAccountId === transaction.account_id,
          );

          if (!plaidAccount) continue;

          await this.prisma.sourceTransaction.upsert({
            where: {
              orgId_plaidTransactionId: {
                orgId,
                plaidTransactionId: transaction.transaction_id,
              },
            },
            create: {
              orgId,
              plaidAccountId: plaidAccount.id,
              plaidTransactionId: transaction.transaction_id,
              amount: transaction.amount,
              date: new Date(transaction.date),
              name: transaction.name,
              merchantName: transaction.merchant_name || null,
              pending: transaction.pending,
              category: JSON.stringify(transaction.category),
              paymentChannel: transaction.payment_channel || null,
            },
            update: {
              amount: transaction.amount,
              name: transaction.name,
              merchantName: transaction.merchant_name || null,
              pending: transaction.pending,
              category: JSON.stringify(transaction.category),
              paymentChannel: transaction.payment_channel || null,
            },
          });
        }

        // Process modified transactions
        for (const transaction of modified) {
          const plaidAccount = plaidItem.accounts.find(
            (acc) => acc.plaidAccountId === transaction.account_id,
          );

          if (!plaidAccount) continue;

          await this.prisma.sourceTransaction.updateMany({
            where: {
              orgId,
              plaidTransactionId: transaction.transaction_id,
            },
            data: {
              amount: transaction.amount,
              name: transaction.name,
              merchantName: transaction.merchant_name || null,
              pending: transaction.pending,
              category: JSON.stringify(transaction.category),
              paymentChannel: transaction.payment_channel || null,
            },
          });
        }

        // Process removed transactions
        for (const transaction of removed) {
          await this.prisma.sourceTransaction.deleteMany({
            where: {
              orgId,
              plaidTransactionId: transaction.transaction_id,
            },
          });
        }

        // Update last synced timestamp
        await this.prisma.plaidItem.update({
          where: { id: plaidItem.id },
          data: { lastSyncedAt: new Date() },
        });

        syncResults.push({
          plaidItemId: plaidItem.id,
          institutionName: plaidItem.plaidInstitutionName,
          added: added.length,
          modified: modified.length,
          removed: removed.length,
          hasMore: false, // We've fetched all pages
        });
      }

      return {
        results: syncResults,
        syncedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to sync transactions', error);
      throw new BadRequestException('Failed to sync Plaid transactions');
    }
  }
}
