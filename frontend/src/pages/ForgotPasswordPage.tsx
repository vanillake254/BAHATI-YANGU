import React, { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export const ForgotPasswordPage: React.FC = () => {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    setSubmitting(true)
    try {
      const apiBase = (import.meta as any).env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
      const url = `${String(apiBase).replace(/\/$/, '')}/api/auth/forgot-password/`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || 'Unable to submit reset request.')
      }
      setMessage(String(data.detail || 'If this email is registered, a reset request has been sent to admin.'))
    } catch (err: any) {
      setError(String(err.message || 'Unable to submit reset request.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-glow">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your registered email. A reset request will be sent to the admin to set a temporary password.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-2xl border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send reset request'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-accent hover:text-accentSoft">
            Back to login
          </Link>
        </p>

        {user && (
          <p className="mt-3 text-center text-[11px] text-slate-500">
            You are currently logged in as <span className="font-mono">{user.email}</span>.
          </p>
        )}
      </div>
    </div>
  )
}
