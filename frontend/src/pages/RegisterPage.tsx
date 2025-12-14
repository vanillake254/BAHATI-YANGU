import React, { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

const isValidMpesa = (value: string) => {
  const digits = value.replace(/\s+/g, '')
  return /^07\d{8}$/.test(digits) || /^2547\d{8}$/.test(digits)
}

export const RegisterPage: React.FC = () => {
  const { user, register } = useAuth()
  const [searchParams] = useSearchParams()
  const initialReferral = searchParams.get('ref') || ''
  const [email, setEmail] = useState('')
  const [mpesa, setMpesa] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode] = useState(initialReferral)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValidMpesa(mpesa)) {
      setError('M-Pesa number must be 10 digits starting with 07 or 12 digits starting with 2547.')
      return
    }

    setSubmitting(true)
    try {
      await register({
        email: email.trim(),
        mpesa_number: mpesa.replace(/\s+/g, ''),
        password,
        referral_code: referralCode || undefined,
      })
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.mpesa_number?.[0] ||
        err?.response?.data?.email?.[0] ||
        'Unable to create account. Please check your details.'
      setError(String(detail))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-glow">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Create your Bahati Yangu account</h1>
          <p className="mt-1 text-sm text-slate-400">Sign up with your email and M-Pesa number to start playing.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
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
            <p className="mt-1 text-[11px] text-slate-500">
              Must be 10 digits starting with 07 or 12 digits starting with 2547.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="At least 8 characters"
            />
          </div>

          {referralCode && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                Referral code (locked)
              </label>
              <input
                type="text"
                value={referralCode}
                disabled
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-400 outline-none ring-0"
              />
              <p className="mt-1 text-[11px] text-slate-500">This code was prefilled from your friend&apos;s link.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:text-accentSoft">
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          <a
            href="https://vanillasoftwares.web.app"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent hover:text-accentSoft"
          >
            Powered by Vanilla Softwares
          </a>
        </p>
      </div>
    </div>
  )
}
