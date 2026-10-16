# design.md — 마지막 광장

> Application Design — 기술 스택 · 데이터 모델 · UI/UX · API
> 입력: `cps.md`
> 최종 수정: 2026-10-16

cps의 솔루션을 시스템으로 번역한다. cps §5가 넘긴 6개 제약을 전부 지킨다.

---

## 0. 설계를 지배하는 제약 (cps §5)

| # | 제약 | 이 문서에서의 구현 |
|---|---|---|
| 1 | 플레이 중 LLM 호출 금지 | 카드는 `issue_cards` 활성 풀에서 뽑는다. 플레이 경로에 AI 호출 없음 |
| 2 | 개인 식별값 + 정치적 입장 동시 저장 금지 | 플레이어는 `player_slot`(1~5) 정수뿐. 닉네임은 서버로 전송하지 않음 |
| 3 | 단일 기기 / 실시간 동기화 없음 | 세션 상태는 서버가 들고, 한 기기가 순차 요청. Realtime 미사용 |
| 4 | 카드 3단계 (생성 → 검수 → 활성) | `issue_cards.status` enum + `/admin/cards` 검수 화면 |
| 5 | QR 진입, 로그인 없음 | 인증 없음. 쓰기는 전부 서버 라우트 경유 |
| 6 | 엔딩이 "설득당함·교류"를 좋게 평가 | §5 엔딩 판정식 + 칭호 `열린 귀` |

---

## 1. 기술 스택

| 레이어 | 선택 | 버전/비고 |
|---|---|---|
| 프레임워크 | **Next.js** (App Router) | 15.x, TypeScript |
| 스타일 | **Tailwind CSS** | 4.x |
| DB | **Supabase** (Postgres) | RLS로 익명 접근 전면 차단 |
| 배포 | **Vercel** | Preview 배포로 플레이테스트 공유 |
| 배치 | **Vercel Cron** | 주 1회 카드 생성 |
| AI | **Claude API** | `claude-sonnet-5` (카드 생성 · 근거 검색) |
| QR | `qrcode` (생성) | 스캔은 기기 기본 카메라 — 앱 내 스캐너 불필요 |
| 결제 | **없음** | 수익화 범위 밖 |

### 왜 클라이언트에서 DB를 직접 안 쓰는가

로그인이 없으므로 Supabase `anon` 키로 직접 쓰기를 허용하면 **누구나 아무 데이터나 쓸 수 있다.** 그래서:

```
브라우저 ──(fetch)──▶ Next.js Route Handler ──(service_role)──▶ Supabase
                         서버 전용 키
```

- `issue_cards`를 포함한 **모든 테이블의 RLS는 anon에 대해 전면 거부**
- 브라우저는 Supabase에 직접 접근하지 않는다. `NEXT_PUBLIC_SUPABASE_*` 키를 노출할 필요가 없다
- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`는 서버 환경변수로만 존재

### 디렉터리 구조

```
app/
  page.tsx                      # 랜딩 (QR 진입점)
  setup/page.tsx                # 인원·라운드 설정
  play/[sessionId]/page.tsx     # 라운드 진행
  result/[sessionId]/page.tsx   # 점수·엔딩
  admin/
    page.tsx                    # 비밀번호 입력
    cards/page.tsx              # 검수 큐
  api/
    sessions/route.ts                   # POST 세션 생성
    sessions/[id]/route.ts              # GET 상태
    sessions/[id]/rounds/route.ts       # POST 라운드 시작
    sessions/[id]/finish/route.ts       # POST 종료·집계
    rounds/[id]/tokens/route.ts         # POST 토큰 기록
    evidence/route.ts                   # POST 근거 검색
    admin/login/route.ts
    admin/cards/route.ts                # GET 검수 큐
    admin/cards/[id]/route.ts           # PATCH 승인·반려
    cron/generate-cards/route.ts        # GET Vercel Cron
lib/
  supabase.ts        # service_role 클라이언트 (서버 전용)
  claude.ts          # Anthropic SDK 래퍼
  game/
    draw.ts          # 카드 뽑기 (중복 방지)
    stance.ts        # 입장 무작위 배정
    score.ts         # 점수 집계
    ending.ts        # 엔딩 판정
  prompts/
    card-generate.ts
    evidence.ts
