import React, { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export const ChangePasswordPage: React.FC = () => {
  const { user, request, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!currentPassword || !newPassword) {
      setError('Both current and new password are required.')
      return
    }

    setSubmitting(true)
    try {
      await request<{ detail: string }>({
        url: '/api/auth/change-password/',
        method: 'POST',
        data: { current_password: currentPassword, new_password: newPassword },
      })
      setMessage('Password updated. You will be logged out and must log in with the new password.')
      setTimeout(() => {
        logout()
      }, 1500)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || err?.response?.data?.new_password?.[0] || 'Unable to change password.'
      setError(String(detail))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-glow">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Change your password</h1>
          <p className="mt-1 text-sm text-slate-400">
            For security, you must set a new password before continuing.
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
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
              Current password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {submitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
