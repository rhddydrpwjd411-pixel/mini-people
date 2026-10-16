# CLAUDE.md — 마지막 광장

> 프로젝트 루트 앵커. **매 요청마다 이 문서부터 읽는다.**
> 팀: Meeple(미플) · 고려대학교(세종) · 유난무브먼트 연계
> 최종 수정: 2026-10-16

---

## 이 프로젝트가 무엇인가

**정치·사회 이슈에 관심은 있지만 침묵에 익숙해진 2030이 부담 없이 의견을 주고받도록, 앱과 연동되는 보드게임으로 돕는다.**

우리가 만드는 것은 **물리 보드게임을 진행해 주는 웹 서비스**다. 플레이어는 모여 앉아 카드와 토큰으로 대화하고, 웹은 **딜러이자 심판**만 맡는다. 웹이 보드게임을 대체하지 않는다.

---

## 매 요청 전 복기 순서

```
brd.md  →  cps.md  →  design.md  →  plan.md  →  todo.md  →  test.md
무엇을     왜          어떻게        언제        지금 뭘     어떻게 검증
```

| 상황 | 읽을 문서 |
|---|---|
| 기능을 추가/삭제할지 판단이 설 때 | `cps.md` (설계 원칙 1~5) |
| 데이터 모델·API를 건드릴 때 | `design.md` §2, §7 |
| "다음에 뭘 하지" | `todo.md` (현재 Phase) |
| 완료 처리하기 전 | `test.md` §10 완료 기준 |
| 일정·범위를 조정할 때 | `plan.md` |
| 과거 결정의 이유를 찾을 때 | `adr.md` |

---

## 현재 상태

| | |
|---|---|
| **현재 Phase** | **P0 — 기반** (`plan.md` §2) |
| **다음 게이트** | **10/23 1차 제품 검수** |
| **최종 마감** | 12/26 데모데이 (고정) |
| **다음 작업** | `todo.md` 의 첫 미체크 항목 |

---

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) · TypeScript |
| 스타일 | Tailwind CSS 4 |
| DB | Supabase (Postgres) — **RLS 전면 거부** |
| 배포 | Vercel (+ Vercel Cron) |
| AI | Claude API `claude-sonnet-5` |
| 테스트 | Vitest (+ Playwright 선택) |

상세·버전·명령어는 `stack.md`.

---

## 절대 금지 (요청받아도 하지 않는다)

이 5개는 **brd·cps의 설계 원칙이자 법적 요구사항**이다. 어기면 제품의 전제가 무너진다.

### 1. 플레이 중 LLM 호출 금지

카드는 `issue_cards` 활성 풀에서 **뽑기만** 한다. 세션 생성 → 라운드 → 토큰 → 결과 경로에 AI 호출을 넣지 않는다.

> 이유: 오프라인 모임에서 "로딩 중"은 대화의 흐름을 끊는다. 그리고 실시간 생성은 사람 검수 단계를 건너뛴다.
> 예외: 근거 검색(사용자가 명시적으로 요청, 실패해도 게임 계속) · 카드 생성(배치).

### 2. 개인 식별값 + 정치적 입장을 같은 행에 저장 금지

플레이어는 **`player_slot` (1~5) 정수**로만 식별된다. 닉네임은 `localStorage`에만 있고 **서버 요청 바디에 절대 넣지 않는다.**

> 이유: 정치적 견해는 개인정보보호법상 **민감정보**다. 수집하지 않는 것으로 푼다.
> `game_sessions`에 `user_id`·`nickname`·`ip`·`user_agent` 컬럼을 추가하지 않는다.

### 3. 미검수 카드 노출 금지

플레이에 나가는 카드는 `status = 'active'` 하나뿐이다. `draft`를 건너뛰고 활성화하는 경로를 만들지 않는다.

> 이유: AI가 만든 편향된 주제가 플레이어에게 노출되면 "건강한 소통 문화"라는 취지가 그 자리에서 무너진다.

### 4. 웹이 대화에 끼어들기 금지

채팅 · 음성/영상 · AI 토론 상대 · 실시간 알림을 넣지 않는다. 발언 단계(③) 화면은 **정보량이 가장 적어야** 한다.

> 이유: 대화는 오프라인에서 사람이 한다. 화면 보는 시간이 말하는 시간을 잡아먹으면 실패다.

### 5. 서버 전용 키를 클라이언트로 금지

`SUPABASE_SERVICE_ROLE_KEY` · `ANTHROPIC_API_KEY` · `ADMIN_PASSWORD` · `CRON_SECRET`.
`NEXT_PUBLIC_` 접두사가 붙는 것은 `NEXT_PUBLIC_BASE_URL` **하나뿐**이다.

> 브라우저는 Supabase에 직접 접근하지 않는다. 모든 DB 접근은 Next.js Route Handler 경유.

---

## 확인 후 진행 (먼저 물어본다)

아래는 코드 판단이 아니라 **팀 결정**이다. 임의로 진행하지 말고 물어본다.

