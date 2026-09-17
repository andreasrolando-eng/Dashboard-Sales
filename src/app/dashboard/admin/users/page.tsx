import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/is-mock";
import { UserAdminPanel } from "./user-admin-panel";

export default async function AdminUsersPage() {
  if (isMockMode()) {
    return (
      <div className="text-sm text-text-secondary">Halaman admin tidak tersedia dalam mode mock data.</div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // fn_is_admin_email checks the caller's own email server-side (same RPC
  // fn_admin_list_users/add_user/remove_user re-check internally) -- this
  // page-level check is UX (don't even show the page to non-admins), not the
  // real security boundary.
  const { data: isAdmin } = await supabase.rpc("fn_is_admin_email");
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: users, error } = await supabase.rpc("fn_admin_list_users");
  if (error || !users) {
    return <div className="text-sm text-negative">Gagal memuat daftar user.</div>;
  }

  return (
    <div>
      <div className="text-2xl font-bold text-text mb-1">Kelola User</div>
      <div className="text-[13px] text-text-secondary mb-6">
        Email yang boleh login lewat Google SSO. Email apa pun bisa ditambahkan, asal pemiliknya punya akun Google.
      </div>
      <UserAdminPanel users={users} currentEmail={user.email ?? ""} />
    </div>
  );
}
