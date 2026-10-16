import { handle, readJson } from '@/lib/api'
import { AppError } from '@/lib/errors'
import { validateAwards } from '@/lib/game/score'
import { findRound, getSessionState, replaceRoundTokens } from '@/lib/repo/sessions'
import type { TokenAward } from '@/lib/types'

/**
 * 토큰 기록. test.md A-6 ~ A-8
 *
 * 🔴 멱등이다. 같은 라운드에 다시 보내면 누적하지 않고 교체한다.
 *    오프라인 모임에서 버튼 두 번 누르기와 재시도는 반드시 일어나고,
 *    누적되면 그 판의 결과가 틀어진다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return handle(async () => {
    const round = await findRound(id)
    const { session } = await getSessionState(round.sessionId)

    if (session.status === 'finished') {
      throw new AppError('SESSION_FINISHED', '이미 끝난 세션의 토큰은 수정할 수 없습니다.')
    }

    const awards = parseAwards((await readJson(request)).awards)
    validateAwards(awards, session.playerCount)

    return { saved: await replaceRoundTokens(id, awards) }
  })
}

function parseAwards(raw: unknown): TokenAward[] {
  if (!Array.isArray(raw)) {
    throw new AppError('INVALID_AWARD', 'awards 는 배열이어야 합니다.')
  }

  return raw.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new AppError('INVALID_AWARD', 'awards 의 각 항목은 객체여야 합니다.')
    }
    const o = item as Record<string, unknown>
    return {
      fromSlot: Number(o.fromSlot),
      toSlot: Number(o.toSlot),
      count: o.count === undefined ? 1 : Number(o.count),
    }
  })
}
