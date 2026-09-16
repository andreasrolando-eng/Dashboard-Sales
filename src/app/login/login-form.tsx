"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction}>
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
        className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm mb-4 outline-none focus:border-accent"
      />

      <label className="flex items-center gap-2 text-[13px] text-text-secondary mb-6 cursor-pointer select-none">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="w-[15px] h-[15px] accent-accent cursor-pointer"
        />
        Ingat saya di perangkat ini
      </label>

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
  );
}