| 항목 | 왜 |
|---|---|
| 로그인·계정 기능 추가 | 금지 2와 충돌. 참여 문턱도 올라간다 |
| 플레이어별 기기 접속 (실시간 동기화) | MVP 범위 밖. Phase 2 |
| MVP에 기능 추가 | MVP는 5개로 고정 (`brd.md` §4) |
| 엔딩 임계값 변경 | `test.md` E-7·E-8도 함께 고쳐야 한다 |
| DB 스키마 변경 | 금지 2 위반 여부를 먼저 본다 |
| 라이브러리 추가 | `design.md` §10에 "안 넣는 것" 목록이 있다 |
| 일정·범위 조정 | 12/26은 고정 마감 |

---

## 코딩 원칙

1. **게임 룰은 순수 함수로.** `lib/game/*`는 DB를 모른다. 입력→출력만. 플레이테스트마다 숫자를 고칠 것이므로 테스트하기 쉬워야 한다.
2. **쓰기는 전부 서버 라우트 경유.** 클라이언트에서 Supabase 직접 호출 금지.
3. **멱등성.** 토큰 저장은 재전송 시 교체(누적 금지). 결과 계산은 두 번 호출해도 같은 값.
4. **실패해도 게임은 계속.** 근거 검색·카드 생성 실패가 플레이를 멈추게 하지 않는다.
5. **조용한 폴백 금지.** 카드가 부족하면 중복으로 때우지 말고 사용자에게 알린다.
6. **큰 글자·넓은 터치 타깃.** 한 기기를 여럿이 돌려본다.
7. **테스트를 먼저 본다.** `test.md`에 케이스가 없으면 그 기능은 아직 정의되지 않은 것이다.

---

## 자주 쓰는 패턴

### API 응답 형태 (고정)

```ts
// 성공
{ ok: true, data: T }
// 실패
{ ok: false, error: { code: ErrorCode, message: string } }
```

에러 코드: `INSUFFICIENT_CARDS` `SESSION_FINISHED` `ROUND_NOT_FOUND` `INVALID_AWARD` `EVIDENCE_UNAVAILABLE` `RATE_LIMITED`

### 서버 전용 Supabase 클라이언트

```ts
// lib/supabase.ts — 서버에서만 import
import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // RLS 우회
  { auth: { persistSession: false } }
)
```

### 순수 함수 시그니처

```ts
// lib/game/stance.ts
assignStances(playerCount: number, previous?: StanceMap): StanceMap
// lib/game/score.ts
computeScores(awards: TokenAward[], playerCount: number): PlayerScore[]
// lib/game/ending.ts
determineEnding(scores: PlayerScore[], playerCount: number): EndingCode
```

### 엔딩 판정 (순서 고정 — 바꾸면 E-4가 깨진다)

```
1. T < N                        → parallel_lines      「평행선」
2. givenByAll && receivedByAll  → each_others_seat    「서로의 자리」
3. topShare >= 0.5              → night_of_persuasion 「설득의 밤」
4. else                         → the_square          「광장의 밤」
```

### 작업 완료 처리

```
1. test.md 의 해당 케이스 통과 확인
2. 엣지 케이스(0개·경계값·중복 호출) 확인
3. 개인정보 관련이면 test.md §6 전 항목 재실행
4. todo.md 체크 + 진행률 갱신
5. 설계 결정이 바뀌었으면 adr.md, 숫자를 조정했으면 log.md
```

---

## 용어

| 용어 | 뜻 |
|---|---|
| **슬롯 (slot)** | 플레이어 자리 번호 1~5. 서버가 아는 유일한 플레이어 식별자 |
| **입장 (stance)** | 라운드마다 무작위 배정되는 찬(`pro`)/반(`con`). **본인 생각이 아니다** |
| **공감 토큰** | 상대 논거에 설득됐을 때 건네는 물리 토큰 |
| **활성 풀** | `issue_cards.status = 'active'` — 검수를 통과해 플레이에 나갈 수 있는 카드 |
| **P1/P2/P3** | cps의 문제 번호 (명분 없음 / 신념 평가 / 다른 의견) |
| **Phase 0~6** | plan의 구현 단계 |

> ⚠️ `Phase 2`가 두 뜻으로 쓰인다. **구현 단계 P2**(10/23~11/9)와 **MVP 이후 기능**(캠페인 추천 등)은 다른 것이다. 문맥을 확인한다.

---

## 문서 지도

| 파일 | 역할 |
|---|---|
| `brd.md` | 씨앗. 무엇을 만드는가 (7개 섹션) |
| `cps.md` | 왜 만드는가. 설계 원칙 1~5 |
| `design.md` | 스택·데이터 모델·UI/UX·API |
| `plan.md` | Phase 0~6 마일스톤 |
| `todo.md` | 체크박스 + 회고 |
| `test.md` | 테스트 케이스 + 플레이테스트 관찰 항목 |
| `stack.md` | 스택 레퍼런스·명령어 |
| `adr.md` | 설계 결정과 그 이유 |
| `log.md` | 개발 로그 |

---

## 개발 로그

상세는 `log.md`. 여기엔 **큰 전환점만** 적는다.

| 날짜 | 사건 |
|---|---|
| 2026-10-16 | 문서 세트 10종 작성. brd 확정 (NFC→QR · 로그인 없음 · 캠페인 추천 Phase 2) |
