import React, { useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'

type PredictResult = {
  stake: string
  prediction: string
  outcome: string
  is_win: boolean
  multiplier: number
  win_amount: string
  balance: string
}

export const PredictPage: React.FC = () => {
  const { request } = useAuth()
  const [prediction, setPrediction] = useState<'red' | 'black' | ''>('')
  const [stake, setStake] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [visibleResult, setVisibleResult] = useState<PredictResult | null>(null)
  const [spinningBoard, setSpinningBoard] = useState(false)
  const [revealedOutcome, setRevealedOutcome] = useState<'red' | 'black' | ''>('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setVisibleResult(null)
    setRevealedOutcome('')

    if (!prediction) {
      setError('Choose red or black to place a prediction.')
      return
    }
    if (!stake) {
      setError('Enter a stake amount.')
      return
    }

    try {
      setSubmitting(true)
      setSpinningBoard(true)
      const res = await request<PredictResult>({
        url: '/api/games/predict/',
        method: 'POST',
        data: { stake, prediction },
      })
      // Delay reveal so the board can "spin" first
      setTimeout(() => {
        setRevealedOutcome(res.outcome as 'red' | 'black')
        setVisibleResult(res)
        setSpinningBoard(false)
        setSubmitting(false)
      }, 900)
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || 'Prediction failed.'))
      setSpinningBoard(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr),minmax(0,2.8fr)] items-center">
      <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <h1 className="text-lg font-semibold text-slate-50">Predict &amp; Win</h1>
        <p className="text-xs text-slate-400">
          Choose a colour, place your stake, and let the server decide the winning side. Results are instant and
          transparently applied to your wallet.
        </p>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPrediction('red')}
              className={`flex h-12 flex-row items-center justify-center rounded-full border text-xs font-semibold shadow-glow transition px-3 ${
                prediction === 'red'
                  ? 'border-red-400 bg-gradient-to-r from-red-600 to-red-800 text-slate-50'
                  : 'border-white/10 bg-gradient-to-r from-red-600/40 to-slate-950 text-slate-100 hover:border-red-400/80'
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-red-100/90">Red</span>
            </button>
            <button
              type="button"
              onClick={() => setPrediction('black')}
              className={`flex h-12 flex-row items-center justify-center rounded-full border text-xs font-semibold shadow-glow transition px-3 ${
                prediction === 'black'
                  ? 'border-slate-200 bg-gradient-to-r from-slate-700 to-black text-slate-50'
                  : 'border-white/10 bg-gradient-to-r from-slate-900 to-black text-slate-100 hover:border-slate-200/70'
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-200/90">Black</span>
            </button>
          </div>

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
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-glow transition hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-60"
          >
            {submitting ? 'Placing prediction...' : 'Place prediction'}
          </button>
        </form>

        {visibleResult && (
          <div className="space-y-1 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-3 text-xs">
            <div className="text-slate-200">
              Outcome:{' '}
              <span className="font-semibold text-emerald-300">{visibleResult.outcome.toUpperCase()}</span>{' '}
              {visibleResult.is_win ? '· You won!' : '· You lost this round.'}
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
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-xs text-slate-300">
        <div className="flex flex-col items-center gap-4">
          {/* Always-visible board; it only spins and reveals outcome after a prediction. */}
          <div className="relative h-40 w-40">
            <div
              className={`absolute inset-0 rounded-full border border-white/20 bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.9)] transition-transform duration-700 ${
                spinningBoard ? 'animate-spin' : ''
              }`}
            >
              <div className="absolute inset-[6px] flex rounded-full border border-slate-800 bg-slate-950">
                <div className="flex-1 rounded-l-full bg-gradient-to-br from-red-600 to-red-900" />
                <div className="flex-1 rounded-r-full bg-gradient-to-br from-slate-700 to-black" />
              </div>
            </div>

            {/* Reveal badge */}
            {revealedOutcome && !spinningBoard && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/80 px-4 py-1 text-xs font-semibold tracking-[0.16em] text-slate-50">
                  {revealedOutcome.toUpperCase()} WINS
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] text-slate-400">
            Pick your colour using the small chips, tap{' '}
            <span className="font-semibold text-slate-100">Place prediction</span>, and the board will spin before
            revealing the winning side.
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-400">
          <h2 className="mb-1 text-xs font-semibold text-slate-100">Game rules &amp; fairness</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Each round randomly selects RED or BLACK on the server with equal probability.</li>
            <li>Winning predictions pay out x1.8 of your stake, keeping a house edge to protect investors.</li>
            <li>All results are logged with timestamps for transparency and dispute review.</li>
            <li>The profit engine monitors overall performance so long-term platform profit stays healthy.</li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Play responsibly. Only stake what you can afford to lose.</p>
        </div>
      </div>
    </div>
  )
}
