import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '마지막 광장',
  description: '정치·사회 이슈에 관심은 있지만 말하기 어려운 2030을 위한, 앱과 연동되는 보드게임',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 한 기기를 여럿이 돌려보므로 확대를 막지 않는다
  maximumScale: 5,
  themeColor: '#0d0f14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">{children}</div>
      </body>
    </html>
  )
}
