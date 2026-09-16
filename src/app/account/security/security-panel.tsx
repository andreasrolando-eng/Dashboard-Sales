"use client";

import { useActionState, useState } from "react";
import { confirmTotpEnrollment, enrollTotp, unenrollTotp } from "./actions";

type Factor = { id: string; friendlyName: string | null };

export function SecurityPanel({ email, factor }: { email: string; factor: Factor | null }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-7">
      <div className="text-lg font-bold text-text mb-1">Keamanan Akun</div>
      <div className="text-sm text-text-secondary mb-6">{email}</div>
      {factor ? <EnrolledView factor={factor} /> : <EnrollFlow />}
    </div>
  );
}

function EnrolledView({ factor }: { factor: Factor }) {
  const [state, formAction, pending] = useActionState(unenrollTotp, undefined);

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-positive font-semibold mb-4">
        <span className="w-2 h-2 rounded-full bg-positive" />
        Two-factor authentication aktif
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Login berikutnya akan meminta kode dari aplikasi authenticator kamu setelah password.
      </p>
      <form action={formAction}>
        <input type="hidden" name="factorId" value={factor.id} />
        {state?.error && (
          <div className="text-[13px] text-negative mb-3" role="alert">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="py-2.5 px-4 rounded-[10px] border border-border-form bg-transparent text-negative text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Menonaktifkan..." : "Nonaktifkan MFA"}
        </button>
      </form>
    </>
  );
}

function EnrollFlow() {
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [state, formAction, pending] = useActionState(confirmTotpEnrollment, undefined);

  if (state?.success) {
    return (
      <div className="text-sm text-positive font-semibold">
        MFA berhasil diaktifkan. Muat ulang halaman untuk melihat status terbaru.
      </div>
    );
  }

  async function start() {
    setStarting(true);
    setEnrollError(null);
    const result = await enrollTotp();
    setStarting(false);
    if ("error" in result) {
      setEnrollError(result.error);
      return;
    }
    setEnrollment(result);
  }

  if (!enrollment) {
    return (
      <>
        <p className="text-sm text-text-secondary mb-4">
          Two-factor authentication belum aktif. Aktifkan untuk melindungi akun dengan kode dari aplikasi
          authenticator (Google Authenticator, Authy, dll), di samping password.
        </p>
        {enrollError && (
          <div className="text-[13px] text-negative mb-3" role="alert">
            {enrollError}
          </div>
        )}
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="py-2.5 px-4 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {starting ? "Memuat..." : "Aktifkan MFA"}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="text-sm text-text-secondary mb-3">
        Scan QR code ini dengan aplikasi authenticator, lalu masukkan kode 6 digit yang muncul.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from our own Supabase project, not a remote asset next/image needs to optimize */}
      <img
        src={enrollment.qrCode}
        alt="QR code MFA"
        className="w-[200px] h-[200px] mx-auto mb-4 rounded-lg border border-border"
      />
      <div className="text-xs text-text-tertiary text-center mb-5 break-all">
        Tidak bisa scan? Masukkan manual: <span className="font-mono">{enrollment.secret}</span>
      </div>

      <form action={formAction}>
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <label htmlFor="code" className="block text-[13px] font-semibold text-text-label mb-1.5">
          Kode 6 digit
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
          className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm mb-4 outline-none focus:border-accent tracking-[0.3em] text-center"
        />
        {state?.error && (
          <div className="text-[13px] text-negative mb-4" role="alert">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Memverifikasi..." : "Verifikasi & Aktifkan"}
        </button>
      </form>
    </>
  );
}
