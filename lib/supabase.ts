import { createClient } from '@supabase/supabase-js'

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

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env.example 을 참고하세요.`)
  }
  return value
}

export const db = createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
)
