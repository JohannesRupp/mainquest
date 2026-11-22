import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { addDays, clockTime, dayKey, fmtHM, overlapMs } from '../lib/time'
import type { TimeEntry } from '../lib/types'

const HOUR = 54 // Pixel pro Stunde

/** Stundenraster mit getrackten Zeitblöcken für einen oder mehrere Tage */
export function Timeline({
  days,
  onEntryClick,
  className = '',
}: {
  days: Date[]
  onEntryClick?: (e: TimeEntry) => void
  className?: string
}) {
  const now = useNow(true, 30_000)
  const { entries } = useStore()
  const scroller = useRef<HTMLDivElement>(null)
  const multi = days.length > 1
  const todayKey = dayKey(new Date(now))

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (new Date().getHours() - 2) * HOUR)
  }, [])

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-panel ${className}`}>
      {multi && (
        <div className="flex border-b border-line pl-14">
          {days.map((d) => {
            const isToday = dayKey(d) === todayKey
            const total = entries.reduce((s, e) => s + overlapMs(e, d, addDays(d, 1), now), 0)
            return (
              <div
                key={d.toISOString()}
                className={`min-w-0 flex-1 border-l border-white/[0.05] py-3 text-center ${isToday ? 'bg-accent/[0.04] text-white' : 'text-white/55'}`}
              >
                <div className="text-[15px]">
                  {d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}{' '}
                  <span className={isToday ? 'text-accent' : 'text-white/35'}>{d.getDate()}</span>
                </div>
                <div className={`tabular mt-0.5 text-xs ${total ? 'text-white/60' : 'text-white/25'}`}>{fmtHM(total)}</div>
              </div>
            )
          })}
        </div>
      )}
      <div ref={scroller} className="relative flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR }}>
          <div className="relative w-14 shrink-0">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} className="tabular absolute right-2.5 -translate-y-1/2 text-xs text-white/35" style={{ top: h * HOUR }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          <div className="relative flex flex-1 border-l border-line">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-white/[0.05]" style={{ top: h * HOUR }} />
            ))}
            {days.map((d, i) => (
              <DayColumn key={d.toISOString()} day={d} now={now} first={i === 0} tint={multi} onEntryClick={onEntryClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  now,
  first,
  tint,
  onEntryClick,
}: {
  day: Date
  now: number
  first: boolean
  tint?: boolean
  onEntryClick?: (e: TimeEntry) => void
}) {
  const { entries, tasks, quests } = useStore()
  const from = day.getTime()
  const to = addDays(day, 1).getTime()
  const isToday = now >= from && now < to

  const blocks = entries
    .map((e) => {
      const s = Math.max(new Date(e.started_at).getTime(), from)
      const end = Math.min(e.ended_at ? new Date(e.ended_at).getTime() : now, to)
      return { e, s, end }
    })
    .filter((b) => b.end > b.s)

  return (
    <div className={`relative min-w-0 flex-1 ${first ? '' : 'border-l border-white/[0.05]'} ${tint && isToday ? 'bg-accent/[0.04]' : ''}`}>
      {blocks.map(({ e, s, end }) => {
        const task = tasks.find((t) => t.id === e.task_id)
        const color = quests.find((q) => q.id === task?.quest_id)?.color ?? '#8a8a93'
        const top = ((s - from) / 3_600_000) * HOUR
        const height = Math.max(4, ((end - s) / 3_600_000) * HOUR)
        return (
          <button
            key={e.id}
            onClick={() => onEntryClick?.(e)}
            title={`${task?.title ?? 'Task'} · ${clockTime(new Date(s))}–${e.ended_at ? clockTime(new Date(end)) : 'jetzt'}`}
            className="absolute inset-x-1 overflow-hidden rounded-md px-2 text-left transition hover:brightness-125"
            style={{
              top,
              height,
              borderLeft: `3px solid ${color}`,
              background: `repeating-linear-gradient(135deg, ${color}55 0 1.5px, transparent 1.5px 7px), ${color}1a`,
            }}
          >
            {height >= 30 && (
              <span className="block pt-1 text-xs leading-tight">
                <span className="block truncate font-medium text-white/90">{task?.title ?? 'Task'}</span>
                {height >= 46 && (
                  <span className="tabular block truncate text-white/50">
                    {clockTime(new Date(s))}–{e.ended_at ? clockTime(new Date(end)) : 'jetzt'}
                  </span>
                )}
              </span>
            )}
          </button>
        )
      })}

      {isToday && (
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ((now - from) / 3_600_000) * HOUR }}>
          <div className="h-px bg-accent" />
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent" />
        </div>
      )}
    </div>
  )
}
