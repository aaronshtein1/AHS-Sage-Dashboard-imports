import 'dotenv/config';
import { PrismaClient, AccountType, NormalBalance, ClosingType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Initialize Prisma with PostgreSQL adapter (same as main app)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// CSV data from the user's file
const csvData = `Account number,Title,Normal balance,Require department,Require location,Period end closing type,Close into account,Disallow direct posting
1001,M&T AHS Operating - 474,Debit,False,False,Non-closing account,,False
1002,M&T AHS Payroll - 482,Debit,False,False,Non-closing account,,False
1003,M&T EC Operating -490,Debit,False,False,Non-closing account,,False
1004,M&T EC Payroll - 714,Debit,False,False,Non-closing account,,False
1005,M&T AHS SSEC Defer - 984,Debit,False,False,Non-closing account,,False
1006,M&T EC SSEC Defer - 802,Debit,False,False,Non-closing account,,False
1007,M&T AHS PPP - 794,Debit,False,False,Non-closing account,,False
1008,Santander AHS Operating - 772,Debit,False,False,Non-closing account,,False
1009,Santander AHS Payroll - 837,Debit,False,False,Non-closing account,,False
1010,Santader EC (...),Debit,False,False,Non-closing account,,False
1011,M&T AHS New Ops - 2305,Debit,False,False,Non-closing account,,False
1012,M&T EC New Ops - 2321,Debit,False,False,Non-closing account,,False
1025,M&T Sweep,Debit,False,False,Non-closing account,,False
1030,Charles Schwab Brokerage,Debit,False,False,Non-closing account,,False
1050,Bill.com Money Out Clearing,Debit,False,False,Non-closing account,,False
1100,Short-Term Securities,Debit,False,False,Non-closing account,,False
1300,Accounts Receivable,Debit,False,False,Non-closing account,,False
1301,AR - Age Well,Debit,False,False,Non-closing account,,False
1302,AR - At Home Solutions,Debit,False,False,Non-closing account,,False
1303,AR - Bikur Cholim Chesed Org,Debit,False,False,Non-closing account,,False
1304,AR - Centers Plan For Healthy Living,Debit,False,False,Non-closing account,,False
1305,AR - Elderplan,Debit,False,False,Non-closing account,,False
1306,AR - Elderplan MJHS,Debit,False,False,Non-closing account,,False
1307,AR - Extended Home Care,Debit,False,False,Non-closing account,,False
1308,AR - Extended MLTC,Debit,False,False,Non-closing account,,False
1309,AR - Fidelis Care at Home,Debit,False,False,Non-closing account,,False
1310,AR - Girling Health Care Inc.,Debit,False,False,Non-closing account,,False
1311,AR - HealthFirst,Debit,False,False,Non-closing account,,False
1312,AR - Private CC,Debit,False,False,Non-closing account,,False
1313,AR - RiverSpring,Debit,False,False,Non-closing account,,False
1314,AR - SWHNY-MLTC,Debit,False,False,Non-closing account,,False
1315,AR - VillageCareMAX,Debit,False,False,Non-closing account,,False
1316,AR - VillageCareMax UAS Nursing,Debit,False,False,Non-closing account,,False
1317,AR - VNSNY Choice,Debit,False,False,Non-closing account,,False
1318,AR - Waiver NHTD,Debit,False,False,Non-closing account,,False
1319,AR - Waiver-TBI,Debit,False,False,Non-closing account,,False
1320,AR - Prime Home Health Services,Debit,False,False,Non-closing account,,False
1321,AR - HealthPlus LLC d/b/a Empire BCBS,Debit,False,False,Non-closing account,,False
1322,AR - MJHS Hospice (CHHA),Debit,False,False,Non-closing account,,False
1323,AR - SWH -UAS Nursing,Debit,False,False,Non-closing account,,False
1324,AR - CL Healthcare CDPAP,Debit,False,False,Non-closing account,,False
1325,AR - Fidelis Care UAS,Debit,False,False,Non-closing account,,False
1326,AR - Americare Certified Special Services,Debit,False,False,Non-closing account,,False
1327,AR - Parker Jewish,Debit,False,False,Non-closing account,,False
1328,AR - Hamaspik,Debit,False,False,Non-closing account,,False
1329,AR - Shining Star Home Care CHHA,Debit,False,False,Non-closing account,,False
1330,AR - CASSENA care at home,Debit,False,False,Non-closing account,,False
1331,AR - Marquis CHHA,Debit,False,False,Non-closing account,,False
1332,AR - Nascentia,Debit,False,False,Non-closing account,,False
1333,AR - PACE CNY,Debit,False,False,Non-closing account,,False
1342,AR - Other UAS,Debit,False,False,Non-closing account,,False
1350,Allowance for Doubtful Accounts,Debit,False,False,Non-closing account,,False
1400,Prepaid Expenses,Debit,False,False,Non-closing account,,False
1401,Prepaid Workers Comp,Debit,False,False,Non-closing account,,False
1410,Prepaid Taxes,Debit,False,False,Non-closing account,,False
1420,Rent Deposit - Rego Park Office,Debit,False,False,Non-closing account,,False
1421,Rent Deposit - Brooklyn Office,Debit,False,False,Non-closing account,,False
1422,Rent Deposit - Queens Office,Debit,False,False,Non-closing account,,False
1423,Rent Deposit - Bronx (was Richmond),Debit,False,False,Non-closing account,,False
1424,Rent Deposit - Albany,Debit,False,False,Non-closing account,,False
1425,Rent Deposit - Buffalo,Debit,False,False,Non-closing account,,False
1426,Rent Deposit - Syracuse,Debit,False,False,Non-closing account,,False
1427,Rent Deposit - Astoria,Debit,False,False,Non-closing account,,False
1428,Rent Deposit - Utica,Debit,False,False,Non-closing account,,False
1450,Office Lease RoU Asset,Debit,False,False,Non-closing account,,False
1451,Car Lease RoU Asset,Debit,False,False,Non-closing account,,False
1452,Car Finance RoU Asset,Debit,False,False,Non-closing account,,False
1470,Office Lease RoU Acc Dep,Debit,False,False,Non-closing account,,False
1471,Car Lease RoU Acc Dep,Debit,False,False,Non-closing account,,False
1472,Car Finance RoU Acc Amort,Debit,False,False,Non-closing account,,False
1500,Computer Equipment,Debit,False,False,Non-closing account,,False
1501,Furniture and Fixtures,Debit,False,False,Non-closing account,,False
1502,Leasehold Improvements,Debit,False,False,Non-closing account,,False
1503,Computer Software,Debit,False,False,Non-closing account,,False
1504,Owned Auto (Mazda),Debit,False,False,Non-closing account,,False
1509,Accumulated Depreciation,Credit,False,False,Non-closing account,,False
1550,Caribou Equity Investment,Debit,False,False,Non-closing account,,False
1600,Due From AHS ElderCare,Debit,False,False,Non-closing account,,False
1601,Due From AHS Caring Astoria,Debit,False,False,Non-closing account,,False
1602,Due From AHS Caring Bronx,Debit,False,False,Non-closing account,,False
1603,Due From AHS Transportation,Debit,False,False,Non-closing account,,False
1650,Loans Receivable:Principal Loans,Debit,False,False,Non-closing account,,False
1651,Loans Receivable:Principal Loans:Olga A.  Loan,Debit,False,False,Non-closing account,,False
1652,Loans Receivable:Principal Loans:Simon A. Loan,Debit,False,False,Non-closing account,,False
1653,Loans Receivable:Principal Loans:Aaron A. Loan,Debit,False,False,Non-closing account,,False
1660,ADP 401a Loan,Debit,False,False,Non-closing account,,False
1797,Overpayment / Refund Receivable,Debit,False,False,Non-closing account,,False
1798,Penalties,Debit,False,False,Non-closing account,,False
1799,Discounts,Debit,False,False,Non-closing account,,False
1900,Accrued Receivable,Debit,False,False,Non-closing account,,False
1901,ERC Refund Receivable,Debit,False,False,Non-closing account,,False
2010,Accounts Payable,Credit,False,False,Non-closing account,,False
2200,Credit Cards Due,Credit,False,False,Non-closing account,,False
2201,Chase CC - 775,Credit,False,False,Non-closing account,,False
2202,Chase CC - 548,Credit,False,False,Non-closing account,,False
2203,Amex CC - 31000,Credit,False,False,Non-closing account,,False
2204,Amex CC - 72009,Credit,False,False,Non-closing account,,False
2205,M&T CC - 282,Credit,False,False,Non-closing account,,False
2206,Chase CC - 827,Credit,False,False,Non-closing account,,False
2207,Amex CC - 72025,Credit,False,False,Non-closing account,,False
2208,Brex CC,Credit,False,False,Non-closing account,,False
2300,Accrued Expenses,Credit,False,False,Non-closing account,,False
2310,WP Supplemental,Credit,False,False,Non-closing account,,False
2311,WP Additional,Credit,False,False,Non-closing account,,False
2312,PTO,Credit,False,False,Non-closing account,,False
2320,Misc Deductions,Credit,False,False,Non-closing account,,False
2325,Outstanding operating and payroll check >3m,Credit,False,False,Non-closing account,,False
2326,NYC Taxes Payable,Credit,False,False,Non-closing account,,False
2401,SSEC Deferral (Field),Credit,False,False,Non-closing account,,False
2402,SSEC Deferral (Office),Credit,False,False,Non-closing account,,False
2501,M&T AHS PPP Forgivable Loan,Credit,False,False,Non-closing account,,False
2502,Settlement Liability,Credit,False,False,Non-closing account,,False
2551,M&T Line of Credit,Credit,False,False,Non-closing account,,False
2600,SBA Loan,Credit,False,False,Non-closing account,,False
2620,Due to AHS CC Bronx,Credit,False,False,Non-closing account,,False
2621,Due to AHS Transportation,Credit,False,False,Non-closing account,,False
2622,Due to At Home Solutions,Credit,False,False,Non-closing account,,False
2630,Office Lease Liability,Credit,False,False,Non-closing account,,False
2631,Car Lease Liability,Credit,False,False,Non-closing account,,False
2632,Car Finance Liability,Credit,False,False,Non-closing account,,False
2650,Office Lease Liability Adjustment,Credit,False,False,Non-closing account,,False
2651,Car Lease Liability Adjustment,Credit,False,False,Non-closing account,,False
2652,Car Finance Liability Adjustment,Credit,False,False,Non-closing account,,False
3001,Additional Paid in Capital,Credit,False,False,Non-closing account,,False
3002,Capital stock,Credit,False,False,Non-closing account,,False
3010,Shareholder Contributions - Olga,Credit,False,False,Non-closing account,,False
3011,Shareholder Contributions - Simon,Credit,False,False,Non-closing account,,False
3020,Shareholder Distributions - Olga,Credit,False,False,Non-closing account,,False
3021,Shareholder Distributions - Simon,Credit,False,False,Non-closing account,,False
3030,Capital Account - Olga,Credit,False,False,Non-closing account,,False
3031,Capital Account - Simon,Credit,False,False,Non-closing account,,False
3090,Retained Earnings,Credit,False,False,Non-closing account,,False
3900,Income Summary,Credit,False,False,Closed-to account,,False
4000,Revenue,Credit,False,False,Closing account,3900,False
4011,Revenue - Age Well,Credit,False,False,Closing account,3900,False
4012,Revenue - At Home Solutions,Credit,False,False,Closing account,3900,False
4013,Revenue - Bikur Cholim Chesed Org,Credit,False,False,Closing account,3900,False
4014,Revenue - Centers Plan For Healthy Living,Credit,False,False,Closing account,3900,False
4015,Revenue - Elderplan,Credit,False,False,Closing account,3900,False
4016,Revenue - Elderplan MJHS,Credit,False,False,Closing account,3900,False
4017,Revenue - Extended Home Care,Credit,False,False,Closing account,3900,False
4018,Revenue - Extended MLTC,Credit,False,False,Closing account,3900,False
4019,Revenue - Fidelis Care at Home,Credit,False,False,Closing account,3900,False
4020,Revenue - Girling Health Care Inc.,Credit,False,False,Closing account,3900,False
4021,Revenue - HealthFirst,Credit,False,False,Closing account,3900,False
4022,Revenue - Private CC,Credit,False,False,Closing account,3900,False
4023,Revenue - RiverSpring,Credit,False,False,Closing account,3900,False
4024,Revenue - SWHNY-MLTC,Credit,False,False,Closing account,3900,False
4025,Revenue - VillageCareMAX,Credit,False,False,Closing account,3900,False
4026,Revenue - VillageCareMax UAS Nursing,Credit,False,False,Closing account,3900,False
4027,Revenue - VNSNY Choice,Credit,False,False,Closing account,3900,False
4028,Revenue - Waiver NHTD,Credit,False,False,Closing account,3900,False
4029,Revenue - Waiver-TBI,Credit,False,False,Closing account,3900,False
4030,Revenue - Prime Home Health Services,Credit,False,False,Closing account,3900,False
4031,Revenue - HealthPlus LLC d/b/a Empire BCBS,Credit,False,False,Closing account,3900,False
4032,Rev - MJHS Hospice (CHHA),Credit,False,False,Closing account,3900,False
4033,Rev - Fidelis Monthly,Credit,False,False,Closing account,3900,False
4034,Revenue - SWH -UAS Nursing,Credit,False,False,Closing account,3900,False
4035,Revenue - CL Healthcare CDPAP,Credit,False,False,Closing account,3900,False
4036,Revenue - Fidelis Care UAS,Credit,False,False,Closing account,3900,False
4037,Revenue - Parker Jewish,Credit,False,False,Closing account,3900,False
4038,Revenue - Hamaspik,Credit,False,False,Closing account,3900,False
4039,Revenue - Americare Certified Special Services,Credit,False,False,Closing account,3900,False
4040,FMAP Grant,Credit,False,False,Closing account,3900,False
4041,Revenue - Shining Star Home Care CHHA,Credit,False,False,Closing account,3900,False
4042,Revenue - Other UAS,Credit,False,False,Closing account,3900,False
4043,Revenue - CASSENA care at home,Credit,False,False,Closing account,3900,False
4044,Revenue - Marquis CHHA,Credit,False,False,Closing account,3900,False
4045,Revenue - Nascentia,Credit,False,False,Closing account,3900,False
4046,Revenue - PACE CNY,Credit,False,False,Closing account,3900,False
4080,Insurance Takeback,Debit,False,False,Closing account,3900,False
5000,Cost of Goods Sold,Debit,False,False,Closing account,3900,False
5001,Payroll Return,Debit,False,False,Closing account,3900,False
5002,Manual Payroll Checks issued by AHS/EC,Debit,False,False,Closing account,3900,False
5100,Field Wages,Debit,False,False,Closing account,3900,False
5101,Outsourced RN Visits (UAS),Debit,False,False,Closing account,3900,False
5102,1099 RN Visits (UAS),Debit,False,False,Closing account,3900,False
5140,Social Security - Field,Debit,False,False,Closing account,3900,False
5141,Fed Unemployment - Field,Debit,False,False,Closing account,3900,False
5142,Medicare Comp - Field,Debit,False,False,Closing account,3900,False
5143,MCTMT (Transit Tax) - Field,Debit,False,False,Closing account,3900,False
5144,NYS-Unemployment - Field,Debit,False,False,Closing account,3900,False
5149,ADP Tax Adjustment,Debit,False,False,Closing account,3900,False
5150,401-K Employee Contribution - Field,Debit,False,False,Closing account,3900,False
5151,Aflac Accident - Field,Debit,False,False,Closing account,3900,False
5152,Metlife Dental&Vision - Field,Debit,False,False,Closing account,3900,False
5153,Medical - Field,Debit,False,False,Closing account,3900,False
5154,Reimb - Field,Debit,False,False,Closing account,3900,False
5155,NYS DBL/ PAID Family Leave - Field,Debit,False,False,Closing account,3900,False
5170,WP Supplemental - Field Exp,Debit,False,False,Closing account,3900,False
5171,WP Additional - Field Exp,Debit,False,False,Closing account,3900,False
5172,PTO - Field,Debit,False,False,Closing account,3900,False
5173,Workers Comp,Debit,False,False,Closing account,3900,False
5174,WP Additional - 401k - Field Exp,Debit,False,False,Closing account,3900,False
5180,Screenings/Verifications/Background Checks,Debit,False,False,Closing account,3900,False
5181,Payroll Processing - Field,Debit,False,False,Closing account,3900,False
5182,Medical/Drug Screening,Debit,False,False,Closing account,3900,False
6100,Gross Office Payroll,Debit,False,False,Closing account,3900,False
6101,Finance,Debit,False,False,Closing account,3900,False
6102,Coordination,Debit,False,False,Closing account,3900,False
6103,Human Resources,Debit,False,False,Closing account,3900,False
6104,Nursing,Debit,False,False,Closing account,3900,False
6105,Marketing,Debit,False,False,Closing account,3900,False
6106,Intake,Debit,False,False,Closing account,3900,False
6107,ElderCare,Debit,False,False,Closing account,3900,False
6108,Bronx Office,Debit,False,False,Closing account,3900,False
6109,Employee Bonuses - Office,Debit,False,False,Closing account,3900,False
6130,401-K Employee Contribution - Office,Debit,False,False,Closing account,3900,False
6131,Misc Deductions - Office,Debit,False,False,Closing account,3900,False
6132,Health Insurance Deduction - Office,Debit,False,False,Closing account,3900,False
6133,Reimb Deduction - Office,Debit,False,False,Closing account,3900,False
6134,Transit Deduction - Office,Debit,False,False,Closing account,3900,False
6140,Social Security - Office,Debit,False,False,Closing account,3900,False
6141,Medicare - Office,Debit,False,False,Closing account,3900,False
6142,Fed Unemployment - Office,Debit,False,False,Closing account,3900,False
6143,NYS Unemployment - Office,Debit,False,False,Closing account,3900,False
6144,NYS Income Taxes - Office,Debit,False,False,Closing account,3900,False
6145,MCTMT (Transit Tax) - Office,Debit,False,False,Closing account,3900,False
6146,NYS DBL & PFL - Office,Debit,False,False,Closing account,3900,False
6160,Payroll Processing - Office,Debit,False,False,Closing account,3900,False
6170,Health Insurance - Office,Debit,False,False,Closing account,3900,False
6171,Health Insurance - Dental & Optical - Office,Debit,False,False,Closing account,3900,False
6172,Supplemental - Office,Debit,False,False,Closing account,3900,False
6209,Rent - Utica,Debit,False,False,Closing account,3900,False
6210,Rent - Richmond Hill,Debit,False,False,Closing account,3900,False
6211,Rent - Brooklyn,Debit,False,False,Closing account,3900,False
6212,Rent - Bronx,Debit,False,False,Closing account,3900,False
6213,Rent - Floating,Debit,False,False,Closing account,3900,False
6214,Rent - HR Rego Park,Debit,False,False,Closing account,3900,False
6215,Rent - Main Rego Park,Debit,False,False,Closing account,3900,False
6216,Rent - Albany,Debit,False,False,Closing account,3900,False
6217,Rent - Buffalo,Debit,False,False,Closing account,3900,False
6218,Rent - Syracuse,Debit,False,False,Closing account,3900,False
6219,Rent - Astoria,Debit,False,False,Closing account,3900,False
6220,Water/Water Boy,Debit,False,False,Closing account,3900,False
6221,Meals - Office,Debit,False,False,Closing account,3900,False
6222,Electric & Natural Gas,Debit,False,False,Closing account,3900,False
6223,Copier Lease,Debit,False,False,Closing account,3900,False
6224,Security Systems,Debit,False,False,Closing account,3900,False
6225,Waste Removal,Debit,False,False,Closing account,3900,False
6226,Pest Control,Debit,False,False,Closing account,3900,False
6230,Cleaning - Richmond Hill,Debit,False,False,Closing account,3900,False
6231,Cleaning - Brooklyn,Debit,False,False,Closing account,3900,False
6232,Cleaning - Bronx,Debit,False,False,Closing account,3900,False
6233,Cleaning - Rego Park,Debit,False,False,Closing account,3900,False
6234,Sanitation Ticket,Debit,False,False,Closing account,3900,False
6235,Office Expense,Debit,False,False,Closing account,3900,False
6236,Office Misc.,Debit,False,False,Closing account,3900,False
6237,Storage Rental,Debit,False,False,Closing account,3900,False
6238,Shredding,Debit,False,False,Closing account,3900,False
6239,Mover/Transport,Debit,False,False,Closing account,3900,False
6240,Printing & Reproduction,Debit,False,False,Closing account,3900,False
6241,Repairs - Equipment,Debit,False,False,Closing account,3900,False
6242,Repairs - Building,Debit,False,False,Closing account,3900,False
6243,Repairs - Computer,Debit,False,False,Closing account,3900,False
6244,Meals and Entertainment,Debit,False,False,Closing account,3900,False
6245,Office Supplies,Debit,False,False,Closing account,3900,False
6246,Postage/Courier,Debit,False,False,Closing account,3900,False
6310,Legal Fees,Debit,False,False,Closing account,3900,False
6311,Accounting Fees,Debit,False,False,Closing account,3900,False
6313,Clinical Consulting Fees,Debit,False,False,Closing account,3900,False
6314,Financial Consulting Fees,Debit,False,False,Closing account,3900,False
6316,Medicaid/Medicare Consulting,Debit,False,False,Closing account,3900,False
6317,Training/Education,Debit,False,False,Closing account,3900,False
6330,Web/Hosting Services,Debit,False,False,Closing account,3900,False
6331,Software Consulting,Debit,False,False,Closing account,3900,False
6332,Software,Debit,False,False,Closing account,3900,False
6333,IT Management/Solutions,Debit,False,False,Closing account,3900,False
6334,Hardware,Debit,False,False,Closing account,3900,False
6335,CC Processing Fees,Debit,False,False,Closing account,3900,False
6340,Mobile/Cell,Debit,False,False,Closing account,3900,False
6341,Answering Services,Debit,False,False,Closing account,3900,False
6342,VOIP Services,Debit,False,False,Closing account,3900,False
6343,Internet/Cable,Debit,False,False,Closing account,3900,False
6350,Recruitment/Head Hunter,Debit,False,False,Closing account,3900,False
6351,Recruiting Advertising,Debit,False,False,Closing account,3900,False
6352,Recruiting Events,Debit,False,False,Closing account,3900,False
6353,Fingerprint,Debit,False,False,Closing account,3900,False
6360,Advertising,Debit,False,False,Closing account,3900,False
6361,Marketing Campaign - Internet,Debit,False,False,Closing account,3900,False
6362,Client Gifts,Debit,False,False,Closing account,3900,False
6363,Outside Bus. Development,Debit,False,False,Closing account,3900,False
6370,Disability Insurance,Debit,False,False,Closing account,3900,False
6371,General/Professional Liability Insurance,Debit,False,False,Closing account,3900,False
6410,Simon Lease Expense (ROU Asset Amortization),Debit,False,False,Closing account,3900,False
6411,Olga Lease (Lex),Debit,False,False,Closing account,3900,False
6412,Volvo Lease,Debit,False,False,Closing account,3900,False
6413,Mazda Lease,Debit,False,False,Closing account,3900,False
6415,Finance Lease Interest Expense,Debit,False,False,Closing account,3900,False
6420,Car Insurance,Debit,False,False,Closing account,3900,False
6421,Uber/Taxi,Debit,False,False,Closing account,3900,False
6422,Gasoline,Debit,False,False,Closing account,3900,False
6423,Tolls,Debit,False,False,Closing account,3900,False
6424,Parking Tickets,Debit,False,False,Closing account,3900,False
6425,Parking Fees,Debit,False,False,Closing account,3900,False
6426,Car Maintenance,Debit,False,False,Closing account,3900,False
6427,Train Transportation,Debit,False,False,Closing account,3900,False
6450,Subscriptions,Debit,False,False,Closing account,3900,False
6451,Accreditations,Debit,False,False,Closing account,3900,False
6452,Conference,Debit,False,False,Closing account,3900,False
6460,Medical Supplies/Uniforms,Debit,False,False,Closing account,3900,False
6480,Other Operating Expenses,Debit,False,False,Closing account,3900,False
6500,Depreciation Expense,Debit,False,False,Closing account,3900,False
6510,Donations,Debit,False,False,Closing account,3900,False
6520,Bad Debt Expense,Debit,False,False,Closing account,3900,False
6521,Line of Credit Interest,Debit,False,False,Closing account,3900,False
6522,Credit Card Interest,Debit,False,False,Closing account,3900,False
6523,Finance Charge & Bank Service Charges,Debit,False,False,Closing account,3900,False
6524,Bank Late Fee,Debit,False,False,Closing account,3900,False
6525,NYC Corp. Tax,Debit,False,False,Closing account,3900,False
6526,NYS Income Tax,Debit,False,False,Closing account,3900,False
6527,Other Taxes,Debit,False,False,Closing account,3900,False
6528,NY State LLC Filing Fee,Debit,False,False,Closing account,3900,False
6529,NYC UB Taxes,Debit,False,False,Closing account,3900,False
6530,Travel,Debit,False,False,Closing account,3900,False
6531,Guaranteed Payment - Simon,Debit,False,False,Closing account,3900,False
6532,Guaranteed Payment - Olga,Debit,False,False,Closing account,3900,False
6535,SBA Loan Interest,Debit,False,False,Closing account,3900,False
7000,Non Operating Income,Credit,False,False,Closing account,3900,False
7001,M&T Sweep Interest Income,Credit,False,False,Closing account,3900,False
7002,Interest Income,Credit,False,False,Closing account,3900,False
7003,Dividends Non-Qualified,Credit,False,False,Closing account,3900,False
7004,Dividends Qualified,Credit,False,False,Closing account,3900,False
7005,Interest Income - Payor,Credit,False,False,Closing account,3900,False
7020,Long-Term Capital Gain,Credit,False,False,Closing account,3900,False
7030,Other Income,Credit,False,False,Closing account,3900,False
8010,Other Expenses,Debit,False,False,Closing account,3900,False
8011,Petty Cash,Debit,False,False,Closing account,3900,False
8012,FMAP Grant - Expenses,Debit,False,False,Closing account,3900,False
8013,Settlement Expense,Debit,False,False,Closing account,3900,False
8020,Reconciling Discrepancies,Debit,False,False,Closing account,3900,False
8021,Ask my accountant,Debit,False,False,Closing account,3900,False`;

// Determine account type based on account code
function getAccountType(accountCode: string): AccountType {
  const code = parseInt(accountCode);
  if (code >= 1000 && code < 2000) return AccountType.ASSET;
  if (code >= 2000 && code < 3000) return AccountType.LIABILITY;
  if (code >= 3000 && code < 4000) return AccountType.EQUITY;
  if (code >= 4000 && code < 5000) return AccountType.REVENUE;
  if (code >= 5000 && code < 8000) return AccountType.EXPENSE;
  if (code >= 7000 && code < 8000) return AccountType.REVENUE; // Other income
  if (code >= 8000) return AccountType.EXPENSE;
  return AccountType.ASSET;
}

// Map closing type from CSV to enum
function getClosingType(closingTypeStr: string): ClosingType {
  const normalized = closingTypeStr.toLowerCase().trim();
  if (normalized === 'closing account') return ClosingType.CLOSING;
  if (normalized === 'closed-to account') return ClosingType.CLOSED_TO;
  return ClosingType.NON_CLOSING;
}

// Map normal balance from CSV to enum
function getNormalBalance(balanceStr: string): NormalBalance {
  return balanceStr.toLowerCase().trim() === 'credit' ? NormalBalance.CREDIT : NormalBalance.DEBIT;
}

// Parse boolean from CSV
function parseBoolean(str: string): boolean {
  return str.toLowerCase().trim() === 'true';
}

interface ParsedAccount {
  accountCode: string;
  title: string;
  normalBalance: NormalBalance;
  requireDepartment: boolean;
  requireLocation: boolean;
  closingType: ClosingType;
  closeIntoAccountCode: string | null;
  disallowDirectPosting: boolean;
  accountType: AccountType;
}

async function main() {
  // Get the org ID from the first org in the database
  const org = await prisma.org.findFirst();
  if (!org) {
    console.error('No organization found. Please create an organization first.');
    process.exit(1);
  }
  const orgId = org.id;
  console.log(`Importing accounts for org: ${org.name} (${orgId})`);

  // Delete existing accounts for this org
  console.log('Deleting existing accounts...');
  await prisma.account.deleteMany({ where: { orgId } });

  // Parse CSV
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  const accounts: ParsedAccount[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV fields that might contain commas in quotes
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const accountCode = values[0];
    const title = values[1];
    const normalBalance = getNormalBalance(values[2]);
    const requireDepartment = parseBoolean(values[3]);
    const requireLocation = parseBoolean(values[4]);
    const closingType = getClosingType(values[5]);
    const closeIntoAccountCode = values[6] || null;
    const disallowDirectPosting = parseBoolean(values[7]);
    const accountType = getAccountType(accountCode);

    accounts.push({
      accountCode,
      title,
      normalBalance,
      requireDepartment,
      requireLocation,
      closingType,
      closeIntoAccountCode,
      disallowDirectPosting,
      accountType,
    });
  }

  console.log(`Parsed ${accounts.length} accounts from CSV`);

  // First pass: Create all accounts without closeIntoAccountId
  console.log('Creating accounts (first pass)...');
  const accountCodeToId: Record<string, string> = {};

  for (const account of accounts) {
    const created = await prisma.account.create({
      data: {
        orgId,
        accountCode: account.accountCode,
        title: account.title,
        normalBalance: account.normalBalance,
        accountType: account.accountType,
        closingType: account.closingType,
        requireDepartment: account.requireDepartment,
        requireLocation: account.requireLocation,
        disallowDirectPosting: account.disallowDirectPosting,
        // Mark bank accounts based on account codes 1001-1030
        isBankAccount: parseInt(account.accountCode) >= 1001 && parseInt(account.accountCode) <= 1030,
      },
    });
    accountCodeToId[account.accountCode] = created.id;
  }

  // Second pass: Update closeIntoAccountId references
  console.log('Updating closeIntoAccountId references (second pass)...');
  for (const account of accounts) {
    if (account.closeIntoAccountCode && accountCodeToId[account.closeIntoAccountCode]) {
      await prisma.account.update({
        where: {
          orgId_accountCode: {
            orgId,
            accountCode: account.accountCode,
          }
        },
        data: {
          closeIntoAccountId: accountCodeToId[account.closeIntoAccountCode],
        },
      });
    }
  }

  console.log(`Successfully imported ${accounts.length} accounts!`);

  // Print summary
  const summary = await prisma.account.groupBy({
    by: ['accountType'],
    where: { orgId },
    _count: true,
  });

  console.log('\nAccount summary by type:');
  for (const item of summary) {
    console.log(`  ${item.accountType}: ${item._count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
