"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useDashboardFilters, type TabKey } from "@/lib/use-dashboard-filters";
import { useLogout } from "./logout-button";

type IconName = "overview" | "sales" | "ops" | "membership" | "marketing" | "users" | "logout" | "chevron";

const NAV_ITEMS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "sales", label: "Sales", icon: "sales" },
  { key: "ops", label: "Operasional", icon: "ops" },
  { key: "membership", label: "Membership", icon: "membership" },
  { key: "marketing", label: "Marketing", icon: "marketing" },
];

const ADMIN_HREF = "/dashboard/admin/users";

export function Sidebar({
  open,
  onNavigate,
  isAdmin,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onNavigate: () => void;
  isAdmin: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { tab } = useDashboardFilters();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  // Nav items always target /dashboard?tab=X explicitly (not setTab's
  // pathname-relative replace) so this still works correctly from a
  // sub-route like /dashboard/admin/users, not just from /dashboard itself.
  const onDashboardRoot = pathname === "/dashboard";
  const onAdmin = pathname.startsWith(ADMIN_HREF);

  function go(href: string) {
    router.push(href);
    onNavigate();
  }

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 bottom-0 z-20 w-[240px] flex flex-col bg-surface border-r border-border py-5 transition-[transform,width] duration-200 ease-in-out lg:translate-x-0",
        collapsed ? "lg:w-[72px] lg:px-3" : "px-3",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
        aria-label={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
        className="hidden lg:flex absolute -right-3 top-8 w-6 h-6 items-center justify-center rounded-full bg-surface border border-border text-text-secondary shadow-[var(--shadow-popover)] hover:text-accent cursor-pointer"
      >
        <Icon name="chevron" className={cn("w-3.5 h-3.5 transition-transform", collapsed && "rotate-180")} />
      </button>

      <div className={cn("flex items-center gap-2.5 px-1.5 mb-7", collapsed && "lg:justify-center lg:px-0")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset from public/, no next/image usage elsewhere in the app */}
        <img src="/isd-logo.png" alt="ESB Analytics" className="w-9 h-9 shrink-0 object-contain" />
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <div className="text-[15px] font-bold text-text leading-tight truncate">ESB Analytics</div>
          <div className="text-xs text-text-tertiary leading-tight">Sales Dashboard</div>
        </div>
      </div>

      <SectionLabel collapsed={collapsed}>Dashboard</SectionLabel>
      <nav className="flex flex-col gap-1 mb-5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            active={onDashboardRoot && tab === item.key}
            onClick={() => go(`/dashboard?tab=${item.key}`)}
          />
        ))}
      </nav>

      {isAdmin && (
        <>
          <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
          <nav className="flex flex-col gap-1">
            <NavItem label="Kelola User" icon="users" collapsed={collapsed} active={onAdmin} onClick={() => go(ADMIN_HREF)} />
          </nav>
        </>
      )}

      <div className="mt-auto pt-4 border-t border-border">
        <NavItem label="Keluar" icon="logout" collapsed={collapsed} onClick={logout} />
      </div>
    </aside>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className={cn("px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary", collapsed && "lg:hidden")}>
        {children}
      </div>
      {collapsed && <div className="hidden lg:block mx-auto w-6 h-px bg-border mb-3" />}
    </>
  );
}

function NavItem({
  label,
  icon,
  collapsed,
  active = false,
  onClick,
}: {
  label: string;
  icon: IconName;
  collapsed: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-left text-sm cursor-pointer transition-colors",
        collapsed && "lg:justify-center lg:px-0",
        active ? "bg-accent-soft text-accent font-semibold" : "text-text-secondary font-medium hover:bg-hover hover:text-text"
      )}
    >
      <span
        className={cn(
          "w-8 h-8 shrink-0 flex items-center justify-center rounded-lg transition-colors",
          active ? "bg-accent text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]" : "text-text-tertiary"
        )}
      >
        <Icon name={icon} className="w-[18px] h-[18px]" />
      </span>
      <span className={cn("truncate", collapsed && "lg:hidden")}>{label}</span>
    </button>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  sales: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  ops: (
    <>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9h16v2a3 3 0 01-5.33 1.9A3 3 0 0112 14a3 3 0 01-2.67-1.1A3 3 0 014 11V9z" />
      <path d="M5 13.5V20h14v-6.5" />
      <path d="M10 20v-4h4v4" />
    </>
  ),
  membership: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 4.5a3.5 3.5 0 010 7" />
      <path d="M18 14.5a6.5 6.5 0 013.5 5.5" />
    </>
  ),
  marketing: (
    <>
      <path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1z" />
      <path d="M17 9a4 4 0 010 6" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </>
  ),
  chevron: <path d="M15 6l-6 6 6 6" />,
};
