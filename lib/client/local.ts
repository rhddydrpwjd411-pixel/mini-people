/**
 * 브라우저 로컬 저장소 헬퍼.
 *
 * 🔴 닉네임은 여기까지만 산다. 서버 요청 바디에 절대 넣지 않는다.
 *    서버는 끝까지 "슬롯 1~5"만 안다. 결과 화면에서 "슬롯 3"이 "민서"로
 *    보이는 것은 브라우저가 로컬에서 바꿔 끼운 것이다.
 *    (CLAUDE.md 절대 금지 2 / adr.md ADR-002 / test.md P-3)
 *
 * 사생활 모드·저장소 차단 환경에서는 접근 자체가 throw 하므로 전부 try/catch 한다.
 */

const NICKNAMES_KEY = 'mp.nicknames'
const PHASE_KEY_PREFIX = 'mp.phase.'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* 저장 실패는 무시한다. 화면은 기본값으로 동작해야 한다. */
  }
}

export function loadNicknames(): string[] {
  const raw = read(NICKNAMES_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((v) => String(v ?? '')) : []
  } catch {
    return []
  }
}

export function saveNicknames(names: readonly string[]): void {
  write(NICKNAMES_KEY, JSON.stringify(names))
}

/** 슬롯 표시 이름. 닉네임이 없으면 "슬롯 N". */
export function slotLabel(slot: number, nicknames: readonly string[]): string {
  const name = nicknames[slot - 1]?.trim()
  return name ? name : `슬롯 ${slot}`
}

/**
 * 라운드 안의 단계(이슈/입장/발언/토큰)를 기억한다.
 *
 * DB에는 단계 컬럼이 없다(design.md §2). 서버가 복구해 주는 것은 라운드
 * 단위까지이고, 라운드 안의 단계는 이 기기에만 저장한다. 새로고침해도
 * 같은 단계로 돌아오게 하기 위한 편의이므로, 비어 있으면 첫 단계로 간다.
 */
export function loadPhase(roundId: string): string | null {
  return read(PHASE_KEY_PREFIX + roundId)
}

export function savePhase(roundId: string, phase: string): void {
  write(PHASE_KEY_PREFIX + roundId, phase)
}
