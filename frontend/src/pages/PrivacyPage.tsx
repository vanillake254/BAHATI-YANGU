import React from 'react'

export const PrivacyPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
      <h1 className="text-xl font-semibold text-slate-50">Privacy Policy</h1>
      <p>
        This Privacy Policy explains in clear terms how Bahati Yangu collects, uses and protects your personal
        information. By creating an account or placing any stake on the platform, you agree to the practices
        described here.
      </p>
      <h2 className="text-base font-semibold text-slate-50">Data we collect</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>Email address and M-Pesa phone number used to create your account.</li>
        <li>Hashed passwords (we never store your plain password).</li>
        <li>Wallet balances, transaction history, game rounds and outcomes.</li>
        <li>Technical logs required to secure the platform and detect abuse.</li>
      </ul>
      <h2 className="text-base font-semibold text-slate-50">How we use your data</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>To create, operate and secure your Bahati Yangu account.</li>
        <li>To process deposits, withdrawals and payouts via IntaSend and M-Pesa.</li>
        <li>To enforce platform limits, detect fraud and comply with legal obligations.</li>
        <li>To improve the experience through aggregated, anonymised analytics.</li>
      </ul>
      <h2 className="text-base font-semibold text-slate-50">Sharing and retention</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>
          We do not sell your data. We share only what is necessary with trusted processors (such as IntaSend) and
          infrastructure providers who help us run the service.
        </li>
        <li>Data is retained for as long as necessary to operate the platform and meet regulatory requirements.</li>
      </ul>
      <p className="text-xs text-slate-400">
        If you have questions about privacy, or wish to request data access or deletion (subject to applicable law
        and record-keeping requirements), please contact platform support through the official channels.
      </p>
    </div>
  )
}
