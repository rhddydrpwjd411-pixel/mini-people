import { AppError } from '@/lib/errors'
import { range } from './random'
import type { PlayerScore, Titles, TokenAward } from '@/lib/types'

/**
 * 공감 토큰 집계.
 *
 * 🔴 `balance = min(received, given)` 가 이 제품의 설계 의도다. (adr.md ADR-007)
 *
 * 받은 토큰만으로 승자를 뽑으면 **설득당하는 것이 손해**가 된다. 토큰을 건네면
 * 상대 점수가 올라가므로, 합리적인 플레이어는 설득당하지 않으려 한다. 그러면
 * "다른 의견을 안전하게 만나게 한다"는 제품이 정확히 반대 행동을 보상한다.
 *
 * min 을 쓰면 받기만 한 사람과 주기만 한 사람이 모두 낮고, 둘 다 한 사람이 높다.
 * (test.md C-3 / C-4)
 */
export function computeScores(awards: readonly TokenAward[], playerCount: number): PlayerScore[] {
  // 세션 전체(여러 라운드)를 받으므로 조합 중복 검사는 하지 않는다.
  // 같은 (보낸 → 받은) 조합이 라운드마다 반복되는 것은 정상이다.
  validateAwardValues(awards, playerCount)

  // 참여하지 않은 슬롯도 0으로 포함한다. 결과 화면에서 누락되면 안 된다. (C-6)
  return range(1, playerCount).map((slot) => {
    const received = sum(awards.filter((a) => a.toSlot === slot))
    const given = sum(awards.filter((a) => a.fromSlot === slot))
    return { slot, received, given, balance: Math.min(received, given) }
  })
}

export function totalTokens(awards: readonly TokenAward[]): number {
  return sum(awards)
}

/**
 * 칭호. 승자를 단일 점수로 뽑지 않고 지표별로 따로 준다.
 *
 * 지표가 0인 칭호는 수여하지 않는다. 아무도 토큰을 주고받지 않은 판에서
 * '오늘의 설득자'를 억지로 뽑지 않는다. (test.md C-10)
 */
export function computeTitles(scores: readonly PlayerScore[]): Titles {
  return {
    persuader: topSlots(scores, (s) => s.received),
    openEar: topSlots(scores, (s) => s.given),
    citizen: topSlots(scores, (s) => s.balance),
  }
}

function topSlots(scores: readonly PlayerScore[], pick: (s: PlayerScore) => number): number[] {
  const max = Math.max(0, ...scores.map(pick))
  if (max === 0) return []
  return scores.filter((s) => pick(s) === max).map((s) => s.slot)
}

function sum(awards: readonly TokenAward[]): number {
  return awards.reduce((acc, a) => acc + a.count, 0)
}

/**
 * 개별 토큰 값 검증 — 슬롯 범위 · 자기 지급 · 개수.
 * 라운드 경계와 무관하므로 세션 전체 집계에도 쓸 수 있다.
 */
export function validateAwardValues(awards: readonly TokenAward[], playerCount: number): void {
  for (const a of awards) {
    if (!isSlot(a.fromSlot, playerCount) || !isSlot(a.toSlot, playerCount)) {
      throw new AppError(
        'INVALID_AWARD',
        `슬롯 번호가 1~${playerCount} 범위를 벗어났습니다. (${a.fromSlot} → ${a.toSlot})`,
      )
    }
    if (a.fromSlot === a.toSlot) {
      throw new AppError('INVALID_AWARD', '자기에게 토큰을 줄 수 없습니다.')
    }
    if (!Number.isInteger(a.count) || a.count < 1 || a.count > 5) {
      throw new AppError('INVALID_AWARD', `토큰 개수는 1~5 사이여야 합니다. (받은 값: ${a.count})`)
    }
  }
}

/**
 * 한 라운드 분 토큰 입력 검증. API 라우트가 이 함수의 AppError 를 그대로 400 으로 내보낸다.
 * (test.md A-6 / A-7)
 *
 * 조합 중복 검사는 **한 라운드 안에서만** 유효하다. DB 제약도
 * `unique (round_id, from_slot, to_slot)` 로 라운드 범위다. 세션 전체를
 * 집계할 때는 `validateAwardValues` 를 쓴다.
 */
export function validateAwards(awards: readonly TokenAward[], playerCount: number): void {
  validateAwardValues(awards, playerCount)

  const seen = new Set<string>()
  for (const a of awards) {
    const key = `${a.fromSlot}>${a.toSlot}`
    if (seen.has(key)) {
      throw new AppError('INVALID_AWARD', `같은 조합이 중복되었습니다. (${key})`)
    }
    seen.add(key)
  }
}

function isSlot(value: number, playerCount: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= playerCount
}
