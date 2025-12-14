import React, { useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'

type PickBoxResult = {
  stake: string
  choice: string
  revealed_label: string
  multiplier: number
  win_amount: string
  balance: string
}

const MIN_STAKE = 20

export const PickBoxPage: React.FC = () => {
  const { request } = useAuth()

  const [stake, setStake] = useState('')
  const [choice, setChoice] = useState<'left' | 'middle' | 'right' | null>(null)
  const [opening, setOpening] = useState(false)
  const [openedBox, setOpenedBox] = useState<'left' | 'middle' | 'right' | null>(null)
  const [result, setResult] = useState<PickBoxResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (opening) return

    setError(null)
    setResult(null)
    setOpenedBox(null)

    const numericStake = Number(stake)
    if (!numericStake) {
      setError('Enter a stake amount.')
      return
    }
    if (numericStake < MIN_STAKE) {
      setError(`Minimum stake is KES ${MIN_STAKE}.`)
      return
    }
    if (!choice) {
      setError('Choose a box first.')
      return
    }

    try {
      setOpening(true)
      const res = await request<PickBoxResult>({
        url: '/api/games/pick-box/',
        method: 'POST',
        data: { stake, choice },
      })

      // Small delay so box opening animation feels real
      setTimeout(() => {
        setOpenedBox(choice)
        setResult(res)
        setOpening(false)
      }, 650)
    } catch (err: any) {
      setOpening(false)
      setError(String(err?.response?.data?.detail || 'Game failed.'))
    }
  }

  const boxClass = (pos: 'left' | 'middle' | 'right') => {
    const isSelected = choice === pos
    const isOpened = openedBox === pos

    return [
      // 3D cube body (front face)
      'relative flex h-36 w-28 cursor-pointer select-none items-end justify-center rounded-2xl border border-amber-700/80 bg-gradient-to-b from-amber-500 via-amber-700 to-amber-900 shadow-[0_26px_50px_rgba(15,23,42,1)] transition-transform duration-300 sm:h-48 sm:w-40 sm:[transform-style:preserve-3d] sm:[transform:rotateX(18deg)_rotateY(-20deg)]',
      isSelected && !isOpened ? 'ring-2 ring-accent shadow-[0_0_50px_rgba(56,189,248,0.95)] scale-105' : '',
      isOpened ? 'translate-y-1' : '',
      opening && isSelected ? 'animate-pulse' : '',
    ].join(' ')
  }

  const lidClass = (pos: 'left' | 'middle' | 'right') => {
    const isOpened = openedBox === pos
    return [
      // Lid acts as the top face of the cube
      'pointer-events-none absolute left-1/2 top-0 h-8 w-28 -translate-x-1/2 rounded-t-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 shadow-[0_14px_24px_rgba(15,23,42,0.9)] transition-transform duration-500 ease-out [transform-origin:bottom_center] sm:h-10 sm:w-40',
      isOpened
        ? '[transform:rotateX(-75deg)_rotateY(-15deg)_translateY(-4px)]'
        : '[transform:rotateX(-20deg)_rotateY(-15deg)_translateY(0px)]',
    ].join(' ')
  }

  const labelForPos = (pos: 'left' | 'middle' | 'right') => {
    if (!result || openedBox !== pos) return '?'
    return result.revealed_label
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)] items-center">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-50">Pick a Box</h1>
          <p className="mt-1 text-xs text-slate-400">
            Three mysterious boxes hide multipliers X0, X1, X2 and X3. Place your stake, choose a box and open it to
            reveal your fate.
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-center gap-4 pt-4 sm:gap-8 sm:pt-6">
          {(['left', 'middle', 'right'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => !opening && setChoice(pos)}
              className="relative flex flex-col items-center gap-2 focus:outline-none touch-manipulation [perspective:1200px]"
            >
              <div className={lidClass(pos)} />
              <div className={boxClass(pos)}>
                {/* Inner glowing compartment (inside cube) */}
                <div className="pointer-events-none absolute inset-x-3 bottom-3 top-12 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-inner sm:inset-x-5 sm:bottom-4 sm:top-16" />
                <div className="pointer-events-none absolute inset-x-4 top-14 h-7 rounded-2xl bg-gradient-to-b from-amber-100/60 via-amber-300/20 to-transparent opacity-90 sm:inset-x-7 sm:top-18 sm:h-9" />
                <span className="relative mb-6 text-2xl font-extrabold text-amber-200 drop-shadow-[0_0_18px_rgba(250,204,21,0.98)] sm:mb-7 sm:text-3xl">
                  {labelForPos(pos)}
                </span>
                {/* Shadow on the table */}
                <div className="pointer-events-none absolute inset-x-4 -bottom-4 h-6 rounded-full bg-black/70 blur-xl sm:inset-x-6 sm:-bottom-5 sm:h-7" />
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-100 shadow-[0_0_18px_rgba(148,163,184,0.25)] sm:text-sm sm:tracking-[0.22em]">
                {pos === 'left' ? 'BOX 1' : pos === 'middle' ? 'BOX 2' : 'BOX 3'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <p className="text-xs text-slate-400">
          Minimum stake is KES 20. Pick a favourite box, lock in your stake and see if tonight is the night you uncover
          a big multiplier.
        </p>

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
              min={MIN_STAKE}
              step={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              placeholder={`Min KES ${MIN_STAKE}`}
            />
            <p className="mt-1 text-[11px] text-slate-500">Tap a box above, then hit Open box.</p>
          </div>

          <button
            type="submit"
            disabled={opening}
            className="mt-1 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accentSoft px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:from-accentSoft hover:to-accent disabled:opacity-60"
          >
            {opening ? 'Opening box...' : 'Open box'}
          </button>
        </form>

        {result && (
          <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-3 text-xs">
            <div className="text-slate-200">
              You picked:
              <span className="ml-1 font-semibold text-emerald-300 uppercase">{result.choice}</span>
            </div>
            <div className="text-slate-200">
              Box revealed:
              <span className="ml-1 font-semibold text-emerald-300">{result.revealed_label}</span> · Multiplier x
              {result.multiplier}
            </div>
            <div className="text-slate-300">
              Win amount:
              <span className={Number(result.win_amount) > 0 ? 'ml-1 text-emerald-300' : 'ml-1 text-slate-300'}>
                {Number(result.win_amount).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </span>
            </div>
            <div className="text-slate-400">
              New balance:
              <span className="ml-1 font-mono text-slate-100">
                {Number(result.balance).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </span>
            </div>

            {Number(result.win_amount) > 0 ? (
              <div className="mt-1 text-[11px] font-medium text-emerald-300">
                🎉 Nice pick! Remember to play responsibly.
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">
                No win this time. X0 is common – only stake what you can afford to lose.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
