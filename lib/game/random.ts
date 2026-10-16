/** 난수를 주입할 수 있게 분리한다. 테스트에서 고정 시퀀스를 넣을 수 있다. */
export type Rng = () => number

/** Fisher–Yates. 원본을 바꾸지 않는다. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}
