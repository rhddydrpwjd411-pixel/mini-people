import { handle, readJson, requireInt } from '@/lib/api'
import { assertEnoughCards } from '@/lib/game/draw'
import { countActiveCards } from '@/lib/repo/cards'
import { createSession } from '@/lib/repo/sessions'
import {
  DEFAULT_ROUNDS,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
} from '@/lib/types'

/**
 * 세션 생성. test.md A-1 ~ A-3
 *
 * 카드가 라운드 수보다 적으면 여기서 거부한다. 라운드 중간에 카드가
 * 떨어지는 것보다 시작 전에 막는 쪽이 낫다. (F-4a)
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)

    const playerCount = requireInt(body.playerCount, '플레이 인원', MIN_PLAYERS, MAX_PLAYERS)
    const roundTotal = requireInt(
      body.roundTotal ?? DEFAULT_ROUNDS,
      '라운드 수',
      MIN_ROUNDS,
      MAX_ROUNDS,
    )

    assertEnoughCards(await countActiveCards(), roundTotal)

    return { sessionId: await createSession(playerCount, roundTotal) }
  })
}
