import React, { useEffect, useState } from 'react'

import { useAuth } from '../auth/AuthContext'

type MarginStats = {
  label: string
  total_stakes: number
  total_payouts: number
  margin: number | null
}

type AdjustmentLog = {
  id: number
  game_type: string
  created_at: string
  auto: boolean
  margin_short: number
  margin_long: number
  intensity: number
  parameters_before: unknown
  parameters_after: unknown
  note: string
} | null

type ProfitStatus = {
  target_margin: number
  short_window_minutes: number
  long_window_hours: number
  margin_short: Record<string, MarginStats>
  margin_long: Record<string, MarginStats>
  latest_adjustments: Record<string, AdjustmentLog>
  user_stats: {
    total_users: number
  }
  deposit_stats: {
    pending: number
    success: number
    failed: number
    total_amount: number
  }
  withdrawal_stats: {
    pending: number
    success: number
    failed: number
    total_amount: number
  }
}

type AdminUser = {
  id: number
  email: string
  mpesa_number: string
  date_joined: string
  is_staff: boolean
  is_superuser: boolean
  referral_code?: string
  total_deposits?: string
  total_withdrawals?: string
  force_password_change?: boolean
}

type AdminDeposit = {
  id: number
  type: string
  amount: string
  status: string
  reference_id: string | null
  provider: string
  meta: any
  created_at: string
}

type AdminWithdrawal = {
  id: number
  type: string
  amount: string
  status: string
  reference_id: string | null
  provider: string
  meta: any
  created_at: string
}

type PasswordResetRequest = {
  id: number
  status: 'PENDING' | 'DONE' | string
  created_at: string
  processed_at: string | null
  user: {
    id: number
    email: string
    mpesa_number: string
    date_joined: string
    is_staff: boolean
    is_superuser: boolean
    referral_code?: string
    force_password_change?: boolean
  }
}

export const AdminProfitPage: React.FC = () => {
  const { user, request } = useAuth()
  const [data, setData] = useState<ProfitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminDeposit[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([])
  const [passwordResetStatus, setPasswordResetStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('PENDING')

  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [depositPage, setDepositPage] = useState(1)
  const [withdrawalPage, setWithdrawalPage] = useState(1)

  const [resetResult, setResetResult] = useState<{ userId: number; tempPassword: string } | null>(null)
  const [resetRequestResult, setResetRequestResult] = useState<
    { requestId: number; tempPassword: string } | null
  >(null)

  const pageSize = 10

  const isAdmin = !!user?.is_staff || !!user?.is_superuser

  useEffect(() => {
    const load = async () => {
      if (!isAdmin) {
        setLoading(false)
        setError('Admin access required.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await request<ProfitStatus>({ url: '/api/profit/status/' })
        setData(res)
        const userRes = await request<AdminUser[]>({ url: '/api/admin/users/' })
        setUsers(userRes)
        const depRes = await request<AdminDeposit[]>({ url: '/api/admin/deposits/' })
        setDeposits(depRes)
        const wRes = await request<AdminWithdrawal[]>({ url: '/api/admin/withdrawals/' })
        setWithdrawals(wRes)
        const prRes = await request<PasswordResetRequest[]>({
          url:
            passwordResetStatus === 'ALL'
              ? '/api/auth/admin/password-resets/'
              : `/api/auth/admin/password-resets/?status=${passwordResetStatus}`,
        })
        setPasswordResets(prRes)
      } catch (err: any) {
        const detail = err?.response?.data?.detail || 'Failed to load profit metrics.'
        setError(String(detail))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, passwordResetStatus])

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
        Admin access required.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
        {error || 'No profit data available yet.'}
      </div>
    )
  }

  const gameTypes = Object.keys(data.margin_short)

  const sortedDeposits = [...deposits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const sortedWithdrawals = [...withdrawals].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true
    const q = userSearch.trim().toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.mpesa_number.toLowerCase().includes(q) ||
      (u.referral_code || '').toLowerCase().includes(q)
    )
  })

  const paginate = <T,>(items: T[], page: number) => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const depositPageCount = Math.max(1, Math.ceil(sortedDeposits.length / pageSize))
  const withdrawalPageCount = Math.max(1, Math.ceil(sortedWithdrawals.length / pageSize))

  const visibleUsers = paginate(filteredUsers, userPage)
  const visibleDeposits = paginate(sortedDeposits, depositPage)
  const visibleWithdrawals = paginate(sortedWithdrawals, withdrawalPage)

  const formatPct = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—'
    return `${(value * 100).toFixed(1)}%`
  }

  const handleResetPassword = async (userId: number) => {
    setError(null)
    setResetResult(null)
    try {
      const res = await request<{ temporary_password: string }>({
        url: `/api/admin/users/${userId}/reset-password/`,
        method: 'POST',
      })
      setResetResult({ userId, tempPassword: res.temporary_password })
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to reset password.'
      setError(String(detail))
    }
  }

  const handleProcessResetRequest = async (requestId: number) => {
    setError(null)
    setResetRequestResult(null)
    try {
      const res = await request<{ temporary_password: string }>({
        url: `/api/auth/admin/password-resets/${requestId}/reset/`,
        method: 'POST',
      })
      setResetRequestResult({ requestId, tempPassword: res.temporary_password })

      const prRes = await request<PasswordResetRequest[]>({
        url:
          passwordResetStatus === 'ALL'
            ? '/api/auth/admin/password-resets/'
            : `/api/auth/admin/password-resets/?status=${passwordResetStatus}`,
      })
      setPasswordResets(prRes)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to process reset request.'
      setError(String(detail))
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200">
        <h1 className="text-lg font-semibold text-slate-50">House overview</h1>
        <p className="mt-1 text-xs text-slate-400">
          Live estimates based on recent rounds. Target margin is{' '}
          <span className="font-semibold text-emerald-300">{formatPct(data.target_margin)}</span>.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs">
            <div className="text-slate-400">Short window</div>
            <div className="mt-1 text-2xl font-semibold text-slate-50">
              {data.short_window_minutes} min
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs">
            <div className="text-slate-400">Long window</div>
            <div className="mt-1 text-2xl font-semibold text-slate-50">
              {data.long_window_hours} hrs
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs">
            <div className="text-slate-400">Users &amp; withdrawals</div>
            <div className="mt-1 text-lg font-semibold text-slate-50">
              {data.user_stats.total_users.toLocaleString()} users
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              D: {data.deposit_stats.success} ✓ · {data.deposit_stats.pending} ⏳ · {data.deposit_stats.failed} ✕
            </div>
            <div className="text-[11px] text-slate-500">
              Total deposits KES {data.deposit_stats.total_amount.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              W: {data.withdrawal_stats.success} ✓ · {data.withdrawal_stats.pending} ⏳ ·{' '}
              {data.withdrawal_stats.failed} ✕
            </div>
            <div className="text-[11px] text-slate-500">
              Total withdrawals KES {data.withdrawal_stats.total_amount.toFixed(2)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <a
                href="#admin-users-table"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900/80 px-2 py-1 text-center text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/80"
              >
                View users
              </a>
              <a
                href="#admin-deposits-table"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900/80 px-2 py-1 text-center text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/80"
              >
                View deposits
              </a>
              <a
                href="#admin-withdrawals-table"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900/80 px-2 py-1 text-center text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/80"
              >
                View withdrawals
              </a>
            </div>
            <div className="mt-2">
              <a
                href="#admin-password-resets"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900/80 px-2 py-1 text-center text-[11px] text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/80"
              >
                Password resets
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {gameTypes.map((game) => {
          const short = data.margin_short[game]
          const long = data.margin_long[game]
          const log = data.latest_adjustments[game]
          const shortOk = short?.margin !== null && short.margin >= data.target_margin
          const longOk = long?.margin !== null && long.margin >= data.target_margin

          return (
            <div
              key={game}
              className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-xs text-slate-200"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-50">{short?.label || game}</h2>
                <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                  {game}
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 rounded-2xl border border-white/10 bg-slate-900/80 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Short margin</div>
                  <div className={shortOk ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-amber-300'}>
                    {formatPct(short?.margin ?? null)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Stakes {short ? short.total_stakes.toFixed(2) : '0.00'} · Payouts{' '}
                    {short ? short.total_payouts.toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="space-y-1 rounded-2xl border border-white/10 bg-slate-900/80 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Long margin</div>
                  <div className={longOk ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-amber-300'}>
                    {formatPct(long?.margin ?? null)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Stakes {long ? long.total_stakes.toFixed(2) : '0.00'} · Payouts{' '}
                    {long ? long.total_payouts.toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/80 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Last adjustment</div>
                {log ? (
                  <div className="mt-1 space-y-1 text-[11px] text-slate-300">
                    <div>
                      {new Date(log.created_at).toLocaleString()} · Intensity {log.intensity.toFixed(3)} ·{' '}
                      {log.auto ? 'Auto' : 'Manual'}
                    </div>
                    <div>
                      Short margin at change: {formatPct(log.margin_short)} · Long: {formatPct(log.margin_long)}
                    </div>
                    <div className="text-slate-500">{log.note || 'auto-adjust'}</div>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-slate-500">No adjustments recorded yet.</div>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* Users table */}
      <section
        id="admin-users-table"
        className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-200"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-50">Users</h2>
            <span className="text-[11px] text-slate-400">
              {filteredUsers.length.toLocaleString()} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                setUserPage(1)
              }}
              placeholder="Search by email, M-Pesa or referral code"
              className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">No users found yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-2 py-1.5 font-medium">ID</th>
                  <th className="px-2 py-1.5 font-medium">Email</th>
                  <th className="px-2 py-1.5 font-medium">M-Pesa</th>
                  <th className="px-2 py-1.5 font-medium">Referral code</th>
                  <th className="px-2 py-1.5 font-medium">Deposits (KES)</th>
                  <th className="px-2 py-1.5 font-medium">Withdrawals (KES)</th>
                  <th className="px-2 py-1.5 font-medium">Joined</th>
                  <th className="px-2 py-1.5 font-medium">Role</th>
                  <th className="px-2 py-1.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{u.id}</td>
                    <td className="px-2 py-1.5">{u.email}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-200">{u.mpesa_number}</td>
                    <td className="px-2 py-1.5 font-mono text-accent">{u.referral_code || '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-100">
                      {Number(u.total_deposits || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-100">
                      {Number(u.total_withdrawals || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(u.date_joined).toLocaleString('en-KE')}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {u.is_superuser ? 'Superadmin' : u.is_staff ? 'Staff' : 'Player'}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u.id)}
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80"
                      >
                        Reset password
                      </button>
                      {resetResult?.userId === u.id && (
                        <div className="mt-1 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 font-mono text-[10px] text-emerald-200">
                          Temp: {resetResult.tempPassword}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredUsers.length > pageSize && (
          <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-slate-400">
            <button
              type="button"
              disabled={userPage <= 1}
              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {userPage} of {userPageCount}
            </span>
            <button
              type="button"
              disabled={userPage >= userPageCount}
              onClick={() => setUserPage((p) => Math.min(userPageCount, p + 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Password reset requests */}
      <section
        id="admin-password-resets"
        className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-200"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-50">Password resets</h2>
            <span className="text-[11px] text-slate-400">{passwordResets.length.toLocaleString()} records</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={passwordResetStatus}
              onChange={(e) => setPasswordResetStatus(e.target.value as any)}
              className="rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none"
            >
              <option value="PENDING">Pending</option>
              <option value="DONE">Done</option>
              <option value="ALL">All</option>
            </select>
          </div>
        </div>

        {passwordResets.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">No reset requests found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-2 py-1.5 font-medium">ID</th>
                  <th className="px-2 py-1.5 font-medium">User</th>
                  <th className="px-2 py-1.5 font-medium">M-Pesa</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Requested</th>
                  <th className="px-2 py-1.5 font-medium">Processed</th>
                  <th className="px-2 py-1.5 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {passwordResets.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{r.id}</td>
                    <td className="px-2 py-1.5">{r.user.email}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-200">{r.user.mpesa_number}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          r.status === 'DONE'
                            ? 'rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-200'
                            : 'rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] text-amber-200'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">{new Date(r.created_at).toLocaleString('en-KE')}</td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {r.processed_at ? new Date(r.processed_at).toLocaleString('en-KE') : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => handleProcessResetRequest(r.id)}
                          className="rounded-xl border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80"
                        >
                          Reset now
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Done</span>
                      )}

                      {resetRequestResult?.requestId === r.id && (
                        <div className="mt-1 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 font-mono text-[10px] text-emerald-200">
                          Temp: {resetRequestResult.tempPassword}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Deposits table */}
      <section
        id="admin-deposits-table"
        className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-200"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-50">Deposit history</h2>
          <span className="text-[11px] text-slate-400">
            {sortedDeposits.length.toLocaleString()} records · newest first
          </span>
        </div>

        {sortedDeposits.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">No deposits recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-2 py-1.5 font-medium">ID</th>
                  <th className="px-2 py-1.5 font-medium">Amount (KES)</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Reference</th>
                  <th className="px-2 py-1.5 font-medium">Provider</th>
                  <th className="px-2 py-1.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeposits.map((d) => (
                  <tr key={d.id} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{d.id}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-100">{Number(d.amount).toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          d.status === 'SUCCESS'
                            ? 'rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-200'
                            : d.status === 'PENDING'
                            ? 'rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] text-amber-200'
                            : 'rounded-full bg-red-900/60 px-2 py-0.5 text-[10px] text-red-200'
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-300">{d.reference_id || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-300">{d.provider}</td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(d.created_at).toLocaleString('en-KE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sortedDeposits.length > pageSize && (
          <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-slate-400">
            <button
              type="button"
              disabled={depositPage <= 1}
              onClick={() => setDepositPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {depositPage} of {depositPageCount}
            </span>
            <button
              type="button"
              disabled={depositPage >= depositPageCount}
              onClick={() => setDepositPage((p) => Math.min(depositPageCount, p + 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Withdrawals table */}
      <section
        id="admin-withdrawals-table"
        className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-200"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-50">Withdrawal history</h2>
          <span className="text-[11px] text-slate-400">
            {sortedWithdrawals.length.toLocaleString()} records · newest first
          </span>
        </div>

        {sortedWithdrawals.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">No withdrawals recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-2 py-1.5 font-medium">ID</th>
                  <th className="px-2 py-1.5 font-medium">Amount (KES)</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Reference</th>
                  <th className="px-2 py-1.5 font-medium">Provider</th>
                  <th className="px-2 py-1.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleWithdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{w.id}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-100">{Number(w.amount).toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          w.status === 'SUCCESS'
                            ? 'rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-200'
                            : w.status === 'PENDING'
                            ? 'rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] text-amber-200'
                            : 'rounded-full bg-red-900/60 px-2 py-0.5 text-[10px] text-red-200'
                        }
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-300">{w.reference_id || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-300">{w.provider}</td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(w.created_at).toLocaleString('en-KE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sortedWithdrawals.length > pageSize && (
          <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-slate-400">
            <button
              type="button"
              disabled={withdrawalPage <= 1}
              onClick={() => setWithdrawalPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {withdrawalPage} of {withdrawalPageCount}
            </span>
            <button
              type="button"
              disabled={withdrawalPage >= withdrawalPageCount}
              onClick={() => setWithdrawalPage((p) => Math.min(withdrawalPageCount, p + 1))}
              className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-100">
          {error}
        </div>
      )}
    </div>
  )
}
