import { AppError } from '@/lib/errors'
import { db } from '@/lib/supabase'
import type {
  SessionResult,
  SessionRound,
  SessionState,
  StanceMap,
  TokenAward,
} from '@/lib/types'
import { toCard } from './cards'

export async function createSession(playerCount: number, roundTotal: number): Promise<string> {
  const { data, error } = await db
    .from('game_sessions')
    .insert({ player_count: playerCount, round_total: roundTotal })
    .select('id')
    .single()

  if (error) throw new AppError('INTERNAL', `세션 생성 실패: ${error.message}`)
  return data.id as string
}

/**
 * 세션 전체 상태. 새로고침 복구(test.md F-2a~c)가 이것 하나로 동작한다.
 */
export async function getSessionState(sessionId: string): Promise<SessionState> {
  const { data, error } = await db
    .from('game_sessions')
    .select(
      `
      id, player_count, round_total, status,
      session_rounds (
        id, round_no,
        issue_cards ( id, title, body, category, pro_hint, con_hint, status, use_count ),
        round_stances ( player_slot, stance ),
        token_awards ( from_slot, to_slot, count )
      )
    `,
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', `세션 조회 실패: ${error.message}`)
  if (!data) throw new AppError('SESSION_NOT_FOUND', '세션을 찾을 수 없습니다.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any

  const rounds: SessionRound[] = (raw.session_rounds ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.round_no - b.round_no)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any): SessionRound => {
      const stances: StanceMap = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of r.round_stances ?? []) stances[s.player_slot] = s.stance

      const awards: TokenAward[] = (r.token_awards ?? []).map(
        (a: { from_slot: number; to_slot: number; count: number }): TokenAward => ({
          fromSlot: a.from_slot,
          toSlot: a.to_slot,
          count: a.count,
        }),
      )

      return { id: r.id, roundNo: r.round_no, card: toCard(r.issue_cards), stances, awards }
    })

  return {
    session: {
      id: raw.id,
      playerCount: raw.player_count,
      roundTotal: raw.round_total,
      status: raw.status,
    },
    rounds,
  }
}

/** 라운드 생성 — 라운드 + 입장 배정 + use_count 증가를 한 트랜잭션으로 (0003_tx_functions.sql) */
export async function createRound(
  sessionId: string,
  roundNo: number,
  cardId: string,
  stances: StanceMap,
): Promise<string> {
  const payload = Object.entries(stances).map(([slot, stance]) => ({
    slot: Number(slot),
    stance,
  }))

  const { data, error } = await db.rpc('create_round_tx', {
    p_session_id: sessionId,
    p_round_no: roundNo,
    p_card_id: cardId,
    p_stances: payload,
  })

  if (error) throw new AppError('INTERNAL', `라운드 생성 실패: ${error.message}`)
  return data as string
}

/** 🔴 멱등. 재호출 시 누적이 아니라 교체. test.md A-8 */
export async function replaceRoundTokens(
  roundId: string,
  awards: readonly TokenAward[],
): Promise<number> {
  const { data, error } = await db.rpc('replace_round_tokens', {
    p_round_id: roundId,
    p_awards: awards,
  })

  if (error) throw new AppError('INTERNAL', `토큰 저장 실패: ${error.message}`)
  return data as number
}

export async function findRound(
  roundId: string,
): Promise<{ id: string; sessionId: string; roundNo: number }> {
  const { data, error } = await db
    .from('session_rounds')
    .select('id, session_id, round_no')
    .eq('id', roundId)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', `라운드 조회 실패: ${error.message}`)
  if (!data) throw new AppError('ROUND_NOT_FOUND', '라운드를 찾을 수 없습니다.')

  return { id: data.id, sessionId: data.session_id, roundNo: data.round_no }
}

/** 🔴 멱등. 이미 확정된 결과가 있으면 그것을 그대로 쓴다. test.md A-10 */
export async function finishSession(sessionId: string, result: SessionResult): Promise<void> {
  const { error } = await db.rpc('finish_session_tx', {
    p_session_id: sessionId,
    p_scores: result.scores,
    p_ending_code: result.ending,
    p_titles: result.titles,
    p_total: result.totalTokens,
  })

  if (error) throw new AppError('INTERNAL', `결과 저장 실패: ${error.message}`)
}

export async function getResult(sessionId: string): Promise<SessionResult | null> {
  const { data, error } = await db
    .from('session_results')
    .select('scores, ending_code, titles, total_tokens')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', `결과 조회 실패: ${error.message}`)
  if (!data) return null

  return {
    scores: data.scores,
    ending: data.ending_code,
    titles: data.titles,
    totalTokens: data.total_tokens,
  }
}
