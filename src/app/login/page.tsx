import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mfaChallengePending } from "@/lib/supabase/mfa";
import { rememberMeExpired } from "@/lib/supabase/remember-me";
import { isMockMode } from "@/lib/mock/is-mock";
import { LoginShell } from "./login-shell";
import { LoginForm } from "./login-form";
import { MfaChallengeForm } from "./mfa-challenge-form";

export default async function LoginPage() {
  if (!isMockMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const cookieStore = await cookies();

    if (user && !rememberMeExpired(cookieStore)) {
      if (!(await mfaChallengePending(supabase))) {
        redirect("/dashboard");
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors?.totp.find((f) => f.status === "verified")?.id;

      if (factorId) {
        return (
          <LoginShell>
            <MfaChallengeForm factorId={factorId} />
          </LoginShell>
        );
      }
    }
  }

  return (
    <LoginShell>
      <LoginForm />
    </LoginShell>
  );
}
