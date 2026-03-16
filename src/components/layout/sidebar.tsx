'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  PencilRuler,
  FileText,
  Landmark,
  GitCompare,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
  Users,
  Receipt,
  CreditCard,
  Wallet,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import type { LucideIcon } from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { name: 'Chart of Accounts', href: '/accounts', icon: BookOpen },
      { name: 'Dimensions', href: '/dimensions', icon: PencilRuler },
      { name: 'Journal Entries', href: '/journals', icon: FileText },
    ],
  },
  {
    title: 'Payables',
    items: [
      { name: 'Vendors', href: '/ap/vendors', icon: Building2 },
      { name: 'Bills', href: '/ap/bills', icon: Receipt },
    ],
  },
  {
    title: 'Receivables',
    items: [
      { name: 'Customers', href: '/ar/customers', icon: Users },
      { name: 'Invoices', href: '/ar/invoices', icon: FileText },
    ],
  },
  {
    title: 'Banking',
    items: [
      { name: 'Bank Feeds', href: '/bank-feeds', icon: Landmark },
      { name: 'Reconciliation', href: '/reconciliation', icon: GitCompare },
    ],
  },
  {
    title: 'Reports',
    items: [
      { name: 'Financial Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, currentOrgId } = useAuth();

  const currentOrg = user?.orgs.find((org) => org.id === currentOrgId);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-200 px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">OpenLedger</span>
        </Link>
      </div>

      {/* Organization Selector */}
      {currentOrg && (
        <div className="border-b border-zinc-200 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-left hover:bg-zinc-100 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 flex-shrink-0 text-zinc-600" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {currentOrg.name}
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">
                      {currentOrg.role}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-zinc-400" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {user?.orgs.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => {
                    if (org.id !== currentOrgId) {
                      window.location.href = '/select-org';
                    }
                  }}
                  className={org.id === currentOrgId ? 'bg-zinc-50' : ''}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-xs text-zinc-500 capitalize">{org.role}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* User Section */}
      {user && (
        <div className="border-t border-zinc-200 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-50 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-medium text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem disabled>
                <span className="text-xs text-zinc-500">Signed in as</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <span className="font-medium">{user.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}
