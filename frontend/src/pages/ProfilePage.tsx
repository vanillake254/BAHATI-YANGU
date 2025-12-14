import React, { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'

type Wallet = {
  balance: string
  bonus_balance: string
  has_made_real_deposit: boolean
}

type Referral = {
  mpesa_number: string
  date_joined: string
}

export const ProfilePage: React.FC = () => {
  const { user, request, refreshUser } = useAuth()

  const [email, setEmail] = useState(user?.email ?? '')
  const [mpesa, setMpesa] = useState(user?.mpesa_number ?? '')
  const [password, setPassword] = useState('')
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const walletData = await request<Wallet>({ url: '/api/wallet/me/' })
        setWallet(walletData)
      } catch (err: any) {
        setError(String(err?.response?.data?.detail || 'Failed to load wallet.'))
      }

      try {
        const refData = await request<Referral[]>({ url: '/api/auth/my-referrals/' })
        setReferrals(refData)
      } catch {
        setReferrals([])
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setMpesa(user.mpesa_number)
    }
  }, [user])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const payload: any = {}
      if (email.trim() && email.trim() !== user.email) payload.email = email.trim()
      if (mpesa.trim() && mpesa.trim() !== user.mpesa_number) payload.mpesa_number = mpesa.trim()
      if (password) payload.password = password

      if (Object.keys(payload).length === 0) {
        setMessage('No changes to save.')
      } else {
        await request({ url: '/api/auth/me/', method: 'PATCH', data: payload })
        await refreshUser()
        setMessage('Profile updated successfully.')
        setPassword('')
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.mpesa_number?.[0] ||
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.password?.[0] ||
        'Unable to update profile. Please check your details.'
      setError(String(detail))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr),minmax(0,2.8fr)]">
      <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <h1 className="text-lg font-semibold text-slate-50">Profile</h1>
        <p className="text-xs text-slate-400">
          Update your account details. Changes to your email or M-Pesa number will apply to future logins and payouts.
        </p>

        {message && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              M-Pesa number
            </label>
            <input
              type="tel"
              required
              value={mpesa}
              onChange={(e) => setMpesa(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="07XXXXXXXX or 2547XXXXXXXXXX"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              New password (optional)
            </label>
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {saving ? 'Saving changes...' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-300">
        <h2 className="text-sm font-semibold text-slate-100">Account overview</h2>
        <p className="text-slate-400">
          Quick snapshot of your current wallet status. Balances update instantly after every spin, prediction, deposit
          or withdrawal.
        </p>

        {loading ? (
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Wallet balance
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-50">
              {wallet
                ? `${(
                    wallet.has_made_real_deposit
                      ? Number(wallet.balance)
                      : Number(wallet.balance) + Number(wallet.bonus_balance)
                  ).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`
                : '—'}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Linked M-Pesa: <span className="font-mono text-slate-200">{user?.mpesa_number}</span>
            </p>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-500">
          Before your first real deposit, this balance includes your free welcome bonus. After your first deposit, only
          real cash is shown.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Referrals</div>
          <div className="mt-2 text-xs text-slate-300">
            <div>
              Your referral code:{' '}
              <span className="font-mono text-accent">{user?.referral_code || '—'}</span>
            </div>
            {user?.referral_code && (
              <div className="mt-1 flex flex-col gap-1 text-[11px] text-slate-500 sm:flex-row sm:items-center">
                <span>Share this link with friends:</span>
                <div className="flex flex-1 items-center gap-2">
                  <span className="break-all font-mono text-slate-300">
                    {window.location.origin.replace(/\/$/, '') + `/register?ref=${user.referral_code}`}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const link =
                        window.location.origin.replace(/\/$/, '') + `/register?ref=${user.referral_code}`
                      try {
                        await navigator.clipboard.writeText(link)
                        setMessage('Referral link copied to clipboard.')
                      } catch {
                        setMessage('Unable to copy link automatically. Please copy it manually.')
                      }
                    }}
                    className="shrink-0 rounded-xl border border-accent/60 bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-slate-950"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-400">
            <p>
              How referrals work: share your link. When friends sign up using it, you earn{' '}
              <span className="font-semibold text-slate-200">10%</span> of their first{' '}
              <span className="font-semibold text-slate-200">3</span> successful deposits.
            </p>

            {referrals.length === 0 ? (
              <p className="mt-2">No referrals yet.</p>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="font-semibold text-slate-300">Referred players</p>
                <ul className="space-y-1">
                  {referrals.map((r) => (
                    <li
                      key={r.mpesa_number + r.date_joined}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5"
                    >
                      <span className="font-mono text-slate-100">{r.mpesa_number}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(r.date_joined).toLocaleDateString('en-KE')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
