import { describe, expect, it } from 'vitest'
import { assertEnoughCards, selectCard } from './draw'
import type { CardStatus, IssueCard } from '@/lib/types'

function card(id: string, status: CardStatus = 'active', useCount = 0): IssueCard {
  return {
    id,
    title: `카드 ${id}`,
    body: null,
    category: '테스트',
    proHint: '찬성 실마리',
    conHint: '반대 실마리',
    status,
    useCount,
  }
}

describe('selectCard — test.md D-1 ~ D-4', () => {
  it('D-1  세션 내 같은 카드가 두 번 나오지 않는다 (3라운드)', () => {
    const pool = [card('a'), card('b'), card('c')]
    const used: string[] = []

    for (let round = 0; round < 3; round++) {
      const picked = selectCard(pool, used)
      expect(used).not.toContain(picked.id)
      used.push(picked.id)
    }

    expect(new Set(used).size).toBe(3)
  })

  it('D-2  use_count 가 가장 낮은 카드를 뽑는다', () => {
    const pool = [card('많이쓴', 'active', 9), card('안쓴', 'active', 0), card('조금', 'active', 3)]
    for (let i = 0; i < 50; i++) {
      expect(selectCard(pool).id).toBe('안쓴')
    }
  })

  it('D-3  🔴 active 가 아닌 카드는 절대 뽑히지 않는다', () => {
    const pool = [
      card('draft카드', 'draft', 0),
      card('retired카드', 'retired', 0),
      card('rejected카드', 'rejected', 0),
      card('active카드', 'active', 99), // use_count 가 가장 높아도 이것만 후보
    ]

    for (let i = 0; i < 50; i++) {
      expect(selectCard(pool).id).toBe('active카드')
    }
  })

  it('D-3b 활성 카드가 하나도 없으면 INSUFFICIENT_CARDS', () => {
    const pool = [card('draft카드', 'draft'), card('rejected카드', 'rejected')]
    expect(() => selectCard(pool)).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_CARDS' }),
    )
  })

  it('D-4  후보가 모두 제외되면 INSUFFICIENT_CARDS', () => {
    const pool = [card('a'), card('b')]
    expect(() => selectCard(pool, ['a', 'b'])).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_CARDS' }),
    )
  })

  it('빈 풀도 조용히 넘기지 않고 터뜨린다', () => {
    expect(() => selectCard([])).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_CARDS' }),
    )
  })
})

describe('assertEnoughCards — test.md F-4a', () => {
  it('활성 카드가 라운드 수보다 적으면 거부', () => {
    expect(() => assertEnoughCards(2, 3)).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_CARDS' }),
    )
  })

  it('같거나 많으면 통과', () => {
    expect(() => assertEnoughCards(3, 3)).not.toThrow()
    expect(() => assertEnoughCards(20, 3)).not.toThrow()
  })
})
