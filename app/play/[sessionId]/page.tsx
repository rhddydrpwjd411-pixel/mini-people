'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ApiClientError, callApi } from '@/lib/client/api'
import { loadNicknames, loadPhase, savePhase, slotLabel } from '@/lib/client/local'
import type { SessionState, TokenAward } from '@/lib/types'
import {
  ErrorNotice,
  Loading,
  NowDo,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StanceBadge,
  StepHeader,
} from '@/components/ui'

/** 라운드 안의 단계. DB에는 없고 이 기기에만 저장된다. (lib/client/local.ts) */
type Phase = 'ready' | 'issue' | 'stances' | 'speak' | 'tokens' | 'roundDone'

const MAX_TOKEN_PER_PAIR = 5

export default function PlayPage() {
  const router = useRouter()
  const sessionId = String(useParams().sessionId)

  const [state, setState] = useState<SessionState | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null)
  const [nicknames, setNicknames] = useState<string[]>([])

  useEffect(() => {
    setNicknames(loadNicknames())
  }, [])

  const round = state?.rounds.at(-1) ?? null
  const playerCount = state?.session.playerCount ?? 0
  const slots = useMemo(() => Array.from({ length: playerCount }, (_, i) => i + 1), [playerCount])

  /** 서버 상태를 읽고 어느 단계였는지 되살린다. (test.md F-2a ~ F-2c) */
  const refresh = useCallback(async () => {
    const next = await callApi<SessionState>(`/api/sessions/${sessionId}`)
    setState(next)

    if (next.session.status === 'finished') {
      router.replace(`/result/${sessionId}`)
      return next
    }

    const last = next.rounds.at(-1)
    if (!last) {
      setPhase('ready')
    } else if (last.awards.length > 0) {
      setPhase('roundDone')
      setDraft(toDraft(last.awards))
    } else {
      // 서버는 라운드 단위까지만 복구한다. 라운드 안의 단계는 로컬에서 되살린다.
      const saved = loadPhase(last.id)
      setPhase(isPhase(saved) ? saved : 'issue')
    }
    return next
  }, [router, sessionId])

  useEffect(() => {
    void (async () => {
      try {
        await refresh()
      } catch (e) {
        setError({ message: (e as ApiClientError).message, retry: () => void refresh() })
      }
    })()
  }, [refresh])

  function goPhase(next: Phase) {
    setPhase(next)
    if (round) savePhase(round.id, next)
  }

  async function startRound() {
    setBusy(true)
    setError(null)
    try {
      await callApi(`/api/sessions/${sessionId}/rounds`, { method: 'POST' })
      const next = await refresh()
      const started = next.rounds.at(-1)
      if (started) {
        setPhase('issue')
        savePhase(started.id, 'issue')
      }
      setDraft({})
    } catch (e) {
      setError({ message: (e as ApiClientError).message, retry: () => void startRound() })
    } finally {
      setBusy(false)
    }
  }

  /**
   * 🔴 저장이 실패해도 입력값(draft)을 비우지 않는다. (test.md F-2d)
   *    모임 장소의 와이파이는 불안정하다. 날아가면 그 판을 다시 기억해야 한다.
   */
  async function saveTokens() {
    if (!round) return
    setBusy(true)
    setError(null)
    try {
      await callApi(`/api/rounds/${round.id}/tokens`, {
        method: 'POST',
        body: { awards: toAwards(draft) },
      })
      await refresh()
      goPhase('roundDone')
    } catch (e) {
      setError({ message: (e as ApiClientError).message, retry: () => void saveTokens() })
    } finally {
      setBusy(false)
    }
  }

  function bump(from: number, to: number) {
    const key = `${from}-${to}`
    setDraft((prev) => ({
      ...prev,
      [key]: ((prev[key] ?? 0) + 1) % (MAX_TOKEN_PER_PAIR + 1),
    }))
  }

  if (error && !state) {
    return (
      <Screen>
        <ErrorNotice message={error.message} onRetry={error.retry} />
      </Screen>
    )
  }

  if (!state) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  const { session, rounds } = state
  const isLastRound = rounds.length >= session.roundTotal
  const roundCaption = round ? `${round.roundNo} / ${session.roundTotal} 라운드` : '시작'
  const draftTotal = Object.values(draft).reduce((a, b) => a + b, 0)
  const roundTokenTotal = round ? round.awards.reduce((a, b) => a + b.count, 0) : 0

  return (
    <Screen>
      {phase === 'ready' && (
        <>
          <StepHeader title="첫 라운드를 시작합니다" caption={roundCaption} />
          <NowDo>모두 모여 앉았으면 시작하세요.</NowDo>
          <div className="mt-auto">
            <PrimaryButton onClick={startRound} disabled={busy}>
              {busy ? '카드를 뽑는 중…' : '라운드 시작'}
            </PrimaryButton>
          </div>
        </>
      )}

      {round && phase === 'issue' && (
        <>
          <StepHeader title="오늘의 쟁점" caption={roundCaption} />
          <NowDo>모두 소리 내어 읽고, 다 읽었으면 다음으로.</NowDo>
          <article className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <p className="text-sm font-medium text-accent">{round.card.category}</p>
            <h2 className="text-2xl font-bold leading-snug">{round.card.title}</h2>
            {round.card.body && (
              <p className="text-base leading-relaxed text-muted">{round.card.body}</p>
            )}
          </article>
          <div className="mt-auto">
            <PrimaryButton onClick={() => goPhase('stances')}>입장 받기</PrimaryButton>
          </div>
        </>
      )}

      {round && phase === 'stances' && (
        <>
          <StepHeader title="입장이 정해졌습니다" caption={roundCaption} />
          <NowDo>내 생각이 아니라 받은 역할입니다. 그 입장에서 말하세요.</NowDo>
          <ul className="space-y-2">
            {slots.map((slot) => (
              <li
                key={slot}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-4"
              >
                <span className="text-lg font-semibold">{slotLabel(slot, nicknames)}</span>
                <StanceBadge stance={round.stances[slot]} large />
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <PrimaryButton onClick={() => goPhase('speak')}>이야기 시작</PrimaryButton>
          </div>
        </>
      )}

      {/*
        발언 단계 — 화면이 가장 비어 있어야 하는 곳.
        웹은 대화에 끼어들지 않는다. (cps.md 설계 원칙 3 / test.md T-2)
      */}
      {round && phase === 'speak' && (
        <>
          <StepHeader title="이야기 중" caption={roundCaption} />
          <NowDo>받은 입장에서 이야기하고 반박하세요. 끝나면 토큰을 나눕니다.</NowDo>
          <p className="pt-4 text-center text-lg font-semibold leading-relaxed">
            {round.card.title}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {slots.map((slot) => (
              <span key={slot} className="flex items-center gap-1.5 text-sm text-muted">
                {slotLabel(slot, nicknames)}
                <StanceBadge stance={round.stances[slot]} />
              </span>
            ))}
          </div>
          <div className="mt-auto">
            <PrimaryButton onClick={() => goPhase('tokens')}>공감 토큰 나누기</PrimaryButton>
          </div>
        </>
      )}

      {round && phase === 'tokens' && (
        <>
          <StepHeader title="공감 토큰" caption={roundCaption} />
          <NowDo>설득된 사람이, 설득한 사람을 눌러주세요. 한 번 누를수록 1개씩.</NowDo>
          <div className="space-y-4">
            {slots.map((giver) => (
              <div key={giver} className="space-y-2 rounded-xl border border-border bg-surface p-4">
                <p className="text-base font-semibold">
                  {slotLabel(giver, nicknames)}
                  <span className="font-normal text-muted"> 이(가) 건넨 토큰</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {slots
                    .filter((s) => s !== giver)
                    .map((receiver) => {
                      const count = draft[`${giver}-${receiver}`] ?? 0
                      return (
                        <button
                          key={receiver}
                          type="button"
                          onClick={() => bump(giver, receiver)}
                          className={[
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-base',
                            count > 0
                              ? 'border-accent bg-accent/15 text-accent'
                              : 'border-border bg-surface-2 text-muted',
                          ].join(' ')}
                        >
                          {slotLabel(receiver, nicknames)}
                          <span className="font-bold tabular-nums">{count}</span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm leading-relaxed text-muted">
            이번 라운드 토큰 <span className="font-bold text-text">{draftTotal}</span>개
            <br />
            아무도 설득되지 않았다면 0개로 넘어가도 됩니다.
          </p>

          {error && <ErrorNotice message={error.message} onRetry={error.retry} />}

          <div className="mt-auto space-y-2">
            <PrimaryButton onClick={saveTokens} disabled={busy}>
              {busy ? '저장 중…' : '저장하고 라운드 마치기'}
            </PrimaryButton>
            <SecondaryButton onClick={() => setDraft({})} disabled={busy}>
              모두 지우기
            </SecondaryButton>
          </div>
        </>
      )}

      {round && phase === 'roundDone' && (
        <>
          <StepHeader title={`${round.roundNo}라운드 끝`} caption={roundCaption} />
          <NowDo>
            {isLastRound
              ? '마지막 라운드였습니다. 결과를 확인하세요.'
              : '다음 쟁점으로 넘어갑니다.'}
          </NowDo>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{round.card.category}</p>
            <p className="mt-1 text-lg font-semibold leading-snug">{round.card.title}</p>
            <p className="mt-3 text-base text-muted">
              오간 토큰 <span className="font-bold text-text">{roundTokenTotal}</span>개
            </p>
          </div>

          {error && <ErrorNotice message={error.message} onRetry={error.retry} />}

          <div className="mt-auto space-y-2">
            {isLastRound ? (
              <PrimaryButton onClick={() => router.push(`/result/${sessionId}`)}>
                결과 보기
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={startRound} disabled={busy}>
                {busy ? '카드를 뽑는 중…' : `${round.roundNo + 1}라운드 시작`}
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => goPhase('tokens')} disabled={busy}>
              토큰 다시 입력
            </SecondaryButton>
          </div>
        </>
      )}
    </Screen>
  )
}

function isPhase(value: string | null): value is Phase {
  return (
    value === 'ready' ||
    value === 'issue' ||
    value === 'stances' ||
    value === 'speak' ||
    value === 'tokens' ||
    value === 'roundDone'
  )
}

function toDraft(awards: readonly TokenAward[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of awards) out[`${a.fromSlot}-${a.toSlot}`] = a.count
  return out
}

function toAwards(draft: Record<string, number>): TokenAward[] {
  return Object.entries(draft)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const [from, to] = key.split('-').map(Number)
      return { fromSlot: from, toSlot: to, count }
    })
}
