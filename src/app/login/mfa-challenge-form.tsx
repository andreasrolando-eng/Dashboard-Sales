"use client";

import { useActionState } from "react";
import { cancelMfaLogin, verifyMfaCode } from "./actions";

export function MfaChallengeForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(verifyMfaCode, undefined);

  return (
    <form action={formAction}>
      <div className="text-[22px] font-bold text-text mb-1">Verifikasi Dua Langkah</div>
      <div className="text-sm text-text-secondary mb-6">
        Masukkan kode 6 digit dari aplikasi authenticator kamu.
      </div>

      <input type="hidden" name="factorId" value={factorId} />

      <label htmlFor="code" className="block text-[13px] font-semibold text-text-label mb-1.5">
        Kode Autentikator
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        required
        placeholder="123456"
        className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm mb-6 outline-none focus:border-accent tracking-[0.3em] text-center"
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
        {pending ? "Memverifikasi..." : "Verifikasi"}
      </button>

      <button
        type="submit"
        formAction={cancelMfaLogin}
        className="w-full py-2.5 mt-2 rounded-[10px] border-none bg-transparent text-text-tertiary text-xs font-medium cursor-pointer"
      >
        Bukan kamu? Keluar dan login ulang
      </button>
    </form>
  );
}
