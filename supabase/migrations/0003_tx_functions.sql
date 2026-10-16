-- 원자성이 필요한 연산을 Postgres 함수로 묶는다.
--
-- supabase-js 에는 트랜잭션이 없다. TS 에서 여러 쿼리로 나누면 중간 실패 시
-- 데이터가 깨진다. 예: 라운드는 만들어졌는데 입장 배정이 안 들어간 상태.
--
-- 이 함수들은 service_role 로만 호출된다 (RLS 우회). design.md §1

-- ── 라운드 생성 ──────────────────────────────────────────────
-- 라운드 insert + 입장 배정 insert + use_count 증가를 한 트랜잭션으로.
-- test.md D-5 (뽑은 뒤 use_count 1 증가) 가 여기서 보장된다.
create or replace function create_round_tx(
  p_session_id uuid,
  p_round_no   int,
  p_card_id    uuid,
  p_stances    jsonb        -- [{"slot":1,"stance":"pro"}, ...]
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_round_id uuid;
begin
  insert into session_rounds (session_id, round_no, issue_card_id)
  values (p_session_id, p_round_no, p_card_id)
  returning id into v_round_id;

  insert into round_stances (round_id, player_slot, stance)
  select v_round_id, (e->>'slot')::int, (e->>'stance')::stance
  from jsonb_array_elements(p_stances) e;

  update issue_cards set use_count = use_count + 1 where id = p_card_id;

  return v_round_id;
end;
$$;

-- ── 토큰 교체 (멱등) ─────────────────────────────────────────
-- 🔴 재호출 시 누적하지 않고 교체한다. test.md A-8
--
-- 오프라인 모임에서 버튼을 두 번 누르거나 네트워크가 끊겨 재시도하는 일은
-- 반드시 일어난다. 누적되면 그 판의 결과가 틀어진다.
create or replace function replace_round_tokens(
  p_round_id uuid,
  p_awards   jsonb        -- [{"fromSlot":1,"toSlot":2,"count":2}, ...]
) returns int
language plpgsql
set search_path = public
as $$
declare
  v_saved int;
begin
  delete from token_awards where round_id = p_round_id;

  insert into token_awards (round_id, from_slot, to_slot, count)
  select p_round_id, (e->>'fromSlot')::int, (e->>'toSlot')::int, (e->>'count')::int
  from jsonb_array_elements(p_awards) e;

  select count(*) into v_saved from token_awards where round_id = p_round_id;
  return v_saved;
end;
$$;

-- ── 결과 확정 (멱등) ─────────────────────────────────────────
-- 🔴 두 번 호출해도 같은 결과. 재계산하지 않는다. test.md A-10
--
-- 결과 화면을 새로고침할 때마다 엔딩이 바뀌면 신뢰를 잃는다.
-- on conflict do nothing 으로 첫 계산 결과를 고정한다.
create or replace function finish_session_tx(
  p_session_id  uuid,
  p_scores      jsonb,
  p_ending_code text,
  p_titles      jsonb,
  p_total       int
) returns void
language plpgsql
set search_path = public
as $$
begin
  insert into session_results (session_id, scores, ending_code, titles, total_tokens)
  values (p_session_id, p_scores, p_ending_code, p_titles, p_total)
  on conflict (session_id) do nothing;

  update game_sessions
     set status = 'finished',
         finished_at = coalesce(finished_at, now())
   where id = p_session_id
     and status <> 'finished';
end;
$$;
