"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Login gagal, coba lagi.",
  not_registered: "Akun ini belum didaftarkan buat akses dashboard. Hubungi admin untuk ditambahkan.",
};

export function GoogleSigninButton() {
  const searchParams = useSearchParams();
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const error = searchParams.get("error");

  async function handleClick() {
    setPending(true);
    // Short-lived hint cookie -- the browser leaves this origin for Google's
    // consent screen and back, so there's no client-side state to carry the
    // "remember me" choice through the redirect round trip. The callback
    // route (src/app/auth/callback/route.ts) reads and deletes it.
    document.cookie = `oauth_remember=${remember ? "1" : "0"}; path=/; max-age=300; samesite=lax`;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // No `hd` domain hint anymore -- any Google account is allowed to
        // attempt sign-in, access is gated purely by the allowed_users
        // allowlist (src/app/auth/callback/route.ts), not by email domain.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setPending(false);
  }

  return (
    <div>
      <div className="text-[22px] font-bold text-text mb-1">Masuk ke Dashboard</div>
      <div className="text-sm text-text-secondary mb-6">Monitoring sales &amp; membership F&amp;B</div>

      {error && (
        <div className="text-[13px] text-negative mb-4" role="alert">
          {ERROR_MESSAGES[error] ?? "Terjadi kesalahan, coba lagi."}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-[10px] border border-border-form bg-white text-[15px] font-semibold text-text cursor-pointer disabled:opacity-60"
      >
        <GoogleIcon />
        {pending ? "Mengalihkan..." : "Masuk dengan Google"}
      </button>

      <label className="flex items-center gap-2 text-[13px] text-text-secondary mt-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-[15px] h-[15px] accent-accent cursor-pointer"
        />
        Ingat saya di perangkat ini
      </label>

      <div className="text-center text-xs text-text-tertiary mt-[18px]">
        Akses terbatas untuk email yang sudah didaftarkan admin
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.8 14.1-5l-6.5-5.5C29.6 35.2 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.5 5.5C41.8 35.4 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
