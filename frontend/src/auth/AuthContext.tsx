import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import axios from 'axios'

export type User = {
  id: number
  email: string
  mpesa_number: string
  date_joined: string
  is_staff?: boolean
  is_superuser?: boolean
  referral_code?: string
  force_password_change?: boolean
}

export type Tokens = {
  access: string
  refresh: string
}

type AuthState = {
  user: User | null
  tokens: Tokens | null
  loading: boolean
  ageVerified: boolean
}

export type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  register: (payload: { email: string; mpesa_number: string; password: string; referral_code?: string }) => Promise<void>
  logout: () => void
  request: <T = unknown>(config: any) => Promise<T>
  markAgeVerified: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = 'bahati_yangu_auth'

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    loading: true,
    ageVerified: false,
  })

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setState((s) => ({ ...s, loading: false, ageVerified: false }))
      return
    }
    try {
      const parsed: { user: User; tokens: Tokens } = JSON.parse(raw)
      setState({ user: parsed.user, tokens: parsed.tokens, loading: true, ageVerified: false })
      api
        .get<User>('/api/auth/me/', {
          headers: { Authorization: `Bearer ${parsed.tokens.access}` },
        })
        .then((res) => {
          const user = res.data
          setState({ user, tokens: parsed.tokens, loading: false, ageVerified: false })
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens: parsed.tokens }))
        })
        .catch(() => {
          window.localStorage.removeItem(STORAGE_KEY)
          setState({ user: null, tokens: null, loading: false, ageVerified: false })
        })
    } catch {
      setState({ user: null, tokens: null, loading: false, ageVerified: false })
    }
  }, [])

  const refreshUser = useCallback(async () => {
    if (!state.tokens) return
    const res = await api.get<User>('/api/auth/me/', {
      headers: { Authorization: `Bearer ${state.tokens.access}` },
    })
    const user = res.data
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens: state.tokens }))
    setState((s) => ({ ...s, user }))
  }, [state.tokens])

  const persist = (user: User, tokens: Tokens) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }))
    setState({ user, tokens, loading: false, ageVerified: false })
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<Tokens>('/api/auth/login/', { email, password })
    const tokens = res.data
    const me = await api.get<User>('/api/auth/me/', {
      headers: { Authorization: `Bearer ${tokens.access}` },
    })
    persist(me.data, tokens)
  }, [])

  const register = useCallback(
    async (payload: { email: string; mpesa_number: string; password: string; referral_code?: string }) => {
      const res = await api.post<{ user: User; access: string; refresh: string }>(
        '/api/auth/register/',
        payload,
      )
      const tokens: Tokens = { access: res.data.access, refresh: res.data.refresh }
      persist(res.data.user, tokens)
    },
    [],
  )

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    setState({ user: null, tokens: null, loading: false, ageVerified: false })
  }, [])

  const request = useCallback(
    async <T,>(config: any) => {
      if (!state.tokens) {
        throw new Error('Not authenticated')
      }
      const result = await api.request<T>({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${state.tokens.access}`,
        },
      })
      return result.data
    },
    [state.tokens],
  )

  const markAgeVerified = useCallback(() => {
    setState((s) => ({ ...s, ageVerified: true }))
  }, [])

  // Auto logout after 3 minutes of inactivity while logged in.
  useEffect(() => {
    let timeoutId: number | null = null

    const resetTimer = () => {
      if (!state.user || !state.tokens) return
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        logout()
      }, 3 * 60 * 1000)
    }

    const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'mousemove', 'touchstart']

    events.forEach((ev) => window.addEventListener(ev, resetTimer))

    // Start timer immediately if logged in.
    if (state.user && state.tokens) {
      resetTimer()
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      events.forEach((ev) => window.removeEventListener(ev, resetTimer))
    }
  }, [state.user, state.tokens, logout])

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    request,
    markAgeVerified,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
