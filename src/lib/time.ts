import type { TimeEntry } from './types'

export function entryMs(e: TimeEntry, now = Date.now()): number {
  const end = e.ended_at ? new Date(e.ended_at).getTime() : now
  return Math.max(0, end - new Date(e.started_at).getTime())
}

export function formatDuration(ms: number, withSeconds = false): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (withSeconds) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  }
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Zeit eines Eintrags, die in das Intervall [from, to) fällt */
export function overlapMs(e: TimeEntry, from: Date, to: Date, now = Date.now()): number {
  const s = Math.max(new Date(e.started_at).getTime(), from.getTime())
  const end = e.ended_at ? new Date(e.ended_at).getTime() : now
  const en = Math.min(end, to.getTime())
  return Math.max(0, en - s)
}

export const weekdayShort = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short' })
