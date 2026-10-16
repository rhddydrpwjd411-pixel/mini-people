import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AppError } from './errors'

/**
 * 🔴 서버 전용 Supabase 클라이언트.
 *
 * - 이 모듈을 클라이언트 컴포넌트에서 import 하지 않는다.
 *   service_role 키는 RLS를 우회하므로, 번들에 들어가면 DB가 열린다.
 * - 브라우저는 Supabase에 직접 접근하지 않는다. 모든 DB 접근은
 *   Next.js Route Handler 경유. (CLAUDE.md 절대 금지 5 / design.md §1)
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/supabase.ts 는 서버에서만 import 할 수 있습니다.')
}

/**
 * 설정 누락은 런타임 장애가 아니라 개발자 실수다. AppError 로 던져
 * 원인(어떤 변수가 비었는지)이 화면까지 전달되게 한다. 변수 '이름'은
 * 비밀이 아니고 .env.example 에 이미 적혀 있다.
 *
 * 일반 Error 로 던지면 handle() 이 "서버에서 문제가 발생했습니다"로 덮어버려
 * 터미널을 봐야만 원인을 알 수 있다. 첫 세팅에서 가장 자주 밟는 함정이다.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new AppError(
      'CONFIG_MISSING',
      `환경변수 ${name} 가 비어 있습니다. .env.local 을 확인하세요 (.env.example 참고).`,
    )
  }
  return value
}

let cached: SupabaseClient | null = null

function client(): SupabaseClient {
  if (!cached) {
    cached = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

/**
 * 지연 초기화 프록시.
 *
 * 모듈 최상단에서 환경변수를 검사하면 `next build` 가 라우트 모듈을 읽는
 * 단계에서 터진다. 키가 아직 없는 상태로도 빌드는 되어야 하므로, 검사를
 * 실제 DB 호출 시점까지 늦춘다. 호출 시점에 키가 없으면 그때 명확히 실패한다.
 */
export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = client()
    const value = Reflect.get(instance, prop) as unknown
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
