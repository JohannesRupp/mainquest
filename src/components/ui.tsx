import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

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
  filter: P('M3 5h18l-7 8.5V19l-4 2v-7.5z'),
  eye: P('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z'),
  eyeOff: P('M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2'),
  repeat: P('M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3'),
  toTop: P('M5 4h14M12 20V9M7 14l5-5 5 5'),
  toBottom: P('M5 20h14M12 4v11M7 10l5 5 5-5'),
  chat: P('M4 5h16v11H9l-5 4zM8 9h8M8 12.5h5'),
  x: P('M6 6l12 12M18 6L6 18'),
  pencil: P('M4 20h4L19 9l-4-4L4 16zM14 6l4 4'),
  left: P('M15 6l-6 6 6 6'),
  logout: P('M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11'),
  home: P('M3 11l9-7 9 7M5 10v10h14V10'),
  plan: P('M4 5h16v15H4zM9 5v15M14 5v15'),
  review: P('M5 20V10M12 20V4M19 20v-7'),
  rocket: P('M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9.5 14.5l-2-2M14.5 4.5C17 2 21 3 21 3s1 4-1.5 6.5L13 16l-5-5zM15.5 8.5h.01'),
  trophy: P('M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8M10 17h4'),
  focus: P('M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 100-8 4 4 0 000 8z'),
  back: P('M19 12H5M11 6l-6 6 6 6'),
  pause: P('M8 5v14M16 5v14'),
  playFill: (props: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className ?? 'h-5 w-5'}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  ),
}

/** Klein-Popover: schließt bei Klick außerhalb und Esc */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

export const popoverCls =
  'absolute z-40 mt-1.5 min-w-56 rounded-xl border border-line bg-panel p-1.5 shadow-2xl shadow-black/60 ' +
  // Handy: als Sheet über der Tab-Leiste, volle Breite, damit nichts aus dem Bildschirm ragt
  'max-md:fixed max-md:inset-x-3 max-md:left-3 max-md:right-3 max-md:top-auto max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-md:mt-0 max-md:max-h-[60dvh] max-md:overflow-y-auto max-md:rounded-2xl max-md:p-2 max-md:shadow-[0_-8px_40px_rgba(0,0,0,0.7)]'

export function IconButton({ active, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={`grid h-11 w-11 place-items-center rounded-xl border transition ${active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-panel text-muted hover:text-white'} ${className}`}
    />
  )
}

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`max-h-[90dvh] w-full overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">{icon}</span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{title}</h2>
              {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-white">
            <Icon.x className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
