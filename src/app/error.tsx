"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: send to an error-tracking service (Sentry, etc.) once wired up --
    // no APM configured yet, this is the only record of a runtime error today.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-5">
      <div className="w-full max-w-[420px] bg-surface border border-border rounded-2xl p-8 text-center shadow-[var(--shadow-card)]">
        <div className="text-lg font-bold text-text mb-2">Terjadi kesalahan</div>
        <div className="text-sm text-text-secondary mb-6">
          Ada yang gagal dimuat. Coba lagi, atau muat ulang halaman kalau masih berlanjut.
        </div>
        <button
          type="button"
          onClick={() => retry()}
          className="py-2.5 px-5 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
