import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mfaChallengePending } from "@/lib/supabase/mfa";
import { isMockMode } from "@/lib/mock/is-mock";
import { SecurityPanel } from "./security-panel";

export default async function SecurityPage() {
  if (isMockMode()) {
    return (
      <div className="min-h-screen bg-page-bg px-5 py-10">
        <div className="max-w-[480px] mx-auto text-sm text-text-secondary">
          Pengaturan keamanan tidak tersedia dalam mode mock data.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (await mfaChallengePending(supabase))) {
    redirect("/login");
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.find((f) => f.status === "verified") ?? null;

  return (
    <div className="min-h-screen bg-page-bg px-5 py-10">
      <div className="max-w-[480px] mx-auto">
        <SecurityPanel
          email={user.email ?? ""}
          factor={verified ? { id: verified.id, friendlyName: verified.friendly_name ?? null } : null}
        />
      </div>
    </div>
  );
}
