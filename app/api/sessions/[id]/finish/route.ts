import { handle } from '@/lib/api'
import { determineEnding } from '@/lib/game/ending'
import { computeScores, computeTitles, totalTokens } from '@/lib/game/score'
import { finishSession, getResult, getSessionState } from '@/lib/repo/sessions'
import type { SessionResult } from '@/lib/types'

/**
 * 세션 종료 · 집계. test.md A-9 / A-10
 *
 * 🔴 두 번 호출해도 같은 결과를 돌려준다. 이미 확정된 결과가 있으면
 *    재계산하지 않고 저장된 것을 그대로 쓴다. 결과 화면을 새로고침할 때마다
 *    엔딩이 바뀌면 신뢰를 잃는다. (F-2c)
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return handle(async () => {
    const existing = await getResult(id)
    if (existing) return existing

    const { session, rounds } = await getSessionState(id)
    const awards = rounds.flatMap((r) => r.awards)

    const scores = computeScores(awards, session.playerCount)
    const result: SessionResult = {
      scores,
      ending: determineEnding(scores, session.playerCount),
      titles: computeTitles(scores),
      totalTokens: totalTokens(awards),
    }

    await finishSession(id, result)

    // 동시에 두 번 호출된 경우 먼저 저장된 쪽이 정답이다.
    return (await getResult(id)) ?? result
  })
}
