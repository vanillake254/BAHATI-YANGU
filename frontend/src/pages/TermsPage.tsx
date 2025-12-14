import React from 'react'

export const TermsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
      <h1 className="text-xl font-semibold text-slate-50">Terms &amp; Conditions</h1>
      <p>
        These Terms &amp; Conditions ("Terms") govern your use of the Bahati Yangu platform. By creating an
        account or placing any stake, you confirm that you have read, understood and agree to be bound by these
        Terms.
      </p>

      <h2 className="text-base font-semibold text-slate-50">1. Age restrictions</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>Bahati Yangu is strictly for persons aged 18 years and above.</li>
        <li>You confirm that you are at least 18 every time you log in and complete the age verification check.</li>
        <li>
          If we determine or reasonably suspect that you are under 18, your access may be blocked and your account
          may be closed.
        </li>
      </ul>

      <h2 className="text-base font-semibold text-slate-50">2. Responsible play</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>Funds staked on Bahati Yangu are at risk. You can lose part or all of your stake.</li>
        <li>Only play with money you can afford to lose and never chase losses.</li>
        <li>We may introduce limits, cooldowns or suspensions to protect users and the platform.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-50">3. Accounts and security</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>You are responsible for keeping your login details confidential.</li>
        <li>You must not allow anyone else, especially minors, to access your account.</li>
        <li>
          Suspicious activity (including multiple accounts, fraud or abuse of bonuses) may lead to investigation,
          temporary holds and closure.
        </li>
      </ul>

      <h2 className="text-base font-semibold text-slate-50">4. Deposits, withdrawals and payouts</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>All deposits and withdrawals are processed via IntaSend and M-Pesa using the number linked to your account.</li>
        <li>We may request additional verification for security or compliance reasons.</li>
        <li>Transaction fees, limits and processing times may vary based on payment providers.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-50">5. Games and house edge</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>Game outcomes are determined on the server using controlled randomness and system rules.</li>
        <li>
          A profit-control engine monitors results and adjusts parameters within configured limits so that the
          overall platform margin remains sustainable.
        </li>
        <li>No outcome is guaranteed and historical performance does not predict future rounds.</li>
      </ul>

      <h2 className="text-base font-semibold text-slate-50">6. Changes to these Terms</h2>
      <p className="text-xs text-slate-300">
        We may update these Terms from time to time. Continued use of Bahati Yangu after changes take effect means
        you accept the updated Terms.
      </p>

      <p className="text-xs text-slate-400">
        If you do not agree with these Terms or are under 18 years of age, you must not use the Bahati Yangu
        platform.
      </p>
    </div>
  )
}
