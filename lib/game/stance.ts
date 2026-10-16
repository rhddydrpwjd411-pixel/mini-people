import { AppError } from '@/lib/errors'
import { MAX_PLAYERS, MIN_PLAYERS, type StanceMap } from '@/lib/types'
import { range, shuffle, type Rng } from './random'

/**
 * 라운드별 찬/반 입장 무작위 배정.
 *
 * 규칙 (design.md §3)
 *  1. 찬/반을 최대한 균등하게. 홀수 인원이면 한쪽이 1명 많다.
 *  2. 많은 쪽을 라운드마다 번갈아 준다.
 *  3. 같은 플레이어가 직전 라운드와 같은 입장을 받지 않도록 피한다.
 *  4. 🔴 한쪽이 0명이 되는 배정은 금지. 그 라운드는 토론이 성립하지 않는다.
 *
 * 규칙 4가 이 함수의 존재 이유다. 완전 무작위로 돌리면 3인 게임에서
 * 전원 찬성이 나오고, 그 라운드는 게임이 아니게 된다. (test.md S-4)
 *
 * @param previous 직전 라운드 배정. 있으면 규칙 2·3을 적용한다.
 */
export function assignStances(
  playerCount: number,
  previous?: StanceMap,
  rng: Rng = Math.random,
): StanceMap {
  if (
    !Number.isInteger(playerCount) ||
    playerCount < MIN_PLAYERS ||
    playerCount > MAX_PLAYERS
  ) {
    throw new AppError(
      'INVALID_INPUT',
      `플레이 인원은 ${MIN_PLAYERS}~${MAX_PLAYERS}명입니다. (받은 값: ${playerCount})`,
    )
  }

  const slots = range(1, playerCount)
  const proCount = decideProCount(playerCount, previous, rng)

  // 규칙 3: 직전에 'con' 이었던 슬롯을 먼저 'pro' 후보로 올려 입장을 뒤집는다.
  const ordered = previous
    ? [
        ...shuffle(slots.filter((s) => previous[s] === 'con'), rng),
        ...shuffle(slots.filter((s) => previous[s] === undefined), rng),
        ...shuffle(slots.filter((s) => previous[s] === 'pro'), rng),
      ]
    : shuffle(slots, rng)

  const proSlots = new Set(ordered.slice(0, proCount))

  const result: StanceMap = {}
  for (const slot of slots) {
    result[slot] = proSlots.has(slot) ? 'pro' : 'con'
  }

  // 규칙 4 — 방어적 확인. 위 로직이 깨지면 조용히 넘기지 않고 터뜨린다.
  if (proSlots.size === 0 || proSlots.size === playerCount) {
    throw new AppError('INTERNAL', '한쪽 입장이 0명인 배정이 생성되었습니다.')
  }

  return result
}

/** 찬성 쪽 인원수를 정한다. 항상 1 이상 playerCount-1 이하. */
function decideProCount(playerCount: number, previous: StanceMap | undefined, rng: Rng): number {
  const half = Math.floor(playerCount / 2)

  // 짝수 인원이면 균등 분배. '많은 쪽'이 없으므로 교대할 것도 없다.
  if (playerCount % 2 === 0) return half

  if (!previous) {
    // 첫 라운드: 어느 쪽이 많을지 무작위
    return rng() < 0.5 ? half : half + 1
  }

  // 규칙 2: 직전에 많았던 쪽을 이번에는 적은 쪽으로 돌린다.
  const previousProCount = Object.values(previous).filter((s) => s === 'pro').length
  const proWasMajority = previousProCount * 2 > playerCount
  return proWasMajority ? half : half + 1
}

export function countStances(map: StanceMap): { pro: number; con: number } {
  const values = Object.values(map)
  return {
    pro: values.filter((s) => s === 'pro').length,
    con: values.filter((s) => s === 'con').length,
  }
}
