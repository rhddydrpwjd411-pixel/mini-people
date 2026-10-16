/**
 * 공용 타입.
 *
 * 🔴 플레이어는 `slot`(1~5) 정수로만 식별된다.
 *    닉네임·계정·기기 식별자는 이 파일 어디에도 없다. (CLAUDE.md 절대 금지 2)
 */

// ── 게임 기본 ────────────────────────────────────────────────

/** 라운드마다 무작위 배정되는 입장. 본인 생각이 아니다. */
export type Stance = 'pro' | 'con'

/** 슬롯 번호 → 입장 */
export type StanceMap = Record<number, Stance>

export type CardStatus = 'draft' | 'active' | 'retired' | 'rejected'

export interface IssueCard {
  id: string
  title: string
  body: string | null
  category: string
  proHint: string | null
  conHint: string | null
  status: CardStatus
  useCount: number
}

// ── 토큰 · 점수 ──────────────────────────────────────────────

export interface TokenAward {
  fromSlot: number
  toSlot: number
  count: number
}

export interface PlayerScore {
  slot: number
  /** 받은 토큰 — 설득력 */
  received: number
  /** 건넨 토큰 — 개방성 */
  given: number
  /** min(received, given) — 교류. adr.md ADR-007 */
  balance: number
}

/** 칭호는 승자 1명이 아니라 지표별로 따로 준다. (adr.md ADR-007) */
export interface Titles {
  /** 오늘의 설득자 — received 최다 */
  persuader: number[]
  /** 열린 귀 — given 최다 */
  openEar: number[]
  /** 광장의 시민 — balance 최다 */
  citizen: number[]
}

// ── 엔딩 ─────────────────────────────────────────────────────

export type EndingCode =
  | 'parallel_lines'
  | 'each_others_seat'
  | 'night_of_persuasion'
  | 'the_square'

export const ENDING_LABEL: Record<EndingCode, string> = {
  parallel_lines: '평행선',
  each_others_seat: '서로의 자리',
  night_of_persuasion: '설득의 밤',
  the_square: '광장의 밤',
}

// ── 세션 ─────────────────────────────────────────────────────

export type SessionStatus = 'playing' | 'finished' | 'abandoned'

export interface GameSession {
  id: string
  playerCount: number
  roundTotal: number
  status: SessionStatus
}

export interface SessionRound {
  id: string
  roundNo: number
  card: IssueCard
  stances: StanceMap
  awards: TokenAward[]
}

export interface SessionState {
  session: GameSession
  rounds: SessionRound[]
}

export interface SessionResult {
  scores: PlayerScore[]
  ending: EndingCode
  titles: Titles
  totalTokens: number
}

// ── 규칙 상수 ────────────────────────────────────────────────

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 5
export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 5
export const DEFAULT_ROUNDS = 3
