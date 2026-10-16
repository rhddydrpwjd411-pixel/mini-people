import { handle } from '@/lib/api'
import { getSessionState } from '@/lib/repo/sessions'

export const dynamic = 'force-dynamic'

/**
 * 세션 전체 상태. test.md A-11 / A-12
 *
 * 새로고침 복구(F-2a ~ F-2c)가 이 엔드포인트 하나로 동작한다.
 * 화면은 라운드 수와 토큰 입력 여부를 보고 어느 단계였는지 되살린다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handle(() => getSessionState(id))
}
