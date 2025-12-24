import React from 'react'

export const AboutPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
      <h1 className="text-xl font-semibold text-slate-50">About Bahati Yangu</h1>
      <p>
        Bahati Yangu is a real-money gaming and prediction platform designed for simple, high-energy experiences
        that feel as polished as the best online Spin &amp; Win destinations. Every round, stake and payout flows
        through a secure wallet system with instant balance updates.
      </p>
      <p>
        Spins and predictions are settled on the server, not the browser. Outcomes are logged, auditable and
        protected by a profit engine that balances player excitement with long-term sustainability. Deposits and
        withdrawals are processed via IntaSend directly to your M-Pesa account.
      </p>
      <p>
        The platform is built with modern technology end to end: Django &amp; PostgreSQL in the backend, React and
        TailwindCSS in the frontend, and Celery-based monitoring that watches the house margin in real time.
      </p>
      <div className="border-t border-white/10 pt-4 text-xs text-slate-400">
        <p>
          Bahati Yangu is a high-risk entertainment product. Only stake what you can afford to lose, and take
          regular breaks. If you feel your play is no longer fun, stop immediately and seek help.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Built for fun and transparency. <span className="font-semibold text-accent">Powered by Bahati Yangu</span>.
        </p>
      </div>
    </div>
  )
}
