import QRCode from 'qrcode'
import { Screen } from '@/components/ui'

/**
 * QR 생성 — 보드게임 박스·보드에 인쇄할 용도. (plan.md 1-15)
 *
 * NFC 대신 QR 을 쓴다. Web NFC 는 안드로이드 Chrome 전용이고 iOS Safari 가
 * 지원하지 않아, 웹으로 가면 아이폰 사용자가 진입 경로에서 배제된다.
 * (adr.md ADR-001)
 *
 * 서버에서 SVG 문자열로 만든다. 외부 이미지 요청이 없어 오프라인에서도 뜬다.
 */
export const dynamic = 'force-dynamic'

export default async function QrPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  const svg = await QRCode.toString(baseUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    // 인쇄 대비를 위해 QR 자체는 흰 바탕 + 검은 모듈로 둔다
    color: { dark: '#000000', light: '#ffffff' },
  })

  return (
    <Screen>
      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-bold">게임 입구 QR</h1>
        <p className="text-base text-muted">
          보드게임 박스나 보드에 인쇄하세요. 찍으면 설치 없이 바로 열립니다.
        </p>
      </header>

      <div
        className="mx-auto w-full max-w-xs rounded-2xl bg-white p-4 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="break-all text-center text-sm text-muted">{baseUrl}</p>

      <section className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
        <p className="font-semibold text-text">인쇄 전 확인</p>
        <p>
          위 주소가 <strong className="text-text">배포된 주소</strong>인지 확인하세요.
          <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 text-text">localhost</code>
          로 인쇄하면 다른 기기에서 열리지 않습니다.
        </p>
        <p>
          주소는 <code className="rounded bg-surface-2 px-1.5 py-0.5 text-text">NEXT_PUBLIC_BASE_URL</code>{' '}
          환경변수로 정합니다.
        </p>
      </section>
    </Screen>
  )
}
