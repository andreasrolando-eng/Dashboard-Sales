"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { MODULES, type NavIcon } from "@/lib/modules";
import { useLogout } from "./logout-button";

type IconName = NavIcon | "users" | "logout" | "chevron";

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
  // Mobile shows the icon rail until the drawer is opened; desktop follows
  // the persisted collapse toggle. Both are expressed as breakpoint-scoped
  // classes so the server render already matches the viewport.
  const compact: Compact = { mobile: !open, desktop: collapsed };
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
        "fixed top-0 left-0 bottom-0 z-20 w-[240px] flex flex-col bg-surface border-r border-border px-3 py-5 transition-[width] duration-200 ease-in-out",
        whenCompact(compact, "max-lg:w-[72px]", "lg:w-[72px]")
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Tampilkan / sembunyikan sidebar"
        aria-label="Tampilkan / sembunyikan sidebar"
        className="flex absolute -right-3 top-8 w-6 h-6 items-center justify-center rounded-full bg-surface border border-border text-text-secondary shadow-[var(--shadow-popover)] hover:text-accent cursor-pointer"
      >
        <Icon
          name="chevron"
          className={cn("w-3.5 h-3.5 transition-transform", whenCompact(compact, "max-lg:rotate-180", "lg:rotate-180"))}
        />
      </button>

      <div
        className={cn(
          "flex items-center gap-2.5 px-1.5 mb-7",
          whenCompact(compact, "max-lg:justify-center max-lg:px-0", "lg:justify-center lg:px-0")
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset from public/, no next/image usage elsewhere in the app */}
        <img src="/isd-logo.png" alt="ESB Analytics" className="w-9 h-9 shrink-0 object-contain" />
        <div className={cn("min-w-0", whenCompact(compact, "max-lg:hidden", "lg:hidden"))}>
          <div className="text-[15px] font-bold text-text leading-tight truncate">ESB Analytics</div>
          <div className="text-xs text-text-tertiary leading-tight">Sales Dashboard</div>
        </div>
      </div>

      {MODULES.map((module) => (
        <div key={module.key}>
          <SectionLabel compact={compact}>{module.label}</SectionLabel>
          <nav className="flex flex-col gap-1 mb-5">
            {module.tabs.map((item) => (
              <NavItem
                key={item.key}
                label={item.label}
                icon={item.icon}
                compact={compact}
                active={onDashboardRoot && tab === item.key}
                onClick={() => go(`/dashboard?tab=${item.key}`)}
              />
            ))}
          </nav>
        </div>
      ))}

      {isAdmin && (
        <>
          <SectionLabel compact={compact}>Admin</SectionLabel>
          <nav className="flex flex-col gap-1">
            <NavItem label="Kelola User" icon="users" compact={compact} active={onAdmin} onClick={() => go(ADMIN_HREF)} />
          </nav>
        </>
      )}

      <div className="mt-auto pt-4 border-t border-border">
        <NavItem label="Keluar" icon="logout" compact={compact} onClick={logout} />
      </div>
    </aside>
  );
}

type Compact = { mobile: boolean; desktop: boolean };

// Class names stay as literals at each call site so Tailwind can see them.
function whenCompact(compact: Compact, mobileClass: string, desktopClass: string) {
  return cn(compact.mobile && mobileClass, compact.desktop && desktopClass);
}

function SectionLabel({ compact, children }: { compact: Compact; children: React.ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary",
          whenCompact(compact, "max-lg:hidden", "lg:hidden")
        )}
      >
        {children}
      </div>
      <div className={cn("hidden mx-auto w-6 h-px bg-border mb-3", whenCompact(compact, "max-lg:block", "lg:block"))} />
    </>
  );
}

function NavItem({
  label,
  icon,
  compact,
  active = false,
  onClick,
}: {
  label: string;
  icon: IconName;
  compact: Compact;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-left text-sm cursor-pointer transition-colors",
        whenCompact(compact, "max-lg:justify-center max-lg:px-0", "lg:justify-center lg:px-0"),
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
      <span className={cn("truncate", whenCompact(compact, "max-lg:hidden", "lg:hidden"))}>{label}</span>
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
  cost: (
    <>
      <path d="M6 3h12a1 1 0 011 1v17l-3-2-2.5 2L12 19l-1.5 2L8 19l-3 2V4a1 1 0 011-1z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
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
