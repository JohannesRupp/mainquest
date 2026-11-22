import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { entryMs, formatDuration } from '../lib/time'
import type { Task } from '../lib/types'
import { Button, Card, Icon, SectionTitle, inputCls } from '../components/ui'

export function TasksView({
  questFilter,
  setQuestFilter,
}: {
  questFilter: string | null
  setQuestFilter: (id: string | null) => void
}) {
  const { tasks, quests, addTask } = useStore()
  const [title, setTitle] = useState('')
  const [questId, setQuestId] = useState<string>(questFilter ?? '')
  const [showDone, setShowDone] = useState(false)

  const activeQuests = quests.filter((q) => q.status === 'active')
  const filtered = questFilter ? tasks.filter((t) => t.quest_id === questFilter) : tasks
  const open = filtered.filter((t) => !t.done)
  const done = filtered
    .filter((t) => t.done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
    .slice(0, 50)

  const groups = useMemo(() => {
    const map = new Map<string | null, Task[]>()
    for (const t of open) {
      const k = t.quest_id
      map.set(k, [...(map.get(k) ?? []), t])
    }
    return [...map.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : 0))
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addTask(title.trim(), questId || null)
    setTitle('')
  }

  const filterQuest = quests.find((q) => q.id === questFilter)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{filterQuest ? filterQuest.title : 'Tasks'}</h1>
        {filterQuest && (
          <Button variant="ghost" onClick={() => setQuestFilter(null)}>
            Alle anzeigen
          </Button>
        )}
      </div>

      <form onSubmit={submit} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neuer Task…" className={inputCls} />
        <div className="flex gap-2">
          <select value={questId} onChange={(e) => setQuestId(e.target.value)} className={`${inputCls} sm:w-48`}>
            <option value="">Ohne Quest</option>
            {activeQuests.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
          <Button variant="primary" className="shrink-0">
            <Icon.plus className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {open.length === 0 && (
        <Card className="text-center text-sm text-muted">Keine offenen Tasks. Zeit für die nächste Quest.</Card>
      )}

      {groups.map(([qid, list]) => {
        const q = quests.find((x) => x.id === qid)
        return (
          <div key={qid ?? 'none'} className="mb-6">
            {!questFilter && (
              <SectionTitle>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: q?.color ?? '#8b93a4' }} />
                  {q?.title ?? 'Ohne Quest'}
                </span>
              </SectionTitle>
            )}
            <div className="flex flex-col gap-2">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )
      })}

      {done.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDone((s) => !s)} className="flex items-center gap-1 text-sm text-muted">
            <Icon.chevron className={`h-4 w-4 transition ${showDone ? 'rotate-90' : ''}`} />
            Erledigt ({done.length})
          </button>
          {showDone && (
            <div className="mt-3 flex flex-col gap-2">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const { entries, running, startTimer, stopTimer, completeTask, reopenTask, updateTask, deleteTask, addManualEntry, deleteEntry } =
    useStore()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('30')
  const isRunning = running?.task_id === task.id
  const now = useNow(isRunning)
  const own = entries.filter((e) => e.task_id === task.id)
  const total = own.reduce((s, e) => s + entryMs(e, now), 0)

  return (
    <div className={`rounded-2xl border bg-panel ${isRunning ? 'border-accent/50' : 'border-line'}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => (task.done ? reopenTask(task.id) : completeTask(task.id))}
          title={task.done ? 'Wieder öffnen' : 'Erledigt'}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${task.done ? 'border-good bg-good text-bg' : 'border-line hover:border-accent'}`}
        >
          {task.done && <Icon.check className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <div className={`truncate ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</div>
        </button>
        {total > 0 && <span className="tabular text-xs text-muted">{formatDuration(total, isRunning)}</span>}
        {task.done && own.some((e) => e.google_event_id) && <Icon.calendar className="h-4 w-4 text-good" />}
        {!task.done && (
          <button
            onClick={() => (isRunning ? stopTimer() : startTimer(task.id))}
            className={`rounded-xl p-2 ${isRunning ? 'bg-accent text-accent-ink' : 'bg-panel-2 text-white hover:bg-line'}`}
            title={isRunning ? 'Stoppen' : 'Timer starten'}
          >
            {isRunning ? <Icon.stop className="h-4 w-4" /> : <Icon.play className="h-4 w-4" />}
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-line p-3">
          <textarea
            defaultValue={task.notes ?? ''}
            onBlur={(e) => e.target.value !== (task.notes ?? '') && updateTask(task.id, { notes: e.target.value })}
            placeholder="Notizen…"
            rows={2}
            className={inputCls}
          />
          {own.length > 0 && (
            <div className="flex flex-col gap-1">
              {own.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs text-muted">
                  <span className="tabular">
                    {new Date(e.started_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}
                    {formatDuration(entryMs(e, now))}
                    {e.google_event_id && ' · im Kalender'}
                  </span>
                  {e.ended_at && (
                    <button onClick={() => deleteEntry(e.id)} className="text-muted hover:text-bad">
                      <Icon.trash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={`${inputCls} w-20`}
            />
            <Button
              onClick={() => {
                const m = Number(minutes)
                if (m > 0) addManualEntry(task.id, new Date(Date.now() - m * 60_000), m)
              }}
            >
              <Icon.clock className="h-4 w-4" /> Min. nachtragen
            </Button>
            <div className="flex-1" />
            <Button variant="danger" onClick={() => confirm('Task löschen?') && deleteTask(task.id)}>
              <Icon.trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