components/
  ...
supabase/migrations/
```

> `lib/game/*`는 **순수 함수**로 짠다. DB를 모르고 입력→출력만 한다. 룰 밸런스를 플레이테스트에서 자주 고칠 것이므로 테스트하기 쉬워야 한다 (`test.md` 참고).

---

## 2. 데이터 모델

### ERD

```
issue_cards ─────┐
                 │ (1:N)
card_generation_runs
                 │
game_sessions ──▶ session_rounds ──▶ round_stances
                 │        │
                 │        └────────▶ token_awards
                 └────────────────▶ session_results
                                    evidence_queries
```

### 테이블

#### `issue_cards` — 이슈 카드 풀

```sql
create type card_status as enum ('draft', 'active', 'retired', 'rejected');

create table issue_cards (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,              -- 카드 앞면 질문 (한 문장)
  body          text,                       -- 상황 설명 2~3문장
  category      text not null,              -- 노동/주거/교육/환경/기술 등
  pro_hint      text,                       -- 찬성 쪽 논거 실마리
  con_hint      text,                       -- 반대 쪽 논거 실마리
  status        card_status not null default 'draft',
  generation_run_id uuid references card_generation_runs(id),
  reviewed_by   text,                       -- 검수자 이름 (조원)
  reviewed_at   timestamptz,
  review_note   text,                       -- 반려 사유
  use_count     int not null default 0,      -- 뽑힌 횟수 (균등 노출용)
  created_at    timestamptz not null default now()
);

create index on issue_cards (status, use_count);
```

- `pro_hint` / `con_hint`가 **중립성 검수의 핵심**이다. 양쪽 실마리가 모두 그럴듯하게 써지지 않는 주제는 토론이 아니므로 반려한다 (cps §3)
- `use_count`로 덜 쓴 카드를 우선 노출해 같은 카드가 반복되는 것을 막는다

#### `card_generation_runs` — 생성 이력

```sql
create table card_generation_runs (
  id             uuid primary key default gen_random_uuid(),
  model          text not null,
  prompt_version text not null,
  requested      int not null,
  produced       int not null default 0,
  status         text not null default 'running',  -- running/succeeded/failed
  error_message  text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);
```

생성이 실패해도 **플레이에는 영향이 없다** (활성 풀이 이미 있으므로). 실패를 조용히 삼키지 않고 기록만 남긴다.

#### `game_sessions` — 플레이 세션

```sql
create table game_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_count int not null check (player_count between 3 and 5),
  round_total  int not null default 3 check (round_total between 1 and 5),
  status       text not null default 'playing',   -- playing/finished/abandoned
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
```

**없는 컬럼에 주의**: `user_id`, `nickname`, `ip`, `device_id`, `user_agent` 없음. 설계 원칙 5(cps)에 따라 개인을 식별할 수 있는 어떤 값도 넣지 않는다.

#### `session_rounds` / `round_stances` / `token_awards`

```sql
create table session_rounds (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  round_no   int not null,
  issue_card_id uuid not null references issue_cards(id),
  created_at timestamptz not null default now(),
  unique (session_id, round_no)
);

create type stance as enum ('pro', 'con');

create table round_stances (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references session_rounds(id) on delete cascade,
  player_slot int not null check (player_slot between 1 and 5),
  stance      stance not null,
  unique (round_id, player_slot)
);

create table token_awards (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references session_rounds(id) on delete cascade,
  from_slot   int not null check (from_slot between 1 and 5),
  to_slot     int not null check (to_slot between 1 and 5),
  count       int not null default 1 check (count between 1 and 5),
  created_at  timestamptz not null default now(),
  check (from_slot <> to_slot),            -- 자기에게 못 준다
  unique (round_id, from_slot, to_slot)
);
```

`round_stances`가 저장하는 것은 **"슬롯 3이 이 라운드에 찬성 입장을 받았다"** 뿐이다. 슬롯 3이 누구인지는 어디에도 없고, 그 입장은 **본인 생각이 아니라 무작위 배정 결과**다. 이중으로 민감정보가 아니다.

#### `session_results`

```sql
create table session_results (
  session_id  uuid primary key references game_sessions(id) on delete cascade,
  scores      jsonb not null,   -- [{slot, received, given, balance}]
  ending_code text not null,    -- parallel_lines / each_others_seat / night_of_persuasion / the_square
  titles      jsonb not null,   -- {persuader: 2, open_ear: 4, citizen: 1}
  total_tokens int not null,
  created_at  timestamptz not null default now()
);
```

#### `evidence_queries` — 근거 검색 로그 (비용·품질 모니터링)

```sql
create table evidence_queries (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid references session_rounds(id) on delete set null,
  query_text text not null,
  ok         boolean not null,
  latency_ms int,
  created_at timestamptz not null default now()
);
```

검색어는 **이슈에 대한 질문**이므로 개인정보가 아니다. 다만 사용자가 개인적 내용을 입력할 수 있어 **90일 후 삭제**하는 정리 작업을 둔다 (Phase 2, `adr.md` 참고).

### RLS

```sql
alter table issue_cards enable row level security;
-- 이하 모든 테이블 동일. 정책을 만들지 않는다 = anon 전면 거부.
-- service_role은 RLS를 우회하므로 서버 라우트만 접근 가능.
```

---

## 3. 게임 진행 흐름

### 상태 기계

```
[랜딩] ──스캔/방문──▶ [설정] ──생성──▶ ┌─────────── 라운드 루프 ───────────┐
                                      │ ① 이슈 공개                        │
                                      │ ② 입장 배정 (찬/반 무작위)          │
                                      │ ③ 발언·반박  (화면은 대기)          │
                                      │ ④ 토큰 입력                        │
                                      └──── round_no < round_total ────────┘
                                                      │ 마지막 라운드
                                                      ▼
                                              [집계] ──▶ [결과·엔딩]
```

### 단계별 화면이 하는 일

| 단계 | 화면 | 서버 호출 |
|---|---|---|
| ① 이슈 공개 | 카드 제목·본문 크게. "모두 읽었으면 다음" | `POST /api/sessions/:id/rounds` 가 ①②를 한 번에 처리 |
| ② 입장 배정 | 슬롯별 찬/반 배지. 공개(비밀 아님) | — |
| ③ 발언 | **화면은 최소한만 표시.** 순서와 입장만 보여주고 기다린다 | 없음 (근거 검색만 선택적) |
| ④ 토큰 입력 | "누가 누구에게 몇 개" 입력 그리드 | `POST /api/rounds/:id/tokens` |
| 집계 | — | `POST /api/sessions/:id/finish` |

> ③에서 화면이 할 일이 거의 없는 것이 **의도**다. cps 설계 원칙 3 — 웹은 대화에 끼어들지 않는다. 타이머(Phase 2)가 들어갈 자리도 여기다.

### 입장 배정 — `lib/game/stance.ts`

```
입력: playerCount (3~5)
출력: slot → 'pro' | 'con'

규칙
- 찬/반을 최대한 균등하게 나눈다. 홀수 인원이면 한쪽이 1명 많다
- 많은 쪽을 라운드마다 번갈아 준다 (1라운드 찬성 多 → 2라운드 반대 多)
- 같은 플레이어가 전 라운드 같은 입장을 받지 않도록, 직전 라운드 배정을 피한다
- 한쪽이 0명이 되는 배정은 금지 (토론이 성립하지 않음)
```

마지막 규칙이 중요하다. 완전 무작위로 돌리면 3인 게임에서 전원 찬성이 나올 수 있고, 그 라운드는 게임이 아니게 된다.

### 카드 뽑기 — `lib/game/draw.ts`

```sql
select * from issue_cards
where status = 'active'
  and id <> all($already_used_in_this_session)
order by use_count asc, random()
limit 1;
```

뽑은 뒤 `use_count` 증가. 활성 카드가 세션 라운드 수보다 적으면 **세션 생성 단계에서 거부**하고 안내한다 (조용히 중복 노출하지 않는다).

---

## 4. 점수 — `lib/game/score.ts`

슬롯별로 두 값을 집계한다.

| 값 | 계산 | 의미 |
|---|---|---|
| `received` | 받은 토큰 합 | **설득력** — 내 논거가 그럴듯했다 |
| `given` | 건넨 토큰 합 | **개방성** — 나는 설득당할 줄 안다 |
| `balance` | `min(received, given)` | **교류** — 주고받기를 다 한 사람이 높다 |

> `balance`에 `min`을 쓰는 것이 cps 설계 원칙 2의 구현이다. 받기만 한 사람과 주기만 한 사람 모두 낮고, **둘 다 한 사람**이 높다.

승자를 단일 지표로 뽑지 않는다. 세 칭호를 각각 준다.

| 칭호 | 기준 | 동점 시 |
|---|---|---|
| **오늘의 설득자** | `received` 최대 | 공동 수여 |
| **열린 귀** | `given` 최대 | 공동 수여 |
| **광장의 시민** | `balance` 최대 (단, > 0) | 공동 수여 |

---

## 5. 엔딩 판정 — `lib/game/ending.ts`

세션 전체 토큰 분포로 판정한다. **위에서부터 먼저 맞는 것 하나.**

```
N = playerCount,  T = 총 토큰 수
givenByAll    = 모든 슬롯의 given  >= 1
receivedByAll = 모든 슬롯의 received >= 1
topShare      = max(received) / T          (T = 0이면 0)

1. T < N                        → parallel_lines     「평행선」
2. givenByAll && receivedByAll  → each_others_seat   「서로의 자리」
3. topShare >= 0.5              → night_of_persuasion「설득의 밤」
4. 그 외                         → the_square        「광장의 밤」
```

| 코드 | 이름 | 화면 메시지 방향 |
|---|---|---|
| `parallel_lines` | 평행선 | 토큰이 거의 움직이지 않았다. 다음 판엔 한 발만 더 — **책망하지 않는다** |
| `each_others_seat` | 서로의 자리 | **전원이 주고받았다.** 가장 좋은 결과로 연출한다 |
| `night_of_persuasion` | 설득의 밤 | 한 사람의 논거가 판을 가져갔다 |
| `the_square` | 광장의 밤 | 기본. 의견이 오갔다 |

> 판정 순서에 설계 의도가 있다. `each_others_seat`를 `night_of_persuasion`보다 **먼저** 본다. 전원이 교류한 판은, 한 명이 독식했더라도 교류 쪽으로 읽는다.
>
> 숫자 임계값(`T < N`, `0.5`)은 **플레이테스트로 조정할 값**이다. 순수 함수로 분리한 이유가 이것이다. 조정 이력은 `log.md`에 남긴다.

---

## 6. UI/UX

### 원칙

1. **한 기기를 여럿이 본다.** 폰을 가운데 두거나 돌려본다 → 글자를 크게, 터치 타깃을 넓게
2. **③ 발언 단계에 화면이 끼어들지 않는다.** 그 화면은 정보 밀도가 가장 낮아야 한다
3. **룰 설명 없이 굴러가야 한다.** 각 단계 화면에 "지금 할 일" 한 문장을 항상 띄운다
4. 다크 톤 기본. "광장"의 저녁 분위기 + 모여 앉은 환경에서 눈이 편하다

### 화면 목록

| 경로 | 화면 | 핵심 요소 |
|---|---|---|
| `/` | 랜딩 | 서비스명, 30초 룰 요약, `게임 시작` |
| `/setup` | 설정 | 인원 3~5 선택, 라운드 1~5(기본 3), 닉네임(선택, 로컬 전용) |
| `/play/[id]` | 라운드 진행 | 단계 전환 (①→②→③→④), 하단에 `근거 검색` |
| `/result/[id]` | 결과 | 엔딩 카드, 슬롯별 점수, 칭호 3개, `다시 하기` |
| `/admin` | 관리자 로그인 | 비밀번호 1개 |
| `/admin/cards` | 검수 큐 | draft 카드 목록, 승인/반려, 중립성 체크리스트 |

### 닉네임 처리 (설계 원칙 2 준수)

```
입력 → localStorage('mp.nicknames') 저장 → 화면 표시용으로만 사용
       서버 요청 바디에 포함하지 않는다
```

서버는 끝까지 "슬롯 1~5"만 안다. 결과 화면에서 "슬롯 3"이 "민서"로 보이는 것은 **브라우저가 로컬에서 바꿔 끼운 것**이다.

### 근거 검색 UX

바텀시트로 띄운다. 결과 상단에 고정 문구:

> ⚠️ AI가 요약한 참고 정보입니다. 사실 확인은 직접 해주세요.

우리는 심판이 아니다(cps §2). 진위를 **판정**하지 않고 **찾아주기만** 한다.

---

## 7. API 설계

모든 응답은 `{ ok: true, data }` 또는 `{ ok: false, error: { code, message } }`.

### 플레이

| 메서드 · 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|
| `POST /api/sessions` | `{ playerCount, roundTotal }` | `{ sessionId }` | 활성 카드 부족 시 `409 INSUFFICIENT_CARDS` |
| `GET /api/sessions/:id` | — | 세션 + 라운드 + 입장 + 토큰 | 새로고침 복구용 |
| `POST /api/sessions/:id/rounds` | — | `{ roundId, roundNo, card, stances }` | 카드 뽑기 + 입장 배정을 원자적으로 |
| `POST /api/rounds/:id/tokens` | `{ awards: [{fromSlot, toSlot, count}] }` | `{ saved }` | 재호출 시 해당 라운드 토큰 교체 (멱등) |
| `POST /api/sessions/:id/finish` | — | `{ scores, ending, titles }` | 이미 finished면 저장된 결과 반환 |
| `POST /api/evidence` | `{ query, roundId? }` | `{ summary, caveat }` | 레이트 리밋 필요 |

### 관리자

| 메서드 · 경로 | 비고 |
|---|---|
| `POST /api/admin/login` | 비밀번호 → httpOnly 쿠키 |
| `GET /api/admin/cards?status=draft` | 검수 큐 |
| `PATCH /api/admin/cards/:id` | `{ status: 'active'\|'rejected', reviewNote, reviewedBy }` |
| `POST /api/admin/cards/generate` | 수동 생성 트리거 |
| `GET /api/cron/generate-cards` | Vercel Cron. `CRON_SECRET` 헤더 검증 |

### 에러 코드

| 코드 | 상황 |
|---|---|
| `INSUFFICIENT_CARDS` | 활성 카드 < 라운드 수 |
| `SESSION_FINISHED` | 종료된 세션에 라운드 추가 시도 |
| `ROUND_NOT_FOUND` | 잘못된 라운드 id |
| `INVALID_AWARD` | 자기에게 토큰, 범위 밖 슬롯 |
| `EVIDENCE_UNAVAILABLE` | LLM 실패 — **게임은 계속된다** |
| `RATE_LIMITED` | 근거 검색 과다 |

---

## 8. AI 파이프라인

### 카드 생성 (배치, 주 1회)

```
Vercel Cron (주 1회)
  └─▶ card_generation_runs 생성 (status=running)
        └─▶ Claude API: 이슈 카드 N장 생성 (JSON)
              └─▶ 자동 필터 → issue_cards (status='draft')
                    └─▶ /admin/cards 에서 사람 검수 → 'active'
```

#### 자동 필터 (검수 전 1차 차단)

사람 검수 앞에 기계가 먼저 걸러낸다.

| 규칙 | 내용 |
|---|---|
| 금칙어 | 정당명·실존 정치인 이름 포함 시 `rejected` |
| 양면성 | `pro_hint`·`con_hint`가 둘 다 비어있지 않아야 함 |
| 중복 | 기존 활성 카드와 제목 유사도가 높으면 `rejected` |
| 길이 | 제목 한 문장, 본문 3문장 이내 |

#### 생성 프롬프트 요구사항 (`lib/prompts/card-generate.ts`)

- 2030이 **실제로 경험·의견을 가진** 생활 밀착 주제 (노동·주거·교육·환경·기술·젠더·세대)
- **특정 정당·후보·실존 인물 언급 금지**
- 찬반 양쪽에 각각 그럴듯한 논거가 있어야 함. 한쪽이 명백히 옳은 주제 금지
- 어느 한쪽 진영의 프레임 용어를 쓰지 않는 중립적 표현
- 전문 지식 없이 말할 수 있는 수준
- 출력은 고정 JSON 스키마

> 프롬프트는 `prompt_version`으로 버전을 박아 `card_generation_runs`에 기록한다. 카드 품질이 바뀌었을 때 원인을 추적하기 위해서다.

#### 카드 은퇴 (retire)

시사성이 떨어진 카드를 내린다. MVP에서는 **자동 은퇴를 하지 않고** 검수 화면에서 수동으로 `retired` 처리한다. 자동 규칙(예: 생성 90일 경과)은 Phase 2.

### 근거 검색 (온디맨드)

```
사용자 질문 → POST /api/evidence
  → Claude API (요약 + 한계 명시 지시)
  → { summary, caveat } + evidence_queries 로그
  → 실패하면 EVIDENCE_UNAVAILABLE. 게임 흐름은 영향 없음
```

- 진위 **판정을 하지 않는다.** "확인된 사실 / 논쟁 중 / 확인 어려움"으로 구분해 제시한다
- 레이트 리밋: 라운드당 3회, 세션당 10회 (초기값, 조정 대상)

### 플레이 경로에 AI가 없음을 다시 확인

| 경로 | LLM 호출 |
|---|---|
| 세션 생성 → 라운드 → 토큰 → 결과 | **없음** |
| 근거 검색 | 있음 (선택적, 실패해도 게임 계속) |
| 카드 생성 | 있음 (배치, 플레이와 분리) |

제약 1(cps §5) 충족.

---

## 9. 환경변수

| 키 | 용도 | 노출 |
|---|---|---|
| `SUPABASE_URL` | DB | 서버 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 쓰기 | **서버 전용 — 절대 클라이언트 금지** |
| `ANTHROPIC_API_KEY` | 카드 생성·근거 검색 | **서버 전용** |
| `ADMIN_PASSWORD` | 검수 화면 | 서버 |
| `CRON_SECRET` | Cron 인증 | 서버 |
| `NEXT_PUBLIC_BASE_URL` | QR 생성 | 공개 |

`NEXT_PUBLIC_` 접두사는 위 목록의 마지막 하나뿐이다.

---

## 10. 의도적으로 넣지 않은 것

| 안 넣는 것 | 이유 |
|---|---|
| Supabase Auth · 계정 | cps 원칙 5. 민감정보 + 참여 문턱 |
| Supabase Realtime | 단일 기기(MVP)에 불필요 |
| 상태관리 라이브러리 | 서버가 상태를 들고 화면은 순차 전환. `useState`로 충분 |
| ORM (Prisma 등) | 테이블 8개. `supabase-js`로 충분 |
| 애니메이션 라이브러리 | 엔딩 연출은 CSS로 |
| 다국어 (i18n) | 국내 2030 대상 |
| 플레이어별 기기 접속 | Phase 2 |

---

## 11. `plan.md`로 넘기는 구현 순서 제약

1. **DB 스키마 + 카드 20장 수동 입력**이 먼저다. AI 생성이 없어도 게임은 돌아가야 한다
2. `lib/game/*` 순수 함수를 **화면보다 먼저** 만든다 (`test.md`가 여기를 먼저 검증한다)
3. 플레이 루프(①~④ + 결과)가 끝까지 도는 것이 1차 제품의 기준이다
4. AI 카드 생성 · 근거 검색은 플레이 루프가 완성된 **뒤에** 붙인다 (의존 역전 금지)
5. 검수 화면(`/admin/cards`)은 AI 생성과 **같은 단계**에 만든다. 검수 없이 활성화하는 경로를 만들지 않는다
