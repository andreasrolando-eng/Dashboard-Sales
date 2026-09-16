export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-5">
      <div className="w-full max-w-[380px] bg-surface border border-border rounded-2xl p-9 px-8 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5 mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset from public/, no next/image usage elsewhere in the app */}
          <img src="/ESB-logo.png" alt="ESB Analytics" className="w-9 h-9 rounded-[10px] object-contain" />
          <div className="text-[19px] font-bold text-text">ESB Analytics</div>
        </div>
        {children}
      </div>
    </div>
  );
}
