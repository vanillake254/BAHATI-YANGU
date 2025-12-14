import React, { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

const AGE_SUCCESS_KEY = 'bahati_yangu_age_success'

export const AgeGate: React.FC = () => {
  const { markAgeVerified, logout } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'question' | 'dob'>('question')
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const res: number[] = []
    for (let y = now; y >= now - 100; y -= 1) {
      res.push(y)
    }
    return res
  }, [])

  const handleUnderage = (message: string) => {
    setSuccess(null)
    setError(message)
    setTimeout(() => {
      logout()
      navigate('/login', { replace: true })
    }, 1500)
  }

  const onNo = () => {
    handleUnderage('You must be at least 18 years old to use Bahati Yangu. Logging out...')
  }

  const onYes = () => {
    setError(null)
    setSuccess(null)
    setStep('dob')
  }

  const onSubmitDob = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const numericYear = Number(year)
    if (!numericYear) {
      setError('Select your year of birth.')
      return
    }
    const now = new Date()
    const age = now.getFullYear() - numericYear
    if (age < 18) {
      handleUnderage('Based on your year of birth you must be at least 18 to continue. Logging out...')
      return
    }

    sessionStorage.setItem(AGE_SUCCESS_KEY, '1')
    setSuccess('Age verified successfully. Welcome to Bahati Yangu.')
    setTimeout(() => {
      markAgeVerified()
    }, 900)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-glow">
        <h1 className="text-lg font-semibold text-slate-50">Age verification</h1>
        <p className="mt-2 text-xs text-slate-400">
          Bahati Yangu is strictly for players aged 18 years and above. We verify your age every time you sign in to
          protect you and comply with responsible gaming standards.
        </p>

        {error && (
          <div className="mt-3 rounded-2xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-[11px] text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-2xl border border-emerald-500/60 bg-emerald-950/50 px-3 py-2 text-[11px] text-emerald-100">
            {success}
          </div>
        )}

        {step === 'question' ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-slate-200">Are you 18 years old or above?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onYes}
                className="flex-1 rounded-2xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-glow hover:bg-emerald-300"
              >
                Yes, I am 18+
              </button>
              <button
                type="button"
                onClick={onNo}
                className="flex-1 rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-red-400 hover:text-red-200"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmitDob} className="mt-4 space-y-3 text-sm">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Select your year of birth
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-accent focus:ring-2 focus:ring-accent/40"
            >
              <option value="">Year of birth</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="mt-1 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-xs font-semibold text-black shadow-glow hover:from-accentSoft hover:to-accent"
            >
              Confirm age and continue
            </button>
          </form>
        )}

        <p className="mt-4 text-[11px] text-slate-500">
          If you are under 18, you must not use this platform. Providing false information breaches our Terms &amp;
          Conditions and may lead to permanent account closure.
        </p>
      </div>
    </div>
  )
}
