import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'bahati_yangu_cookies_accepted'

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = window.localStorage.getItem(STORAGE_KEY)
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  return (
    <div className="border-t border-white/10 bg-slate-950/95 text-xs text-slate-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <p>
          Bahati Yangu uses cookies to keep you signed in, secure your account, and understand basic usage.
          By continuing to use this site, you agree to our cookie policy.
        </p>
        <button
          type="button"
          onClick={accept}
          className="whitespace-nowrap rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black shadow-glow hover:bg-accentSoft"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
