import React, { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { CookieBanner } from './CookieBanner'

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth()
  const isAdmin = !!user?.is_staff || !!user?.is_superuser
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <header className="border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to={user ? '/' : '/login'} className="flex items-center gap-2">
            <div className="relative h-9 w-9">
              <img src="/by-logo.svg" alt="BY" className="h-9 w-9" />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-slate-300 uppercase tracking-[0.2em]">Bahati Yangu</div>
              <div className="text-xs text-slate-400">Spin &amp; Predict to Win</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {user && (
              <>
                <div className="hidden sm:flex items-center gap-4">
                  <Link to="/" className="hover:text-accent">
                    Dashboard
                  </Link>
                  <Link to="/#cash" className="hover:text-accent">
                    Cash In/Out
                  </Link>
                  <Link to="/spin" className="hover:text-accent">
                    Spin &amp; Win
                  </Link>
                  <Link to="/predict" className="hover:text-accent">
                    Predict &amp; Win
                  </Link>
                  <Link to="/pick-box" className="hover:text-accent">
                    Pick a Box
                  </Link>
                  <Link to="/profile" className="hover:text-accent">
                    Profile
                  </Link>
                  <Link to="/support" className="hover:text-accent">
                    Support
                  </Link>
                  {isAdmin && (
                    <Link to="/admin/profit" className="hover:text-accent">
                      Admin
                    </Link>
                  )}
                  <Link to="/about" className="hover:text-accent">
                    About
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="sm:hidden rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  Menu
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="hidden sm:inline ml-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-glow hover:bg-slate-100"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>

        {user && mobileOpen && (
          <div className="sm:hidden border-t border-white/5 bg-black/40 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-2 gap-2 text-sm">
              <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Dashboard
              </Link>
              <Link
                to="/#cash"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2"
              >
                Cash In/Out
              </Link>
              <Link to="/spin" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Spin
              </Link>
              <Link to="/predict" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Predict
              </Link>
              <Link to="/pick-box" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Pick a Box
              </Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Profile
              </Link>
              <Link to="/support" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                Support
              </Link>
              {isAdmin && (
                <Link to="/admin/profit" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                  Admin
                </Link>
              )}
              <Link to="/about" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                About
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  logout()
                }}
                className="col-span-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-900"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">{children}</div>
      </main>

      <footer className="border-t border-white/5 bg-black/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
          <div>
            © 2026 Bahati Yangu. All rights reserved.
            <span className="ml-2">
              <Link to="/privacy" className="hover:text-accent">
                Privacy Policy
              </Link>{' '}
              ·{' '}
              <Link to="/cookies" className="hover:text-accent">
                Cookies
              </Link>{' '}
              ·{' '}
              <Link to="/terms" className="hover:text-accent">
                Terms &amp; Conditions
              </Link>
            </span>
          </div>
          <div>
            <span className="font-semibold text-accent">Powered by Bahati Yangu</span>
          </div>
        </div>
        <CookieBanner />
      </footer>
    </div>
  )
}
