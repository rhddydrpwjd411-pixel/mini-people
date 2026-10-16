'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiClientError, callApi } from '@/lib/client/api'
import { loadNicknames, saveNicknames } from '@/lib/client/local'
import {
  DEFAULT_ROUNDS,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
} from '@/lib/types'
import { ErrorNotice, NowDo, PrimaryButton, Screen, StepHeader } from '@/components/ui'

const PLAYER_OPTIONS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => MIN_PLAYERS + i,
)
const ROUND_OPTIONS = Array.from({ length: MAX_ROUNDS - MIN_ROUNDS + 1 }, (_, i) => MIN_ROUNDS + i)

export default function SetupPage() {
  const router = useRouter()
  const [playerCount, setPlayerCount] = useState(4)
  const [roundTotal, setRoundTotal] = useState(DEFAULT_ROUNDS)
  const [names, setNames] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 지난 판의 닉네임을 되살린다. 이 값은 이 기기에만 있다.
  useEffect(() => {
    setNames(loadNicknames())
  }, [])

  function setName(slot: number, value: string) {
    setNames((prev) => {
      const next = [...prev]
      while (next.length < slot) next.push('')
      next[slot - 1] = value
      return next
    })
  }

  async function start() {
    setStarting(true)
    setError(null)

    // 🔴 닉네임은 로컬에만 저장하고 요청 바디에 넣지 않는다. (test.md P-3)
    saveNicknames(names.slice(0, playerCount))

    try {
      const { sessionId } = await callApi<{ sessionId: string }>('/api/sessions', {
        method: 'POST',
        body: { playerCount, roundTotal },
      })
      router.push(`/play/${sessionId}`)
    } catch (e) {
      const err = e as ApiClientError
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <Screen>
      <StepHeader title="게임 준비" caption="설정" />
      <NowDo>몇 명이 함께하는지 고르고 시작하세요.</NowDo>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">플레이 인원</h2>
        <div className="grid grid-cols-3 gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPlayerCount(n)}
              aria-pressed={playerCount === n}
              className={[
                'rounded-xl border py-4 text-lg font-semibold transition',
                playerCount === n
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-text',
              ].join(' ')}
            >
              {n}명
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">라운드 수</h2>
        <div className="grid grid-cols-5 gap-2">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRoundTotal(n)}
              aria-pressed={roundTotal === n}
              className={[
                'rounded-xl border py-4 text-lg font-semibold transition',
                roundTotal === n
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-text',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          한 라운드에 10~15분쯤 걸립니다. 처음이면 {DEFAULT_ROUNDS}라운드를 권합니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          이름 <span className="font-normal text-muted">(선택)</span>
        </h2>
        <div className="space-y-2">
          {Array.from({ length: playerCount }, (_, i) => i + 1).map((slot) => (
            <label key={slot} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm text-muted">슬롯 {slot}</span>
              <input
                type="text"
                value={names[slot - 1] ?? ''}
                onChange={(e) => setName(slot, e.target.value)}
                placeholder={`슬롯 ${slot}`}
                maxLength={10}
                className="min-h-12 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          이름은 이 기기에만 저장되고 서버로 보내지 않습니다. 비워두면 &ldquo;슬롯 1&rdquo; 처럼
          번호로 표시됩니다.
        </p>
      </section>

      {error && <ErrorNotice message={error} onRetry={start} />}

      <div className="mt-auto pt-2">
        <PrimaryButton onClick={start} disabled={starting}>
          {starting ? '시작하는 중…' : '첫 라운드 시작'}
        </PrimaryButton>
      </div>
    </Screen>
  )
}
