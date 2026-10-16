'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ApiClientError, callApi } from '@/lib/client/api'
import { loadNicknames, slotLabel } from '@/lib/client/local'
import { ENDING_MESSAGE } from '@/lib/game/ending'
import type { SessionResult } from '@/lib/types'
import {
  ErrorNotice,
  Loading,
  PrimaryLink,
  Screen,
  SecondaryButton,
} from '@/components/ui'

export default function ResultPage() {
  const sessionId = String(useParams().sessionId)

  const [result, setResult] = useState<SessionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nicknames, setNicknames] = useState<string[]>([])

  useEffect(() => {
    setNicknames(loadNicknames())
  }, [])

  /**
   * finish 는 멱등이다. 새로고침해도 처음 계산한 엔딩이 그대로 나온다.
   * (test.md A-10 / F-2c)
   */
  const load = useCallback(async () => {
    setError(null)
    try {
      setResult(
        await callApi<SessionResult>(`/api/sessions/${sessionId}/finish`, { method: 'POST' }),
      )
    } catch (e) {
      setError((e as ApiClientError).message)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Screen>
        <ErrorNotice message={error} onRetry={() => void load()} />
      </Screen>
    )
  }

  if (!result) {
    return (
      <Screen>
        <Loading label="집계하는 중…" />
      </Screen>
    )
  }

  const ending = ENDING_MESSAGE[result.ending]
  const name = (slot: number) => slotLabel(slot, nicknames)
  const maxReceived = Math.max(1, ...result.scores.map((s) => s.received))

  return (
    <Screen>
      {/* 엔딩 — '서로의 자리'가 가장 좋은 결과로 보이게 연출한다. (design.md §5) */}
      <section className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent">오늘의 엔딩</p>
        <h1 className="text-3xl font-bold">{ending.label}</h1>
        <p className="text-base leading-relaxed text-muted">{ending.message}</p>
      </section>

      <p className="text-center text-base text-muted">
        오간 토큰 <span className="font-bold text-text">{result.totalTokens}</span>개
      </p>

      {/* 칭호 — 승자 한 명을 뽑지 않는다. 지표별로 따로 준다. (adr.md ADR-007) */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">칭호</h2>
        <TitleRow
          label="오늘의 설득자"
          hint="가장 많이 설득했습니다"
          slots={result.titles.persuader}
          name={name}
        />
        <TitleRow
          label="열린 귀"
          hint="가장 많이 설득당했습니다"
          slots={result.titles.openEar}
          name={name}
        />
        <TitleRow
          label="광장의 시민"
          hint="주고받기를 모두 했습니다"
          slots={result.titles.citizen}
          name={name}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">주고받은 토큰</h2>
        <ul className="space-y-2">
          {result.scores.map((s) => (
            <li key={s.slot} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold">{name(s.slot)}</span>
                <span className="text-sm text-muted">
                  받음 <span className="font-bold text-text">{s.received}</span> · 건넴{' '}
                  <span className="font-bold text-text">{s.given}</span>
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Bar value={s.received} max={maxReceived} className="bg-pro" />
                <Bar value={s.given} max={maxReceived} className="bg-con" />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          위 막대는 받은 토큰, 아래는 건넨 토큰입니다. 설득당하는 것도 점수입니다.
        </p>
      </section>

      <div className="mt-auto space-y-2 pt-2">
        <PrimaryLink href="/setup">한 판 더</PrimaryLink>
        <ShareButton />
      </div>
    </Screen>
  )
}

function TitleRow({
  label,
  hint,
  slots,
  name,
}: {
  label: string
  hint: string
  slots: number[]
  name: (slot: number) => string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-base font-semibold">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <p className="text-right text-base font-bold text-accent">
        {slots.length > 0 ? slots.map(name).join(' · ') : '없음'}
      </p>
    </div>
  )
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.round((value / max) * 100)}%` }}
      />
    </div>
  )
}

/**
 * 결과를 공유한다. 세션 링크가 아니라 게임 입구 링크를 공유한다.
 * 결과 링크를 돌리면 누가 어떤 입장이었는지 되살릴 수 있어서, 공유 대상에서 뺀다.
 */
function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}/`
    try {
      if (navigator.share) {
        await navigator.share({ title: '마지막 광장', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 사용자가 취소했거나 권한이 없으면 아무것도 하지 않는다. */
    }
  }

  return (
    <SecondaryButton onClick={() => void share()}>
      {copied ? '링크를 복사했습니다' : '게임 링크 공유'}
    </SecondaryButton>
  )
}
