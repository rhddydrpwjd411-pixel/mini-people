import { handle } from '@/lib/api'
import { AppError } from '@/lib/errors'
import { selectCard } from '@/lib/game/draw'
import { assignStances } from '@/lib/game/stance'
import { fetchDrawCandidates } from '@/lib/repo/cards'
import { createRound, getSessionState } from '@/lib/repo/sessions'

/**
 * 라운드 시작. test.md A-4 / A-5
 *
 * 카드 뽑기와 입장 배정을 한 번에 처리한다. DB 쓰기는 create_round_tx 가
 * 트랜잭션으로 묶으므로, 라운드만 생기고 입장이 비는 상태가 없다.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return handle(async () => {
    const { session, rounds } = await getSessionState(id)

    if (session.status === 'finished') {
      throw new AppError('SESSION_FINISHED', '이미 끝난 세션에는 라운드를 추가할 수 없습니다.')
    }

    const roundNo = rounds.length + 1
    if (roundNo > session.roundTotal) {
      throw new AppError(
        'INVALID_INPUT',
        `이 세션은 ${session.roundTotal}라운드까지입니다. 결과를 확인해주세요.`,
      )
    }

    // 세션 안에서 이미 쓴 카드는 제외한다 (test.md D-1)
    const usedCardIds = rounds.map((r) => r.card.id)
    const candidates = await fetchDrawCandidates(usedCardIds)
    const card = selectCard(candidates, usedCardIds)

    // 직전 라운드 배정을 넘겨 입장이 반복되지 않게 한다 (S-5 / S-6)
    const previous = rounds.at(-1)?.stances
    const stances = assignStances(session.playerCount, previous)

    const roundId = await createRound(id, roundNo, card.id, stances)

    return { roundId, roundNo, card, stances }
  })
}
