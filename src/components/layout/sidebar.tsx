"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  TrendingUp,
  Building2,
  Users,
  Calculator,
  Settings,
  DollarSign,
  PieChart,
  BarChart3,
  Wallet,
  Target,
  GitBranch,
  Briefcase,
  CreditCard,
  Wand2,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  name: string;
  items: NavItem[];
};

type NavEntry = NavItem | NavSection;

function isNavSection(item: NavEntry): item is NavSection {
  return "items" in item;
}

const navigation: NavEntry[] = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Financials",
    items: [
      { name: "P&L Statement", href: "/financials/pnl", icon: FileText },
      { name: "Balance Sheet", href: "/financials/balance-sheet", icon: Wallet },
      { name: "Cash Flow", href: "/financials/cash-flow", icon: TrendingUp },
    ],
  },
  {
    name: "Healthcare",
    items: [
      { name: "Location P&L", href: "/healthcare/locations", icon: Building2 },
      { name: "Payer Mix", href: "/healthcare/payer-mix", icon: PieChart },
      { name: "Contract Analysis", href: "/healthcare/contracts", icon: Briefcase },
    ],
  },
  {
    name: "Planning",
    items: [
      { name: "Budget", href: "/planning/budget", icon: Target },
      { name: "Forecast", href: "/planning/forecast", icon: BarChart3 },
      { name: "Scenarios", href: "/planning/scenarios", icon: GitBranch },
    ],
  },
  {
    name: "Workforce",
    items: [
      { name: "Headcount Plan", href: "/workforce/headcount", icon: Users },
      { name: "Labor Costs", href: "/workforce/labor-cost", icon: DollarSign },
    ],
  },
  {
    name: "Credit Cards",
    items: [
      { name: "Transactions", href: "/credit-cards", icon: CreditCard },
      { name: "Matching Rules", href: "/credit-cards/rules", icon: Wand2 },
    ],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-200 px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">FP&A Dashboard</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            if (isNavSection(item)) {
              // Section with sub-items
              return (
                <li key={item.name} className="pt-4 first:pt-0">
                  <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {item.name}
                  </div>
                  <ul className="space-y-1">
                    {item.items.map((subItem) => {
                      const isActive = pathname === subItem.href;
                      return (
                        <li key={subItem.href}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-zinc-100 text-zinc-900 font-medium"
                                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                            )}
                          >
                            <subItem.icon className="h-4 w-4" />
                            {subItem.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            }

            // Single item
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 p-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <div className="text-xs font-medium text-zinc-900">Sage Intacct</div>
          <div className="mt-1 text-xs text-zinc-500">Connected</div>
        </div>
      </div>
    </aside>
  );
}
