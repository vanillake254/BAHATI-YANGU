import React from 'react'

export const CookiesPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
      <h1 className="text-xl font-semibold text-slate-50">Cookies Policy</h1>
      <p>
        Bahati Yangu uses cookies and similar technologies to keep you signed in securely, remember basic
        preferences and understand how the platform is used.
      </p>
      <h2 className="text-base font-semibold text-slate-50">Types of cookies</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>
          <span className="font-semibold">Essential cookies</span> – used for authentication, security and core
          functionality such as keeping your session active.
        </li>
        <li>
          <span className="font-semibold">Preference cookies</span> – store simple settings such as your cookie
          consent choice.
        </li>
        <li>
          <span className="font-semibold">Analytics cookies</span> – aggregated metrics that help us understand how
          players use the platform and improve performance.
        </li>
      </ul>
      <h2 className="text-base font-semibold text-slate-50">Managing cookies</h2>
      <p className="text-xs text-slate-300">
        You can clear or block cookies from your browser settings at any time. Some features may not function
        correctly if essential cookies are disabled.
      </p>
      <p className="text-xs text-slate-400">
        By continuing to use Bahati Yangu you consent to our use of cookies as described in this policy.
      </p>
    </div>
  )
}
