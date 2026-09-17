"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself (src/app/layout.tsx) --
// error.tsx doesn't cover that case. Must render its own <html>/<body> and
// can't rely on globals.css or the app's design tokens (see Next's
// global-error docs), so this stays plain/inline-styled on purpose.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: send to an error-tracking service (Sentry, etc.) once wired up.
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "#f7f7f8",
            color: "#111",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h2 style={{ marginBottom: 8 }}>Terjadi kesalahan fatal</h2>
            <p style={{ color: "#555", marginBottom: 24 }}>
              Aplikasi gagal dimuat. Coba lagi, atau muat ulang halaman kalau masih berlanjut.
            </p>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
