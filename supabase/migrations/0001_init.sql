-- 마지막 광장 — 초기 스키마
-- design.md §2 / adr.md ADR-002 (개인 식별값 미수집)
--
-- 🔴 이 스키마에 user_id · nickname · ip · user_agent 컬럼은 없다.
--    플레이어는 player_slot(1~5) 정수로만 식별된다.
--    저장되는 입장(stance)은 본인 생각이 아니라 무작위 배정 결과다.

-- ── enum ─────────────────────────────────────────────────────

create type card_status as enum ('draft', 'active', 'retired', 'rejected');
create type stance as enum ('pro', 'con');

-- ── 카드 생성 이력 ───────────────────────────────────────────
-- issue_cards 가 참조하므로 먼저 만든다.

create table card_generation_runs (
  id             uuid primary key default gen_random_uuid(),
  model          text not null,
  prompt_version text not null,
  requested      int  not null,
  produced       int  not null default 0,
  status         text not null default 'running'
                 check (status in ('running', 'succeeded', 'failed')),
  error_message  text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

-- ── 이슈 카드 풀 ─────────────────────────────────────────────

create table issue_cards (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,          -- 카드 앞면 질문 (한 문장)
  body              text,                   -- 상황 설명 2~3문장
  category          text not null,
  pro_hint          text,                   -- 찬성 쪽 논거 실마리
  con_hint          text,                   -- 반대 쪽 논거 실마리
  status            card_status not null default 'draft',
  generation_run_id uuid references card_generation_runs(id) on delete set null,
  reviewed_by       text,                   -- 검수자 이름 (직접 입력, ADR-006)
  reviewed_at       timestamptz,
  review_note       text,
  use_count         int not null default 0,
  created_at        timestamptz not null default now()
);

-- 활성 카드 중 덜 쓴 것 우선 조회 (design.md §3)
create index issue_cards_status_use_count_idx on issue_cards (status, use_count);

-- ── 플레이 세션 ──────────────────────────────────────────────

create table game_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_count int  not null check (player_count between 3 and 5),
  round_total  int  not null default 3 check (round_total between 1 and 5),
  status       text not null default 'playing'
               check (status in ('playing', 'finished', 'abandoned')),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table session_rounds (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references game_sessions(id) on delete cascade,
  round_no      int  not null,
  issue_card_id uuid not null references issue_cards(id),
  created_at    timestamptz not null default now(),
  unique (session_id, round_no)
);

create index session_rounds_session_idx on session_rounds (session_id);

create table round_stances (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references session_rounds(id) on delete cascade,
  player_slot int  not null check (player_slot between 1 and 5),
  stance      stance not null,
  unique (round_id, player_slot)
);

-- 토큰: 같은 (라운드, 보낸 슬롯, 받은 슬롯) 조합은 한 행.
-- unique 제약이 멱등 저장(upsert)의 근거다. test.md A-8
create table token_awards (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references session_rounds(id) on delete cascade,
  from_slot  int  not null check (from_slot between 1 and 5),
  to_slot    int  not null check (to_slot between 1 and 5),
  count      int  not null default 1 check (count between 1 and 5),
  created_at timestamptz not null default now(),
  check (from_slot <> to_slot),            -- 자기에게 못 준다
  unique (round_id, from_slot, to_slot)
);

-- 결과는 한 번 계산하고 보관한다. 새로고침마다 재계산하지 않는다. test.md A-10
create table session_results (
  session_id   uuid primary key references game_sessions(id) on delete cascade,
  scores       jsonb not null,
  ending_code  text  not null,
  titles       jsonb not null,
  total_tokens int   not null,
  created_at   timestamptz not null default now()
);

-- ── 근거 검색 로그 (비용·품질 모니터링) ──────────────────────

create table evidence_queries (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid references session_rounds(id) on delete set null,
  query_text text not null,
  ok         boolean not null,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- ── RLS: 전면 거부 ───────────────────────────────────────────
-- 정책(policy)을 만들지 않는다 = anon/authenticated 모두 접근 불가.
-- service_role 은 RLS를 우회하므로 서버 Route Handler 만 접근한다.
-- design.md §1 / test.md P-1

alter table card_generation_runs enable row level security;
alter table issue_cards          enable row level security;
alter table game_sessions        enable row level security;
alter table session_rounds       enable row level security;
alter table round_stances        enable row level security;
alter table token_awards         enable row level security;
alter table session_results      enable row level security;
alter table evidence_queries     enable row level security;
