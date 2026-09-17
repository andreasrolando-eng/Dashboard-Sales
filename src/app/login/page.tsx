import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rememberMeExpired } from "@/lib/supabase/remember-me";
import { isMockMode } from "@/lib/mock/is-mock";
import { LoginShell } from "./login-shell";
import { GoogleSigninButton } from "./google-signin-button";

export default async function LoginPage() {
  if (!isMockMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const cookieStore = await cookies();

    if (user && !rememberMeExpired(cookieStore)) {
      redirect("/dashboard");
    }
  }

  return (
    <LoginShell>
      <Suspense>
        <GoogleSigninButton />
      </Suspense>
    </LoginShell>
  );
}
