"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-5">
      <form
        action={formAction}
        className="w-full max-w-[380px] bg-surface border border-border rounded-2xl p-9 px-8 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-[10px] bg-accent" />
          <div className="text-[19px] font-bold text-text">ESB Analytics</div>
        </div>

        <div className="text-[22px] font-bold text-text mb-1">Masuk ke Dashboard</div>
        <div className="text-sm text-text-secondary mb-6">Monitoring sales &amp; membership F&amp;B</div>

        <label htmlFor="email" className="block text-[13px] font-semibold text-text-label mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="nama@esb.co.id"
          className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm mb-4 outline-none focus:border-accent"
        />

        <label htmlFor="password" className="block text-[13px] font-semibold text-text-label mb-1.5">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="••••••••"
          className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm mb-6 outline-none focus:border-accent"
        />

        {state?.error && (
          <div className="text-[13px] text-negative mb-4" role="alert">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-[10px] border-none bg-accent text-white text-[15px] font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Memproses..." : "Masuk ke Dashboard"}
        </button>

        <div className="text-center text-xs text-text-tertiary mt-[18px]">
          Akses terbatas untuk management &amp; eksekutif
        </div>
      </form>
    </div>
  );
}
