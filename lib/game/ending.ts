import type { EndingCode, PlayerScore } from '@/lib/types'

/**
 * 멀티 엔딩 판정. 세션 전체의 토큰 분포를 읽는다.
 *
 * 🔴 판정 순서를 바꾸지 않는다. (test.md E-4 가 이 순서를 지킨다)
 *
 *   1. T < N                        → parallel_lines      「평행선」
 *   2. givenByAll && receivedByAll  → each_others_seat    「서로의 자리」
 *   3. topShare >= 0.5              → night_of_persuasion 「설득의 밤」
 *   4. 그 외                         → the_square          「광장의 밤」
 *
 * 2번을 3번보다 **먼저** 보는 것이 설계 의도다. 전원이 주고받은 판은, 한 명이
 * 토큰을 독식했더라도 '교류한 판'으로 읽는다. (cps.md 설계 원칙 2 / ADR-007)
 *
 * 임계값(`T < N`, `0.5`)은 플레이테스트로 조정할 값이다. 순수 함수로 분리한
 * 이유가 이것이다. 바꿀 때는 test.md E-7 · E-8 의 숫자도 함께 고친다.
 */
export function determineEnding(scores: readonly PlayerScore[], playerCount: number): EndingCode {
  const total = scores.reduce((acc, s) => acc + s.received, 0)

  // 1. 토큰이 거의 움직이지 않았다. T=0 도 여기서 걸러지므로 0 나눗셈이 없다.
  if (total < playerCount) return 'parallel_lines'

  const givenByAll = scores.every((s) => s.given >= 1)
  const receivedByAll = scores.every((s) => s.received >= 1)

  // 2. 전원이 주고받았다 — 가장 좋은 결과
  if (givenByAll && receivedByAll) return 'each_others_seat'

  // 3. 한 사람이 판을 가져갔다
  const topShare = Math.max(...scores.map((s) => s.received)) / total
  if (topShare >= 0.5) return 'night_of_persuasion'

  // 4. 기본 — 의견이 오갔다
  return 'the_square'
}

/** 결과 화면 문구. 평행선을 책망하지 않는 것이 중요하다. (design.md §5) */
export const ENDING_MESSAGE: Record<EndingCode, { label: string; message: string }> = {
  parallel_lines: {
    label: '평행선',
    message: '오늘은 토큰이 거의 움직이지 않았습니다. 다음 판엔 한 발만 더.',
  },
  each_others_seat: {
    label: '서로의 자리',
    message: '모두가 설득하고 모두가 설득당했습니다. 서로의 자리에 한 번씩 앉아본 밤.',
  },
  night_of_persuasion: {
    label: '설득의 밤',
    message: '한 사람의 논거가 이 판을 가져갔습니다.',
  },
  the_square: {
    label: '광장의 밤',
    message: '의견이 오갔습니다. 광장은 그렇게 만들어집니다.',
  },
}
