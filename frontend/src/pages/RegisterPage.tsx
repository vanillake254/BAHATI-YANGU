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
  const [showPassword, setShowPassword] = useState(false)
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 pr-10 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
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

        <div className="mt-8 text-center text-[11px] text-slate-500">
          <p>
            By creating an account, you agree to the{' '}
            <a href="#" className="text-accent hover:text-accentSoft">
              terms and conditions
            </a>
            .
          </p>
          <p className="mt-1">
            <span className="font-semibold text-accent">Powered by Bahati Yangu</span>
          </p>
        </div>
      </div>
    </div>
  )
}
