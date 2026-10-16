import type { ApiResponse, ErrorCode } from '@/lib/errors'

/** 서버가 보낸 에러를 코드까지 보존해 화면이 분기할 수 있게 한다. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * API 호출 래퍼.
 *
 * 네트워크 실패와 서버 에러를 같은 타입으로 던진다. 화면은 code 만 보고
 * 재시도 버튼을 띄울지, 안내만 할지 정한다. (test.md F-2d)
 */
export async function callApi<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiClientError('NETWORK', '네트워크에 연결할 수 없습니다. 다시 시도해주세요.')
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiClientError('INTERNAL', '서버 응답을 읽을 수 없습니다.')
  }

  if (!payload.ok) throw new ApiClientError(payload.error.code, payload.error.message)
  return payload.data
}
