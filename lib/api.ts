import { NextResponse } from 'next/server'
import { AppError, ERROR_STATUS, type ApiResponse, type ErrorCode } from './errors'

/** 모든 API 응답은 이 두 형태 중 하나다. design.md §7 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status })
}

export function fail(code: ErrorCode, message: string) {
  return NextResponse.json<ApiResponse<never>>(
    { ok: false, error: { code, message } },
    { status: ERROR_STATUS[code] },
  )
}

/**
 * 라우트 핸들러 공통 래퍼.
 *
 * AppError 는 코드에 맞는 상태로 변환하고, 그 외 예외는 INTERNAL 로 감싼다.
 * 원본 에러 메시지를 클라이언트에 그대로 내보내지 않는다 (DB 구조 노출 방지).
 */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn())
  } catch (e) {
    if (e instanceof AppError) return fail(e.code, e.message)

    console.error('[api] 처리되지 않은 오류:', e)
    return fail('INTERNAL', '서버에서 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
  }
}

/** 요청 바디를 JSON 으로 읽는다. 본문이 없거나 깨졌으면 빈 객체. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function requireInt(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError('INVALID_INPUT', `${field}: ${min}~${max} 사이의 정수여야 합니다.`)
  }
  return n
}
