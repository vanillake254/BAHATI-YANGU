import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

type PaymentStatusResponse = {
  id: number
  type: string
  amount: string
  status: string
  final_state: string
  reference_id: string | null
}

export const PaymentStatusPage: React.FC = () => {
  const { request } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const txId = useMemo(() => {
    const raw = params.get('tx')
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : null
  }, [params])

  const [status, setStatus] = useState<PaymentStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(60)

  useEffect(() => {
    setError(null)
    setStatus(null)
    setSecondsLeft(60)

    if (!txId) {
      setError('Missing transaction id.')
      return
    }

    let cancelled = false

    const fetchStatus = async () => {
      try {
        const res = await request<PaymentStatusResponse>({
          url: `/api/payments/status/${txId}/`,
          method: 'GET',
        })
        if (!cancelled) setStatus(res)
      } catch (err: any) {
        if (!cancelled) setError(String(err?.response?.data?.detail || 'Failed to load payment status.'))
      }
    }

    fetchStatus()

    const pollId = window.setInterval(fetchStatus, 2500)
    const tickId = window.setInterval(() => {
      setSecondsLeft((s) => s - 1)
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      window.clearInterval(tickId)
    }
  }, [request, txId])

  const uiState = useMemo(() => {
    if (!txId) return { kind: 'error', message: 'Missing transaction id.' }
    if (error) return { kind: 'error', message: error }

    if (secondsLeft <= 0) {
      return {
        kind: 'timeout',
        message: 'Timed out. If you did not enter your M-Pesa PIN within 1 minute, the request was cancelled.',
      }
    }

    if (!status) return { kind: 'loading', message: 'Waiting for response…' }

    if (status.status === 'SUCCESS') {
      return { kind: 'success', message: 'Success! Your wallet has been updated.' }
    }

    if (status.status === 'FAILED') {
      if (status.final_state === 'CANCELED') {
        return { kind: 'cancelled', message: 'User cancelled.' }
      }
      return { kind: 'failed', message: 'Invalid response. Please try again.' }
    }

    return { kind: 'pending', message: 'Waiting for payment confirmation…' }
  }, [error, secondsLeft, status, txId])

  const bannerClass = useMemo(() => {
    if (uiState.kind === 'success') return 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100'
    if (uiState.kind === 'cancelled') return 'border-amber-500/40 bg-amber-950/40 text-amber-100'
    if (uiState.kind === 'timeout' || uiState.kind === 'failed' || uiState.kind === 'error') {
      return 'border-red-500/40 bg-red-950/40 text-red-100'
    }
    return 'border-cyan-500/40 bg-cyan-950/40 text-cyan-100'
  }, [uiState.kind])

  useEffect(() => {
    if (uiState.kind !== 'success') return
    const t = window.setTimeout(() => {
      if (status?.type === 'WITHDRAWAL') {
        navigate('/?toast=payout_success')
        return
      }
      navigate('/')
    }, 900)
    return () => window.clearTimeout(t)
  }, [navigate, status?.type, uiState.kind])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
        <h1 className="text-lg font-semibold text-slate-100">Payment Status</h1>
        <p className="mt-1 text-xs text-slate-400">Transaction: {txId ?? '—'}</p>

        <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${bannerClass}`}>{uiState.message}</div>

        {status && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
            <div>Type: {status.type}</div>
            <div>Amount: {status.amount} KES</div>
            <div>Status: {status.status}</div>
          </div>
        )}

        {uiState.kind !== 'success' && uiState.kind !== 'error' && (
          <div className="mt-3 text-xs text-slate-400">Auto-cancel in: {Math.max(0, secondsLeft)}s</div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-glow hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-50 hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        If you completed payment but don’t see success, wait a few seconds and refresh. Webhooks may take a moment.
      </p>
    </div>
  )
}
