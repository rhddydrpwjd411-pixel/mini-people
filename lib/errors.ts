/** API 에러 코드. design.md §7 */
export type ErrorCode =
  | 'INSUFFICIENT_CARDS'
  | 'SESSION_FINISHED'
  | 'SESSION_NOT_FOUND'
  | 'ROUND_NOT_FOUND'
  | 'INVALID_AWARD'
  | 'INVALID_INPUT'
  | 'EVIDENCE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'CONFIG_MISSING'
  | 'INTERNAL'

export const ERROR_STATUS: Record<ErrorCode, number> = {
  INSUFFICIENT_CARDS: 409,
  SESSION_FINISHED: 409,
  SESSION_NOT_FOUND: 404,
  ROUND_NOT_FOUND: 404,
  INVALID_AWARD: 400,
  INVALID_INPUT: 400,
  EVIDENCE_UNAVAILABLE: 200, // 게임 흐름을 멈추지 않는다 (test.md A-13)
  RATE_LIMITED: 429,
  UNAUTHORIZED: 401,
  CONFIG_MISSING: 500,
  INTERNAL: 500,
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } }
