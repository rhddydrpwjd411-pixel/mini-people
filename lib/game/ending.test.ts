import { describe, expect, it } from 'vitest'
import { determineEnding } from './ending'
import type { PlayerScore } from '@/lib/types'

/** received · given 배열로 PlayerScore[] 를 만든다. 합이 같아야 현실적인 입력이다. */
function build(received: number[], given: number[]): PlayerScore[] {
  const r = received.reduce((a, b) => a + b, 0)
  const g = given.reduce((a, b) => a + b, 0)
  if (r !== g) throw new Error(`테스트 입력 오류: received 합(${r}) ≠ given 합(${g})`)

  return received.map((rec, i) => ({
    slot: i + 1,
    received: rec,
    given: given[i],
    balance: Math.min(rec, given[i]),
  }))
}

describe('determineEnding — test.md E-1 ~ E-8', () => {
  it('E-1  토큰이 희소하면 평행선 (T < N)', () => {
    const scores = build([3, 0, 0, 0], [0, 1, 1, 1]) // T = 3, N = 4
    expect(determineEnding(scores, 4)).toBe('parallel_lines')
  })

  it('E-2  토큰 0개도 평행선 (0 나눗셈 없음)', () => {
    const scores = build([0, 0, 0, 0], [0, 0, 0, 0])
    expect(determineEnding(scores, 4)).toBe('parallel_lines')
  })

  it('E-3  전원이 주고받으면 서로의 자리', () => {
    const scores = build([2, 2, 2, 2], [2, 2, 2, 2])
    expect(determineEnding(scores, 4)).toBe('each_others_seat')
  })

  it('E-4  🔴 한 명이 독식했어도 전원 교류면 서로의 자리 (판정 순서)', () => {
    // topShare = 6/10 = 0.6 이지만 전원 given ≥ 1 · received ≥ 1
    const scores = build([6, 2, 1, 1], [1, 3, 3, 3])
    expect(Math.max(...scores.map((s) => s.received)) / 10).toBe(0.6)
    expect(determineEnding(scores, 4)).toBe('each_others_seat')
  })

  it('E-5  한 명 독식 + 건네지 않은 사람이 있으면 설득의 밤', () => {
    const scores = build([6, 2, 1, 1], [0, 4, 3, 3]) // 슬롯1이 하나도 안 건넸다
    expect(determineEnding(scores, 4)).toBe('night_of_persuasion')
  })

  it('E-6  그 외는 광장의 밤', () => {
    const scores = build([3, 3, 4, 0], [2, 3, 3, 2]) // topShare 0.4, 슬롯4 received 0
    expect(determineEnding(scores, 4)).toBe('the_square')
  })

  it('E-7  경계: T == N 이면 평행선이 아니다', () => {
    const scores = build([4, 0, 0, 0], [0, 2, 1, 1]) // T = 4, N = 4
    expect(determineEnding(scores, 4)).not.toBe('parallel_lines')
  })

  it('E-8  경계: topShare 가 정확히 0.5 면 설득의 밤', () => {
    const scores = build([5, 3, 1, 1], [0, 4, 3, 3]) // 5/10 = 0.5
    expect(Math.max(...scores.map((s) => s.received)) / 10).toBe(0.5)
    expect(determineEnding(scores, 4)).toBe('night_of_persuasion')
  })

  it('3인 / 5인에서도 판정이 동작한다', () => {
    expect(determineEnding(build([1, 1, 1], [1, 1, 1]), 3)).toBe('each_others_seat')
    expect(determineEnding(build([1, 1, 0, 0, 0], [0, 0, 1, 1, 0]), 5)).toBe('parallel_lines')
  })
})
