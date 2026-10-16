import { PrimaryLink, Screen } from '@/components/ui'

/**
 * 랜딩 — QR 진입점. (plan.md 1-9)
 *
 * 보드게임 박스·보드에 인쇄된 QR 을 찍으면 설치 없이 여기로 온다. (adr.md ADR-001)
 * 로그인은 없다. 바로 시작한다. (ADR-002)
 */
export default function LandingPage() {
  return (
    <Screen>
      <header className="pt-10 pb-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">마지막 광장</h1>
        <p className="mt-3 text-base text-muted">
          관심은 있지만 말하기 어려웠던 이야기를,
          <br />
          게임이라는 명분으로 시작합니다.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-accent">30초 규칙</h2>
        <ol className="space-y-3 text-base leading-relaxed">
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-muted">1</span>
            <span>
              앱이 <strong>이슈 카드</strong> 한 장을 뽑습니다. 그 판의 주제입니다.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-muted">2</span>
            <span>
              앱이 각자에게 <strong>찬성 / 반대</strong>를 무작위로 나눠줍니다.
              <br />
              <span className="text-muted">내 생각이 아니라 받은 역할입니다.</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-muted">3</span>
            <span>받은 입장에서 이야기하고 반박합니다. 앱은 기다립니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-muted">4</span>
            <span>
              상대 말이 그럴듯했으면 <strong>공감 토큰</strong>을 건넵니다.
              <br />
              <span className="text-muted">설득당하는 것이 점수가 됩니다.</span>
            </span>
          </li>
        </ol>
      </section>

      <PrimaryLink href="/setup">게임 시작</PrimaryLink>

      <p className="text-center text-sm leading-relaxed text-muted">
        가입도 로그인도 없습니다.
        <br />
        누가 어떤 입장이었는지는 저장하지 않습니다.
      </p>
    </Screen>
  )
}
