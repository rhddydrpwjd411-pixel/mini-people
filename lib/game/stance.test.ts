import { describe, expect, it } from 'vitest'
import { assignStances, countStances } from './stance'
import type { StanceMap } from '@/lib/types'

describe('assignStances — test.md S-1 ~ S-8', () => {
  it('S-1  4인은 찬 2 · 반 2', () => {
    expect(countStances(assignStances(4))).toEqual({ pro: 2, con: 2 })
  })

  it('S-2  3인은 2:1 (어느 쪽이든)', () => {
    const { pro, con } = countStances(assignStances(3))
    expect(new Set([pro, con])).toEqual(new Set([2, 1]))
  })

  it('S-3  5인은 3:2 (어느 쪽이든)', () => {
    const { pro, con } = countStances(assignStances(5))
    expect(new Set([pro, con])).toEqual(new Set([3, 2]))
  })

  it('S-4  🔴 한쪽이 0명인 배정이 절대 나오지 않는다 (3~5인 × 1000회)', () => {
    for (const playerCount of [3, 4, 5]) {
      for (let i = 0; i < 1000; i++) {
        const { pro, con } = countStances(assignStances(playerCount))
        expect(pro).toBeGreaterThanOrEqual(1)
        expect(con).toBeGreaterThanOrEqual(1)
        expect(pro + con).toBe(playerCount)
      }
    }
  })

  it('S-5  라운드마다 다수 쪽이 번갈아 바뀐다 (홀수 인원)', () => {
    let previous = assignStances(5)
    for (let round = 0; round < 10; round++) {
      const before = countStances(previous)
      const next = assignStances(5, previous)
      const after = countStances(next)

      // 직전에 많았던 쪽이 이번에는 적은 쪽이 된다
      if (before.pro > before.con) expect(after.pro).toBeLessThan(after.con)
      else expect(after.pro).toBeGreaterThan(after.con)

      previous = next
    }
  })

  it('S-6  직전 라운드와 같은 입장을 받는 비율이 50% 미만', () => {
    for (const playerCount of [3, 4, 5]) {
      let same = 0
      let total = 0
      let previous = assignStances(playerCount)

      for (let round = 0; round < 200; round++) {
        const next = assignStances(playerCount, previous)
        for (let slot = 1; slot <= playerCount; slot++) {
          if (next[slot] === previous[slot]) same++
          total++
        }
        previous = next
      }

      expect(same / total).toBeLessThan(0.5)
    }
  })

  it('S-7  모든 슬롯이 정확히 1회 배정된다 (누락·중복 없음)', () => {
    for (const playerCount of [3, 4, 5]) {
      const map = assignStances(playerCount)
      const keys = Object.keys(map).map(Number).sort((a, b) => a - b)
      expect(keys).toEqual(Array.from({ length: playerCount }, (_, i) => i + 1))
      expect(Object.values(map).every((s) => s === 'pro' || s === 'con')).toBe(true)
    }
  })

  it('S-8  범위 밖 인원은 throw', () => {
    expect(() => assignStances(2)).toThrow()
    expect(() => assignStances(6)).toThrow()
    expect(() => assignStances(0)).toThrow()
    expect(() => assignStances(3.5)).toThrow()
  })

  it('previous 에 빈 값이 섞여 있어도 동작한다', () => {
    const partial: StanceMap = { 1: 'pro' }
    const { pro, con } = countStances(assignStances(4, partial))
    expect(pro).toBe(2)
    expect(con).toBe(2)
  })
})
