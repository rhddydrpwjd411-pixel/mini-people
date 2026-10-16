# stack.md — 마지막 광장

> Tech Stack Reference — 고정 스택 · 명령어 · 환경변수
> 최종 수정: 2026-10-16

**이 스택은 고정이다.** 추가·교체는 `CLAUDE.md` "확인 후 진행"에 따라 먼저 물어본다. 결정 이유는 `adr.md`.

---

## 1. 스택 전체

| 레이어 | 선택 | 버전 | 비고 |
|---|---|---|---|
| 런타임 | Node.js | 20 LTS 이상 | Vercel 기본과 맞춤 |
| 프레임워크 | **Next.js** (App Router) | 15.x | Route Handler로 서버 로직 |
| 언어 | **TypeScript** | 5.x | `strict: true` |
| 스타일 | **Tailwind CSS** | 4.x | 별도 UI 라이브러리 없음 |
| DB | **Supabase** (Postgres) | — | RLS 전면 거부 |
| DB 클라이언트 | `@supabase/supabase-js` | 2.x | ORM 안 씀 (테이블 8개) |
| 배포 | **Vercel** | — | Preview 배포로 플레이테스트 공유 |
| 배치 | **Vercel Cron** | — | 주 1회 카드 생성 |
| AI | **Claude API** | `claude-sonnet-5` | `@anthropic-ai/sdk` |
| QR 생성 | `qrcode` | — | 스캔은 기기 기본 카메라 |
| 테스트 | **Vitest** | 3.x | `lib/game/*` 단위 테스트 |
| E2E (선택) | Playwright | — | 여유 있을 때만 |

### 안 쓰는 것 (의도적)

| 안 씀 | 이유 |
|---|---|
| Supabase Auth · NextAuth | 로그인 없음 (민감정보 + 참여 문턱) |
| Supabase Realtime | 단일 기기 — 동기화 불필요 |
| Prisma · Drizzle | 테이블 8개. `supabase-js`로 충분 |
| Zustand · Redux | 서버가 상태를 들고 화면은 순차 전환. `useState`로 충분 |
| shadcn/ui · MUI | 화면 6개. Tailwind 직접 |
| Framer Motion | 엔딩 연출은 CSS |
| i18n | 국내 2030 대상 |

> 라이브러리를 추가하기 전에 `design.md` §10을 본다. 위 목록에 있으면 먼저 물어본다.

---

## 2. 명령어

```bash
npm install            # 의존성
npm run dev            # 로컬 개발 (http://localhost:3000)
npm run build          # 프로덕션 빌드
npm test               # Vitest 단위 테스트
npm run test:watch     # 감시 모드 (룰 조정할 때)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
```

### 마이그레이션

```bash
supabase migration new <name>      # 새 마이그레이션 파일
supabase db push                   # 원격에 적용
supabase db reset                  # 로컬 초기화 + seed 재적용
```

### 배포

```bash
git push                # main → Vercel 프로덕션 자동 배포
                        # 그 외 브랜치 → Preview 배포
```

---

## 3. 환경변수

`.env.example`을 복사해 `.env.local`을 만든다. **`.env.local`은 커밋하지 않는다.**

| 키 | 용도 | 노출 |
|---|---|---|
| `SUPABASE_URL` | DB 접속 | 서버 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 읽기·쓰기 (RLS 우회) | 🔴 **서버 전용** |
| `ANTHROPIC_API_KEY` | 카드 생성 · 근거 검색 | 🔴 **서버 전용** |
| `ADMIN_PASSWORD` | `/admin` 검수 화면 | 🔴 **서버 전용** |
| `CRON_SECRET` | Vercel Cron 인증 | 🔴 **서버 전용** |
| `NEXT_PUBLIC_BASE_URL` | QR 코드에 넣을 URL | 공개 (유일) |

> **`NEXT_PUBLIC_` 접두사는 `NEXT_PUBLIC_BASE_URL` 하나뿐이다.** 다른 키에 이 접두사를 붙이면 브라우저 번들에 그대로 들어간다. `test.md` P-2로 검증한다.

