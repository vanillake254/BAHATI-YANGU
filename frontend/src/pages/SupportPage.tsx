import React, { useState, type FormEvent } from 'react'

export const SupportPage: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError('Please fill in all fields.')
      return
    }

    const lines = [
      'BAHATI YANGU SUPPORT',
      '---',
      `Name: ${trimmedName}`,
      `Email: ${trimmedEmail}`,
      `Message: ${trimmedMessage}`,
    ]

    const text = encodeURIComponent(lines.join('\n'))
    const url = `https://wa.me/254792619069?text=${text}`

    window.open(url, '_blank', 'noreferrer')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <h1 className="text-lg font-semibold text-slate-50">Support</h1>
        <p className="mt-1 text-xs text-slate-400">
          Send us a complaint or compliment. When you submit, we will open WhatsApp with a pre-filled message.
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="Tell us what happened..."
              required
            />
          </div>

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent"
          >
            Send on WhatsApp
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          WhatsApp number: <span className="font-mono text-slate-200">+254792619069</span>
        </p>
      </div>
    </div>
  )
}
