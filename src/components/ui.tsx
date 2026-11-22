import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 font-semibold',
  ghost: 'text-muted hover:text-white hover:bg-panel-2',
  subtle: 'bg-panel-2 text-white hover:bg-line',
  danger: 'text-bad hover:bg-bad/10',
}

export function Button({
  variant = 'subtle',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm transition disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>{children}</div>
}

export const inputCls =
  'w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-white placeholder:text-muted outline-none focus:border-accent'

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  )
}

export const QUEST_COLORS = ['#f5b942', '#60a5fa', '#4ade80', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171']

// Kleine Inline-Icons, damit keine Icon-Library nötig ist
const P = (d: string) => (props: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={props.className ?? 'h-5 w-5'}>
    <path d={d} />
  </svg>
)
export const Icon = {
  play: P('M7 4.5v15l12-7.5z'),
  stop: P('M6 6h12v12H6z'),
  check: P('M4.5 12.5l5 5 10-11'),
  plus: P('M12 5v14M5 12h14'),
  trash: P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'),
  chevron: P('M9 6l6 6-6 6'),
  sword: P('M14.5 3H21v6.5L10 20.5 3.5 14zM5 19l-2 2M7.5 16.5l-3-3'),
  list: P('M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'),
  chart: P('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  gear: P('M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'),
  calendar: P('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'),
  undo: P('M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3'),
  clock: P('M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
  focus: P('M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 100-8 4 4 0 000 8z'),
  back: P('M19 12H5M11 6l-6 6 6 6'),
  pause: P('M8 5v14M16 5v14'),
  playFill: (props: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className ?? 'h-5 w-5'}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  ),
}
