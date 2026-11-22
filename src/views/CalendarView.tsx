import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, formatDuration, overlapMs, startOfWeek } from '../lib/time'
import type { TimeEntry } from '../lib/types'
import { Timeline } from '../components/Timeline'
import { EntryEditor } from '../components/EntryEditor'
import { Button, Icon } from '../components/ui'

/** Wochenkalender mit allen getrackten Zeitblöcken */
export function CalendarView() {
  const { entries } = useStore()
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const end = addDays(weekStart, 7)
  const total = entries.reduce((s, e) => s + overlapMs(e, weekStart, end), 0)
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('de-DE', o)

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-medium tracking-tight">Kalender</h1>
        <span className="tabular text-sm text-muted">{formatDuration(total)} getrackt</span>
        <div className="flex-1" />
        <span className="text-lg text-white/60">
          {fmt(weekStart, { day: 'numeric', month: 'short' })} – {fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Vorige Woche">
            <Icon.left className="h-4 w-4" />
          </Button>
          <Button variant="subtle" className="border border-line" onClick={() => setWeekStart(startOfWeek())}>
            Heute
          </Button>
          <Button variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Nächste Woche">
            <Icon.chevron className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Timeline key={weekStart.toISOString()} days={days} onEntryClick={setEditing} className="flex-1" />
      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
