import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rememberMeExpired } from "@/lib/supabase/remember-me";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";

// Same double-gated dev bypass as src/lib/supabase/proxy.ts -- see that
// file's comment. Keeps this check in sync so mock mode isn't blocked here
// after passing the proxy.
const MOCK_AUTH_BYPASS = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  let isAdmin = false;

  if (!MOCK_AUTH_BYPASS) {
    // Defense in depth alongside src/proxy.ts -- see proxy.ts's execution-order
    // note (Next 16 proxy matchers can skip Server Function calls on excluded
    // paths, so each protected surface re-checks the session itself).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const cookieStore = await cookies();

    if (!user || rememberMeExpired(cookieStore)) {
      redirect("/login");
    }

    // Only used to decide whether the sidebar shows the "Kelola User" link --
    // dashboard/admin/users/page.tsx and its RPCs re-check this themselves,
    // this is UX only, not the real gate.
    const { data } = await supabase.rpc("fn_is_admin_email");
    isAdmin = data ?? false;
  }

  return <DashboardChrome isAdmin={isAdmin}>{children}</DashboardChrome>;
}
