import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

type Wallet = {
  balance: string
  bonus_balance: string
  has_made_real_deposit: boolean
}

type Transaction = {
  id: number
  type: string
  amount: string
  status: string
  reference_id: string | null
  created_at: string
}


export const DashboardPage: React.FC = () => {
  const { user, request } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [withdrawPending, setWithdrawPending] = useState<{ txId: number; amount: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [walletData, txData] = await Promise.all([
        request<Wallet>({ url: '/api/wallet/me/' }),
        request<Transaction[]>({ url: '/api/transactions/' }),
      ])
      setWallet(walletData)
      setTransactions(txData)
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || 'Failed to load dashboard.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const toastParam = searchParams.get('toast')
    if (toastParam !== 'payout_success') return

    setToast('Cash out successful. Funds are on the way to your M-Pesa.')

    const url = new URL(window.location.href)
    url.searchParams.delete('toast')
    window.history.replaceState({}, '', url.toString())

    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [searchParams])

  useEffect(() => {
    if (location.hash !== '#cash') return

    const el = document.getElementById('cash')
    if (!el) return

    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)

    return () => window.clearTimeout(t)
  }, [location.hash])

  const handleDeposit = async () => {
    setError(null)
    setActionMessage(null)
    if (!depositAmount) return
    try {
      const res = await request<{ transaction_id: number; status?: string }>({
        url: '/api/payments/deposit/',
        method: 'POST',
        data: { amount: depositAmount },
      })
      setDepositAmount('')
      navigate(`/payment-status?tx=${res.transaction_id}`)
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || 'Deposit failed.'))
    }
  }

  const handleWithdraw = async () => {
    setError(null)
    setActionMessage(null)
    if (!withdrawAmount) return

    const withdrawNumeric = Number(withdrawAmount)
    if (!withdrawNumeric || withdrawNumeric < 100 || withdrawNumeric % 50 !== 0) {
      setError('Withdrawal amount must be KES 100 and then in increments of KES 50 (100, 150, 200, ...).')
      return
    }
    try {
      const res = await request<{ transaction_id: number; status: string }>({
        url: '/api/payments/withdraw/',
        method: 'POST',
        data: { amount: withdrawAmount },
      })
      const amt = withdrawAmount
      setWithdrawAmount('')
      setWithdrawPending({ txId: res.transaction_id, amount: amt })
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || 'Withdrawal failed.'))
    }
  }

  // Poll withdrawal status with 1-minute timeout
  useEffect(() => {
    if (!withdrawPending) return

    let cancelled = false
    const startTime = Date.now()
    const TIMEOUT_MS = 60_000 // 1 minute

    const poll = async () => {
      if (cancelled) return
      if (Date.now() - startTime > TIMEOUT_MS) {
        setWithdrawPending(null)
        setError('Withdrawal timed out. Check your M-Pesa or try again.')
        return
      }

      try {
        const res = await request<{ status: string; final_state?: string }>({
          url: `/api/payments/status/${withdrawPending.txId}/`,
        })

        if (res.status === 'SUCCESS') {
          setWithdrawPending(null)
          const msg = `Cash out of KES ${withdrawPending.amount} successful! Funds sent to M-Pesa.`
          setToast(msg)
          // Auto-dismiss toast after 3 seconds
          setTimeout(() => setToast(null), 3000)
          load() // refresh wallet + transactions
          return
        }

        if (res.status === 'FAILED' || res.final_state === 'FAILED' || res.final_state === 'CANCELED') {
          setWithdrawPending(null)
          setError('Withdrawal failed. Funds returned to wallet.')
          load()
          return
        }

        // Still pending, poll again
        setTimeout(poll, 1000)
      } catch {
        // Network error, retry
        setTimeout(poll, 1500)
      }
    }

    poll()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawPending])

  return (
    <div className="space-y-8">
      {/* Withdrawal pending overlay */}
      {withdrawPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-emerald-500/40 bg-slate-950/95 p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-emerald-100">Processing withdrawal…</p>
            <p className="mt-1 text-xs text-slate-400">KES {withdrawPending.amount} to M-Pesa</p>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-sm text-emerald-50 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
            {toast}
          </div>
        </div>
      )}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-card/90 p-5 shadow-glow">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wallet balance</div>
          <div className="mt-3 text-3xl font-semibold text-slate-50">
            {wallet
              ? `${(
                  wallet.has_made_real_deposit
                    ? Number(wallet.balance)
                    : Number(wallet.balance) + Number(wallet.bonus_balance)
                ).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`
              : '—'}
          </div>
          <p className="mt-2 text-xs text-slate-400">Instant updates after every spin, prediction, deposit or withdrawal.</p>
        </div>
        <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/20 via-slate-900 to-slate-950 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">Spin &amp; Win</div>
          <p className="mt-2 text-sm text-fuchsia-50">
            High-energy wheel with server-side randomness and a protected house margin.
          </p>
          <a
            href="/spin"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-fuchsia-400 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-glow hover:bg-fuchsia-300"
          >
            Go to Spin &amp; Win
          </a>
        </div>
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Predict &amp; Win</div>
          <p className="mt-2 text-sm text-emerald-50">
            Fast predictions on colour outcomes with transparent odds and instant settlement.
          </p>
          <a
            href="/predict"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-glow hover:bg-emerald-300"
          >
            Go to Predict &amp; Win
          </a>
        </div>
        <div className="rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-slate-950 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Pick a Box</div>
          <p className="mt-2 text-sm text-cyan-50">
            Three mystery boxes hiding X0, X1 and X2. Stake once, pick a box and reveal your multiplier.
          </p>
          <a
            href="/pick-box"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-glow hover:bg-cyan-300"
          >
            Go to Pick a Box
          </a>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        <div id="cash" className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 scroll-mt-24">
          <h2 className="text-sm font-semibold text-slate-100">Cash in &amp; Cash out</h2>
          <p className="text-xs text-slate-400">
            Deposits and withdrawals are processed securely via IntaSend directly to your M-Pesa wallet.
          </p>

          {actionMessage && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
              {actionMessage}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Deposit</div>
              <input
                type="number"
                min={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
                placeholder="Amount in KES"
              />
              <button
                type="button"
                onClick={handleDeposit}
                className="w-full rounded-xl bg-fuchsia-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-glow hover:bg-fuchsia-300"
              >
                Deposit via IntaSend
              </button>
            </div>

            <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Withdraw</div>
              <p className="text-[11px] text-slate-400">
                Withdrawals go to your M-Pesa number. Allowed amounts are KES 100, 150, 200, 250… (increments of 50).
              </p>
              <input
                type="number"
                min={100}
                step={50}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Amount in KES"
              />
              <button
                type="button"
                onClick={handleWithdraw}
                className="w-full rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-glow hover:bg-emerald-300"
              >
                Withdraw to M-Pesa
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Linked account: <span className="font-mono text-slate-200">{user?.mpesa_number}</span>
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Recent activity</h2>
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-glow hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Latest deposits, withdrawals and game results.</p>

          {loading ? (
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="mt-6 text-xs text-slate-500">No activity yet. Make a deposit and place your first spin or prediction.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-xs">
              {transactions.slice(0, 10).map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/80 px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-slate-100">{tx.type}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(tx.created_at).toLocaleString()} · Ref {tx.reference_id || '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        tx.type === 'DEPOSIT' || tx.type === 'GAME_WIN'
                          ? 'text-emerald-300'
                          : tx.type === 'WITHDRAWAL' || tx.type === 'GAME_STAKE'
                            ? 'text-red-300'
                            : 'text-slate-200'
                      }
                    >
                      {Number(tx.amount).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
                    </div>
                    <div className="text-[11px] text-slate-500">{tx.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
