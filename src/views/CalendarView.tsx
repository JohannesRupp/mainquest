import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { addDays, dayKey, fmtHM, overlapMs, startOfWeek } from '../lib/time'
import type { TimeEntry } from '../lib/types'
import { Timeline } from '../components/Timeline'
import { EntryEditor } from '../components/EntryEditor'
import { Button, Icon, Modal, inputCls } from '../components/ui'

/** Wochenkalender mit allen getrackten Zeitblöcken */
export function CalendarView() {
  const { entries, tasks, settings, running } = useStore()
  const now = useNow(Boolean(running), 30_000)
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [logging, setLogging] = useState(false)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const isThisWeek = dayKey(weekStart) === dayKey(startOfWeek())
  const questTaskIds = useMemo(() => new Set(tasks.filter((t) => t.quest_id).map((t) => t.id)), [tasks])
  const questMs = entries
    .filter((e) => questTaskIds.has(e.task_id))
    .reduce((s, e) => s + overlapMs(e, weekStart, addDays(weekStart, 7), now), 0)
  const goalMs = (settings.weekly_goal_minutes ?? 0) * 60_000
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('de-DE', o)

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-3 text-3xl font-medium tracking-tight">Kalender</h1>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg p-2 text-white/50 hover:bg-panel-2 hover:text-white" title="Vorige Woche">
          <Icon.left className="h-4 w-4" />
        </button>
        <span className="tabular min-w-32 text-center text-white/80">
          {fmt(weekStart, { day: 'numeric', month: 'short' })} – {fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}
        </span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg p-2 text-white/50 hover:bg-panel-2 hover:text-white" title="Nächste Woche">
          <Icon.chevron className="h-4 w-4" />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek())}
          disabled={isThisWeek}
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-white/80 transition hover:border-white/20 disabled:opacity-40"
        >
          <Icon.calendar className="h-4 w-4" /> Diese Woche
        </button>
        <Button variant="subtle" className="border border-line" onClick={() => setLogging(true)}>
          Zeit eintragen
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <div className="tabular">
            <span className="text-3xl font-medium">{fmtHM(questMs)}</span>
            {goalMs > 0 && <span className="ml-1.5 text-white/45">/ {Math.round(goalMs / 3_600_000)}h Quest</span>}
          </div>
          {goalMs > 0 && (
            <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.08] sm:block">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (questMs / goalMs) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
      <Timeline key={weekStart.toISOString()} days={days} onEntryClick={setEditing} className="flex-1" />
      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
      {logging && <LogWork onClose={() => setLogging(false)} />}
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Arbeit nachträglich eintragen: Task, Tag, von, bis */
function LogWork({ onClose }: { onClose: () => void }) {
  const { tasks, quests, addManualEntry } = useStore()
  const nowRounded = new Date(Math.floor(Date.now() / 300_000) * 300_000)
  const [taskId, setTaskId] = useState('')
  const [day, setDay] = useState(dayKey())
  const [from, setFrom] = useState(hhmm(new Date(nowRounded.getTime() - 3_600_000)))
  const [to, setTo] = useState(hhmm(nowRounded))

  const options = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400_000
    const relevant = tasks.filter((t) => !t.done || (t.done_at && new Date(t.done_at).getTime() > cutoff))
    const groups = [...quests.filter((q) => q.status === 'active'), null].map((q) => ({
      label: q?.title ?? 'Ohne Quest',
      tasks: relevant.filter((t) => t.quest_id === (q?.id ?? null)).sort((a, b) => Number(a.done) - Number(b.done)),
    }))
    return groups.filter((g) => g.tasks.length)
  }, [tasks, quests])

  const start = new Date(`${day}T${from}`)
  const end = new Date(`${day}T${to}`)
  if (end <= start) end.setDate(end.getDate() + 1) // über Mitternacht
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  const valid = taskId && from && to && minutes > 0

  return (
    <Modal title="Zeit eintragen" subtitle="Arbeit nachträglich erfassen" icon={<Icon.clock className="h-5 w-5" />} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid) return
          await addManualEntry(taskId, start, minutes)
          onClose()
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Task</span>
          <select autoFocus value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls}>
            <option value="">Task wählen…</option>
            {options.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.done ? '✓ ' : ''}
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Tag</span>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Von</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Bis</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="tabular text-sm text-muted">Dauer: {minutes > 0 ? fmtHM(minutes * 60_000) : 'ungültig'}</p>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="subtle" className="border border-line" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!valid}>
            Eintragen
          </Button>
        </div>
      </form>
    </Modal>
  )
}
