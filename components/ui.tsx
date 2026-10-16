import Link from 'next/link'
import type { Stance } from '@/lib/types'

/**
 * 화면마다 "지금 할 일"을 한 문장 띄운다.
 * 룰 설명 없이도 게임이 굴러가야 한다. (design.md §6 원칙 3 / test.md T-1)
 */
export function NowDo({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-surface-2 px-4 py-3 text-center text-base text-muted">
      {children}
    </p>
  )
}

const BUTTON_BASE =
  'flex w-full items-center justify-center rounded-xl px-5 py-4 text-lg font-semibold transition active:scale-[0.99] disabled:opacity-40'

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} bg-accent text-[#1a1407]`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} border border-border bg-surface text-text`}
    >
      {children}
    </button>
  )
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${BUTTON_BASE} bg-accent text-[#1a1407]`}>
      {children}
    </Link>
  )
}

/**
 * 찬/반 배지.
 * 🔴 색은 청록·호박. 파랑·빨강은 정당 색으로 읽히므로 쓰지 않는다. (globals.css)
 */
export function StanceBadge({ stance, large }: { stance: Stance; large?: boolean }) {
  const isPro = stance === 'pro'
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-md font-bold',
        large ? 'px-4 py-2 text-xl' : 'px-2.5 py-1 text-sm',
        isPro ? 'bg-pro/15 text-pro' : 'bg-con/15 text-con',
      ].join(' ')}
    >
      {isPro ? '찬성' : '반대'}
    </span>
  )
}

export function ErrorNotice({
  message,
  onRetry,
  retryLabel = '다시 시도',
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="space-y-3 rounded-xl border border-danger/40 bg-danger/10 p-4">
      <p className="text-base text-text">{message}</p>
      {onRetry && <SecondaryButton onClick={onRetry}>{retryLabel}</SecondaryButton>}
    </div>
  )
}

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return <p className="py-16 text-center text-muted">{label}</p>
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col gap-5 px-5 py-6">{children}</main>
}

export function StepHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <header className="space-y-1">
      {caption && <p className="text-sm font-medium tracking-wide text-accent">{caption}</p>}
      <h1 className="text-2xl font-bold">{title}</h1>
    </header>
  )
}