### 배포 환경 설정

Vercel 프로젝트 설정 → Environment Variables에 위 6개를 등록한다. Preview·Production 모두.

Cron은 `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/generate-cards", "schedule": "0 3 * * 1" }
  ]
}
```

매주 월요일 03:00 UTC. 핸들러에서 `CRON_SECRET`을 검증한다.

---

## 4. Supabase 사용 규칙

### 접근 경로는 하나뿐

```
브라우저 ──fetch──▶ Next.js Route Handler ──service_role──▶ Supabase
```

- 브라우저에서 `supabase-js`를 import하지 않는다
- `lib/supabase.ts`는 **서버 컴포넌트·Route Handler에서만** import
- RLS는 모든 테이블에 `enable`하고 **정책을 만들지 않는다** (= anon 전면 거부)

```sql
alter table issue_cards enable row level security;
-- policy 없음. service_role만 통과.
```

### 마이그레이션 파일

`supabase/migrations/` 에 순번으로 쌓는다. 적용된 파일은 수정하지 않고 새 파일을 추가한다.

```
0001_init.sql          -- 테이블 8 + enum 3 + RLS
0002_seed_cards.sql    -- 수동 카드 20장
```

---

## 5. Claude API 사용 규칙

### 호출하는 곳은 두 곳뿐

| 위치 | 시점 | 실패 시 |
|---|---|---|
| `lib/prompts/card-generate.ts` | 배치 (주 1회 Cron) | `card_generation_runs.status='failed'` 기록. **플레이 영향 없음** |
| `lib/prompts/evidence.ts` | 사용자 요청 시 | `EVIDENCE_UNAVAILABLE` 반환. **게임 계속** |

🔴 **플레이 경로(세션 생성 → 라운드 → 토큰 → 결과)에는 호출이 없다.** `CLAUDE.md` 절대 금지 1.

### 프롬프트 버전 관리

프롬프트 상수에 버전 문자열을 박고 `card_generation_runs.prompt_version`에 기록한다.

```ts
export const CARD_PROMPT_VERSION = 'card-gen-v1'
```

카드 품질이 바뀌었을 때 원인을 추적하기 위한 것이다. 프롬프트를 고치면 버전을 올리고 `log.md`에 적는다.

### 모델

| 용도 | 모델 |
|---|---|
| 카드 생성 | `claude-sonnet-5` |
| 근거 검색 | `claude-sonnet-5` |

생성은 배치라 품질 우선, 검색은 응답 속도가 중요하다. 검색이 느리면 `claude-haiku-4-5-20251001`로 내리는 것을 검토한다 (`adr.md`에 기록).

---

## 6. 지원 환경

| 환경 | 지원 |
|---|---|
| iOS Safari | ✅ 주 대상 |
| Android Chrome | ✅ 주 대상 |
| 데스크톱 브라우저 | ⬜ 동작하지만 최적화 안 함 |
| 네이티브 앱 | ❌ 범위 밖 |
| Web NFC | ❌ **쓰지 않는다** (iOS 미지원 → QR로 대체, `adr.md` ADR-001) |

플레이테스트와 1차 제품 체크는 **iOS Safari · Android Chrome 2종**에서 한다 (`todo.md` P1 체크리스트).

---

## 7. 디렉터리

```
.
├── CLAUDE.md  brd.md  cps.md  design.md  plan.md  todo.md  test.md
├── stack.md  adr.md  log.md
├── app/
│   ├── page.tsx                  랜딩
│   ├── setup/                    설정
│   ├── play/[sessionId]/         라운드 진행
│   ├── result/[sessionId]/       결과
│   ├── admin/                    검수
│   └── api/                      Route Handlers
├── lib/
│   ├── supabase.ts               서버 전용
│   ├── claude.ts
│   ├── game/                     순수 함수 (stance/draw/score/ending)
│   └── prompts/
├── components/
├── supabase/migrations/
└── vercel.json
```
