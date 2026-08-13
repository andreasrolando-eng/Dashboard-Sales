"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      onClick={handleLogout}
      className="flex items-center gap-3 px-3 py-[11px] rounded-[10px] cursor-pointer text-text-secondary hover:bg-hover"
    >
      <div className="w-[9px] h-[9px] rounded-sm bg-text-inactive-dot" />
      <div className="text-sm font-medium">Keluar</div>
    </div>
  );
}
