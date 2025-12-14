import React, { useEffect, useMemo, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'

type WheelSegment = {
  id: number
  label: string
  color: string
  probability: number
  multiplier: number
  is_high_payout: boolean
  order: number
}

type SpinResult = {
  stake: string
  result_label: string
  multiplier: number
  win_amount: string
  balance: string
}

export const SpinPage: React.FC = () => {
  const { request } = useAuth()
  const [segments, setSegments] = useState<WheelSegment[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [stake, setStake] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [visibleResult, setVisibleResult] = useState<SpinResult | null>(null) // shown after spin ends
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'classic' | 'highroller' | 'turbo'>('classic')
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoadingConfig(true)
      setError(null)
      try {
        const data = await request<WheelSegment[]>({ url: '/api/games/wheel/' })
        setSegments(data)
      } catch (err: any) {
        setError(String(err?.response?.data?.detail || 'Failed to load wheel configuration.'))
      } finally {
        setLoadingConfig(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sliceAngle = useMemo(() => {
    return segments.length > 0 ? 360 / segments.length : 0
  }, [segments.length])

  // Wheel colours are set per-slice directly in the SVG below.

  const spinDuration = useMemo(() => {
    // Create clearly different spin times for each mode
    if (mode === 'highroller') return 6.0 // longest, most dramatic
    if (mode === 'turbo') return 3.5 // fast but still clearly different
    return 2.3 // classic: short and simple
  }, [mode])

  const minStake = useMemo(() => {
    // User request: 20, 100 and 500 as minimums
    if (mode === 'highroller') return 500
    if (mode === 'turbo') return 100
    return 20
  }, [mode])

  const modeDescription = useMemo(() => {
    if (mode === 'highroller') {
      return 'KES 500 minimum. Longer spins with premium visuals and the highest chances of hitting the top multipliers.'
    }
    if (mode === 'turbo') {
      return 'KES 100 minimum. Moderately fast spins with balanced, moderate chances of winning.'
    }
    return 'KES 20 minimum. Quick spins with good winning chances for casual play.'
  }, [mode])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (spinning) return
    setError(null)
    setVisibleResult(null)

    const numericStake = Number(stake)
    if (!numericStake) {
      setError('Enter a stake amount.')
      return
    }
    if (numericStake < minStake) {
      setError(`Minimum stake for this mode is KES ${minStake}.`)
      return
    }

    let latestResult: SpinResult | null = null
    try {
      setSpinning(true)
      const res = await request<SpinResult>({
        url: '/api/games/spin/',
        method: 'POST',
        data: { stake },
      })
      latestResult = res
      const isWin = Number(res.win_amount) > 0
      setCelebrating(isWin)

      if (segments.length && sliceAngle > 0) {
        const idx = Math.max(0, segments.findIndex((s) => s.label === res.result_label))
        const index = idx === -1 ? 0 : idx
        const baseSpins = mode === 'turbo' ? 6 : mode === 'highroller' ? 8 : 7
        // Our SVG paths define each slice from
        //   start = index*sliceAngle - sliceAngle/2
        //   end   = (index+1)*sliceAngle - sliceAngle/2
        // so the true centre of slice `index` is exactly index*sliceAngle.
        const centerAngle = index * sliceAngle
        // Align slice centre with the top pointer (90deg offset from default SVG 0deg at the right)
        const targetAngle = 360 * baseSpins + (360 - (centerAngle + 90))
        setRotation((prev) => prev + (targetAngle - (prev % 360)))
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || 'Spin failed.'))
    } finally {
      // Let the animation finish based on current mode
      setTimeout(() => {
        setSpinning(false)
        if (latestResult) {
          setVisibleResult(latestResult)
        }
        setTimeout(() => setCelebrating(false), 1200)
      }, spinDuration * 1000 + 200)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)] items-center">
      <div className="flex justify-center">
        <div className="relative h-[320px] w-[320px] sm:h-[380px] sm:w-[380px]">
          {celebrating && (
            <div className="pointer-events-none absolute inset-[-40px] z-20 animate-pulse">
              <div className="h-full w-full rounded-full bg-gradient-to-br from-emerald-400/10 via-fuchsia-400/10 to-sky-400/10 blur-2xl" />
            </div>
          )}
          <div
            className={`relative h-full w-full rounded-full border bg-slate-900/90 shadow-[0_0_80px_rgba(56,189,248,0.45)] ${
              mode === 'highroller'
                ? 'border-amber-400/70 shadow-[0_0_90px_rgba(251,191,36,0.5)]'
                : mode === 'turbo'
                  ? 'border-cyan-300/70 shadow-[0_0_90px_rgba(45,212,191,0.55)]'
                  : 'border-white/10'
            }`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${spinDuration}s cubic-bezier(0.12, 0.01, 0.08, 0.99)`
                : 'none',
            }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <radialGradient id="wheel-center" cx="50%" cy="45%" r="65%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="60%" stopColor="#020617" />
                </radialGradient>
              </defs>

              <circle cx="50" cy="50" r="49" fill="url(#wheel-center)" />

              {segments.map((seg, index) => {
                const startAngle = (index * sliceAngle - sliceAngle / 2) * (Math.PI / 180)
                const endAngle = ((index + 1) * sliceAngle - sliceAngle / 2) * (Math.PI / 180)

                const x1 = 50 + 49 * Math.cos(startAngle)
                const y1 = 50 + 49 * Math.sin(startAngle)
                const x2 = 50 + 49 * Math.cos(endAngle)
                const y2 = 50 + 49 * Math.sin(endAngle)

                const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1

                let baseColor = seg.color || '#4f46e5'
                if (mode === 'highroller' && seg.is_high_payout) {
                  baseColor = '#f97316'
                } else if (mode === 'turbo') {
                  baseColor = index % 2 === 0 ? '#22d3ee' : '#a855f7'
                }

                const pathData = [`M 50 50`, `L ${x1} ${y1}`, `A 49 49 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
                const labelAngle = ((index + 0.5) * sliceAngle - sliceAngle / 2) * (Math.PI / 180)
                const labelRadius = 32
                const lx = 50 + labelRadius * Math.cos(labelAngle)
                const ly = 50 + labelRadius * Math.sin(labelAngle)
                const label = seg.label || `${seg.multiplier.toFixed(2).replace(/\.00$/, '')}x`

                return (
                  <g key={seg.id}>
                    <path d={pathData} fill={baseColor} stroke="#020617" strokeWidth="0.4" />
                    <text
                      x={lx}
                      y={ly}
                      fill="#e5e7eb"
                      fontSize="4"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      style={{ fontWeight: 600, textTransform: 'uppercase' }}
                    >
                      {label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          {/* Small sharp pointer at the top */}
          <div className="pointer-events-none absolute left-1/2 top-[-4px] z-40 -translate-x-1/2">
            <div className="h-0 w-0 border-l-[9px] border-r-[9px] border-b-[18px] border-l-transparent border-r-transparent border-b-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.95)]" />
          </div>

          <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20" />
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <h1 className="text-lg font-semibold text-slate-50">Spin &amp; Win</h1>
        <p className="text-xs text-slate-400">
          Place your stake, choose your wheel style, and watch the neon wheel spin up fast then slow to a stop. Results
          are calculated on the server and applied instantly to your wallet.
        </p>

        <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => !spinning && setMode('classic')}
            className={`rounded-2xl border px-3 py-2 text-center transition ${
              mode === 'classic'
                ? 'border-sky-400 bg-sky-500/20 text-sky-100 shadow-glow'
                : 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-sky-400/70'
            }`}
          >
            Classic wheel
          </button>
          <button
            type="button"
            onClick={() => !spinning && setMode('highroller')}
            className={`rounded-2xl border px-3 py-2 text-center transition ${
              mode === 'highroller'
                ? 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-glow'
                : 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-amber-400/80'
            }`}
          >
            High roller
          </button>
          <button
            type="button"
            onClick={() => !spinning && setMode('turbo')}
            className={`rounded-2xl border px-3 py-2 text-center transition ${
              mode === 'turbo'
                ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100 shadow-glow'
                : 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-cyan-300/80'
            }`}
          >
            Turbo spins
          </button>
        </div>

        {loadingConfig && (
          <div className="text-xs text-slate-500">Loading wheel...</div>
        )}
        {!loadingConfig && (
          <div className="text-[11px] text-slate-400">
            {modeDescription}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Stake amount (KES)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder="Enter your stake"
            />
            <p className="mt-1 text-[11px] text-slate-500">Minimum for this mode: KES {minStake.toLocaleString()}</p>
          </div>
          <button
            type="submit"
            disabled={spinning || !segments.length}
            className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {spinning ? 'Spinning...' : 'Spin now'}
          </button>
        </form>

        {visibleResult && (
          <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-3 text-xs">
            <div className="text-slate-200">
              Result:{' '}
              <span className="font-semibold text-emerald-300">{visibleResult.result_label}</span> · Multiplier x
              {visibleResult.multiplier}
            </div>
            <div className="text-slate-300">
              Win amount:{' '}
              <span className={Number(visibleResult.win_amount) > 0 ? 'text-emerald-300' : 'text-slate-300'}>
                {Number(visibleResult.win_amount).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
            <div className="text-slate-400">
              New balance:{' '}
              <span className="font-mono text-slate-100">
                {Number(visibleResult.balance).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </span>
            </div>

            {visibleResult.result_label === 'FREE SPIN' ? (
              <div className="mt-1 text-[11px] text-emerald-200">
                FREE SPIN unlocked! Your last stake has been returned – spin again with the same amount.
              </div>
            ) : Number(visibleResult.win_amount) > 0 ? (
              <div className="mt-1 text-[11px] font-medium text-emerald-300">
                🎉 Congratulations! Great hit – enjoy your winnings and remember to play responsibly.
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">
                No win this time. Luck changes quickly – only spin what you can comfortably afford to lose.
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Bahati Yangu uses a house-profit engine to keep the platform sustainable while still offering exciting
          payouts. Play responsibly.
        </p>
      </div>
    </div>
  )
}
