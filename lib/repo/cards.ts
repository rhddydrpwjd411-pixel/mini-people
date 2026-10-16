import { AppError } from '@/lib/errors'
import { db } from '@/lib/supabase'
import type { IssueCard } from '@/lib/types'

/** DB row(snake_case) → 앱 타입(camelCase) */
type CardRow = {
  id: string
  title: string
  body: string | null
  category: string
  pro_hint: string | null
  con_hint: string | null
  status: IssueCard['status']
  use_count: number
}

export function toCard(row: CardRow): IssueCard {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    proHint: row.pro_hint,
    conHint: row.con_hint,
    status: row.status,
    useCount: row.use_count,
  }
}

export const CARD_COLUMNS = 'id, title, body, category, pro_hint, con_hint, status, use_count'

export async function countActiveCards(): Promise<number> {
  const { count, error } = await db
    .from('issue_cards')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  if (error) throw new AppError('INTERNAL', `활성 카드 수 조회 실패: ${error.message}`)
  return count ?? 0
}

/**
 * 뽑기 후보를 가져온다. 고르는 일은 `lib/game/draw.ts` 의 순수 함수가 한다.
 * use_count 오름차순으로 정렬해 넘기므로, 카드가 많아져도 앞쪽만 보면 된다.
 */
export async function fetchDrawCandidates(excludeIds: readonly string[]): Promise<IssueCard[]> {
  let query = db
    .from('issue_cards')
    .select(CARD_COLUMNS)
    .eq('status', 'active')
    .order('use_count', { ascending: true })
    .limit(100)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw new AppError('INTERNAL', `카드 조회 실패: ${error.message}`)

  return (data as CardRow[]).map(toCard)
}
