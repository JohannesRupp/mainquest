import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { clockTime, dayKey, entryMs, formatDuration, longDate, parseDay } from '../lib/time'
import type { TimeEntry } from '../lib/types'
import { EntryEditor } from '../components/EntryEditor'
import { Card, Icon } from '../components/ui'

/** Alle Zeiteinträge, nach Tag gruppiert, mit Bearbeiten und Löschen */
export function TimeEntriesView({ onBack }: { onBack: () => void }) {
  const { entries, tasks, quests, running, deleteEntry } = useStore()
  const now = useNow(Boolean(running))
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [limit, setLimit] = useState(30)

  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of [...entries].sort((a, b) => b.started_at.localeCompare(a.started_at))) {
      const k = dayKey(new Date(e.started_at))
      map.set(k, [...(map.get(k) ?? []), e])
    }
    return [...map.entries()]
  }, [entries])

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <Icon.back className="h-4 w-4" /> Einstellungen
      </button>
      <h1 className="mb-1 text-3xl font-medium tracking-tight">Zeiteinträge</h1>
      <p className="mb-8 text-sm text-muted">Vergessen zu pausieren? Klick auf einen Eintrag, um Start und Ende anzupassen.</p>

      {groups.length === 0 && <Card className="text-sm text-muted">Noch keine Zeit getrackt.</Card>}

      {groups.slice(0, limit).map(([day, list]) => (
        <section key={day} className="mb-8">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-white/45">{longDate(parseDay(day))}</h2>
            <span className="tabular text-sm text-muted">{formatDuration(list.reduce((s, e) => s + entryMs(e, now), 0))}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {list.map((e, i) => {
              const task = tasks.find((t) => t.id === e.task_id)
              const quest = quests.find((q) => q.id === task?.quest_id)
              const ms = entryMs(e, now)
              return (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quest?.color ?? '#8a8a93' }} />
                  <button onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[15px]">{task?.title ?? 'Gelöschter Task'}</div>
                    <div className="tabular text-xs text-muted">
                      {clockTime(e.started_at)} – {e.ended_at ? clockTime(e.ended_at) : 'läuft'}
                      {quest && ` · ${quest.title}`}
                    </div>
                  </button>
                  {e.google_event_id && <Icon.calendar className="h-4 w-4 shrink-0 text-good" />}
                  <span className={`tabular w-20 shrink-0 text-right text-sm ${ms > 4 * 3_600_000 ? 'text-accent' : 'text-white/70'}`}>
                    {formatDuration(ms, !e.ended_at)}
                  </span>
                  <button onClick={() => setEditing(e)} title="Bearbeiten" className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-white">
                    <Icon.pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => e.ended_at && confirm('Zeiteintrag löschen?') && deleteEntry(e.id)}
                    disabled={!e.ended_at}
                    title="Löschen"
                    className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-30"
                  >
                    <Icon.trash className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {groups.length > limit && (
        <button onClick={() => setLimit(limit + 30)} className="text-sm text-muted hover:text-white">
          Ältere anzeigen
        </button>
      )}

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
