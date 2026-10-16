import { describe, expect, it } from 'vitest'
import {
  computeScores,
  computeTitles,
  totalTokens,
  validateAwardValues,
  validateAwards,
} from './score'
import type { TokenAward } from '@/lib/types'

const award = (fromSlot: number, toSlot: number, count = 1): TokenAward => ({
  fromSlot,
  toSlot,
  count,
})

const bySlot = (scores: ReturnType<typeof computeScores>, slot: number) =>
  scores.find((s) => s.slot === slot)!

describe('computeScores — test.md C-1 ~ C-6', () => {
  it('C-1  기본 집계', () => {
    const scores = computeScores([award(1, 2, 2), award(3, 2, 1)], 4)
    expect(bySlot(scores, 2).received).toBe(3)
    expect(bySlot(scores, 1).given).toBe(2)
    expect(bySlot(scores, 3).given).toBe(1)
  })

  it('C-2  토큰 0개 세션은 전원 0', () => {
    const scores = computeScores([], 4)
    expect(scores).toHaveLength(4)
    for (const s of scores) {
      expect(s).toMatchObject({ received: 0, given: 0, balance: 0 })
    }
  })

  it('C-3  🔴 받기만 한 슬롯의 balance 는 0', () => {
    const scores = computeScores([award(2, 1, 5)], 4)
    const receiverOnly = bySlot(scores, 1)
    expect(receiverOnly.received).toBe(5)
    expect(receiverOnly.given).toBe(0)
    expect(receiverOnly.balance).toBe(0)
  })

  it('C-4  🔴 주고받기 모두 한 슬롯이 받기만 한 슬롯보다 balance 가 높다', () => {
    // 슬롯1: 받기만 (recv 5, given 0)  /  슬롯2: 주고받기 (recv 2, given 3)
    const scores = computeScores([award(2, 1, 5), award(3, 2, 2), award(2, 4, 3)], 4)
    const receiverOnly = bySlot(scores, 1)
    const exchanger = bySlot(scores, 2)

    expect(receiverOnly.received).toBeGreaterThan(exchanger.received)
    expect(exchanger.balance).toBeGreaterThan(receiverOnly.balance)
    expect(exchanger.balance).toBe(2)
  })

  it('C-5  여러 라운드 누적이 라운드 합과 일치', () => {
    const r1 = [award(1, 2), award(2, 3)]
    const r2 = [award(1, 2), award(3, 1, 2)]
    const r3 = [award(2, 1)]
    const all = [...r1, ...r2, ...r3]

    const scores = computeScores(all, 3)
    expect(totalTokens(all)).toBe(6)
    expect(scores.reduce((a, s) => a + s.received, 0)).toBe(6)
    expect(scores.reduce((a, s) => a + s.given, 0)).toBe(6)
    expect(bySlot(scores, 2).received).toBe(2)
  })

  it('C-6  미참여 슬롯도 결과에 0으로 포함된다', () => {
    const scores = computeScores([award(1, 2)], 4)
    expect(scores.map((s) => s.slot)).toEqual([1, 2, 3, 4])
    expect(bySlot(scores, 4)).toMatchObject({ received: 0, given: 0, balance: 0 })
  })
})

describe('computeTitles — test.md C-7 ~ C-10', () => {
  it('C-7  received 최다 → 오늘의 설득자', () => {
    const scores = computeScores([award(2, 1, 3), award(3, 1), award(1, 2)], 3)
    expect(computeTitles(scores).persuader).toEqual([1])
  })

  it('C-8  given 최다 → 열린 귀', () => {
    const scores = computeScores([award(3, 1, 4), award(1, 2)], 3)
    expect(computeTitles(scores).openEar).toEqual([3])
  })

  it('C-9  동점이면 공동 수여', () => {
    const scores = computeScores([award(3, 1, 2), award(3, 2, 2)], 3)
    expect(computeTitles(scores).persuader.sort()).toEqual([1, 2])
  })

  it('C-10  balance 가 전원 0이면 광장의 시민은 없다 (빈 배열)', () => {
    // 슬롯3이 일방적으로 건네기만 한 판 — 아무도 주고받지 않았다
    const scores = computeScores([award(3, 1), award(3, 2)], 3)
    expect(scores.every((s) => s.balance === 0)).toBe(true)
    expect(computeTitles(scores).citizen).toEqual([])
  })

  it('토큰이 아예 없으면 세 칭호 모두 없다', () => {
    const titles = computeTitles(computeScores([], 4))
    expect(titles).toEqual({ persuader: [], openEar: [], citizen: [] })
  })
})

describe('validateAwards — test.md A-6 / A-7', () => {
  it('A-6  자기에게 토큰을 줄 수 없다', () => {
    expect(() => validateAwards([award(2, 2)], 4)).toThrow(/자기에게/)
  })

  it('A-7  인원 밖 슬롯은 거부', () => {
    expect(() => validateAwards([award(1, 7)], 4)).toThrow(/범위/)
    expect(() => validateAwards([award(0, 2)], 4)).toThrow(/범위/)
    expect(() => validateAwards([award(1, 5)], 4)).toThrow(/범위/)
  })

  it('토큰 개수 범위를 벗어나면 거부', () => {
    expect(() => validateAwards([award(1, 2, 0)], 4)).toThrow(/개수/)
    expect(() => validateAwards([award(1, 2, 6)], 4)).toThrow(/개수/)
  })

  it('같은 (보낸 슬롯 → 받은 슬롯) 조합 중복은 거부', () => {
    expect(() => validateAwards([award(1, 2), award(1, 2)], 4)).toThrow(/중복/)
  })

  it('정상 입력은 통과', () => {
    expect(() => validateAwards([award(1, 2, 2), award(2, 1)], 4)).not.toThrow()
  })

  /**
   * 회귀 테스트 — 조합 중복 검사는 한 라운드 안에서만 유효하다.
   * DB 제약도 unique(round_id, from_slot, to_slot) 로 라운드 범위다.
   * 세션 전체 집계에 중복 검사를 걸면 2라운드부터 정상 입력이 거부된다.
   */
  it('여러 라운드에 같은 조합이 반복되는 것은 집계에서 정상', () => {
    const r1 = [award(1, 2)]
    const r2 = [award(1, 2)] // 같은 조합, 다른 라운드

    expect(() => validateAwards(r1, 4)).not.toThrow()
    expect(() => validateAwards(r2, 4)).not.toThrow()
    expect(() => validateAwardValues([...r1, ...r2], 4)).not.toThrow()

    const scores = computeScores([...r1, ...r2], 4)
    expect(bySlot(scores, 2).received).toBe(2)
  })
})
