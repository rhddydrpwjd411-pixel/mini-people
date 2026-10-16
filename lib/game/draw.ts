import { AppError } from '@/lib/errors'
import { shuffle, type Rng } from './random'
import type { IssueCard } from '@/lib/types'

/**
 * 이슈 카드 뽑기 (순수 함수).
 *
 * DB 질의는 하지 않는다. 호출자가 후보 카드를 넘기고, 여기서 고른다.
 * 덕분에 D-1 ~ D-4 를 DB 없이 테스트할 수 있다.
 *
 * 규칙
 *  1. 🔴 status === 'active' 만 뽑는다. 검수를 통과하지 않은 카드를 플레이어에게
 *     노출하면 중립성 안전장치가 무너진다. (test.md D-3 / adr.md ADR-004)
 *  2. 세션 안에서 이미 쓴 카드는 제외한다. (D-1)
 *  3. use_count 가 낮은 카드를 우선해 같은 카드가 반복되는 것을 막는다. (D-2)
 *  4. 뽑을 카드가 없으면 INSUFFICIENT_CARDS 로 터뜨린다.
 *     중복 카드로 조용히 때우지 않는다. (D-4 / CLAUDE.md 코딩 원칙 5)
 */
export function selectCard(
  candidates: readonly IssueCard[],
  excludeIds: readonly string[] = [],
  rng: Rng = Math.random,
): IssueCard {
  const excluded = new Set(excludeIds)
  const pool = candidates.filter((c) => c.status === 'active' && !excluded.has(c.id))

  if (pool.length === 0) {
    throw new AppError(
      'INSUFFICIENT_CARDS',
      '뽑을 수 있는 활성 카드가 없습니다. 라운드 수를 줄이거나 카드를 추가하세요.',
    )
  }

  const minUseCount = Math.min(...pool.map((c) => c.useCount))
  const leastUsed = pool.filter((c) => c.useCount === minUseCount)

  return shuffle(leastUsed, rng)[0]
}

/**
 * 세션을 만들기 전에 카드가 충분한지 확인한다.
 * 라운드 중간에 카드가 떨어지는 것보다 세션 생성을 거부하는 쪽이 낫다. (F-4a)
 */
export function assertEnoughCards(activeCardCount: number, roundTotal: number): void {
  if (activeCardCount < roundTotal) {
    throw new AppError(
      'INSUFFICIENT_CARDS',
      `활성 카드가 ${activeCardCount}장뿐입니다. ${roundTotal}라운드를 하려면 ${roundTotal}장 이상 필요합니다.`,
    )
  }
}
