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

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Lokaler Tag als YYYY-MM-DD */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** YYYY-MM-DD -> Date (lokal, 00:00) */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 1 = Montag … 7 = Sonntag */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1

export const startOfWeek = (d = new Date()) => addDays(startOfDay(d), -(isoWeekday(d) - 1))

export const clockTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** ISO -> Wert für <input type="datetime-local"> */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${dayKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export const longDate = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

/** "9h 38m" in zwei Teilen für große Anzeige */
export function hm(ms: number): { h: number; m: number } {
  const min = Math.floor(ms / 60000)
  return { h: Math.floor(min / 60), m: min % 60 }
}

/** Kompakt: "2h 3m", "45m" */
export function fmtHM(ms: number): string {
  const { h, m } = hm(ms)
  return h ? `${h}h ${m}m` : `${m}m`
}
