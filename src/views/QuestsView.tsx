import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { addDays, entryMs, formatDuration, overlapMs, startOfWeek } from '../lib/time'
import type { Quest } from '../lib/types'
import { Button, Card, Icon, QUEST_COLORS, SectionTitle, inputCls } from '../components/ui'

export function QuestsView({ openQuest }: { openQuest: (id: string) => void }) {
  const { quests, addQuest } = useStore()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(QUEST_COLORS[0])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addQuest({ title: title.trim(), description: description.trim() || null, color })
    setTitle('')
    setDescription('')
    setColor(QUEST_COLORS[(quests.length + 1) % QUEST_COLORS.length])
    setAdding(false)
  }

  const active = quests.filter((q) => q.status === 'active')
  const finished = quests.filter((q) => q.status !== 'active')

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quests</h1>
        <Button variant="primary" onClick={() => setAdding((a) => !a)}>
          <Icon.plus className="h-4 w-4" /> Neue Quest
        </Button>
      </div>

      {adding && (
        <Card className="mb-6">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel, z. B. Bachelorarbeit" className={inputCls} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Worum geht's? (optional)" rows={2} className={inputCls} />
            <div className="flex gap-2">
              {QUEST_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
              <Button variant="primary">Anlegen</Button>
            </div>
          </form>
        </Card>
      )}

      {active.length === 0 && !adding && (
        <Card className="text-center text-sm text-muted">Noch keine Quests. Leg deine erste große Mission an.</Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((q) => (
          <QuestCard key={q.id} quest={q} onOpen={() => openQuest(q.id)} />
        ))}
      </div>

      {finished.length > 0 && (
        <>
          <SectionTitle>Abgeschlossen &amp; archiviert</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {finished.map((q) => (
              <QuestCard key={q.id} quest={q} onOpen={() => openQuest(q.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QuestCard({ quest, onOpen }: { quest: Quest; onOpen: () => void }) {
  const { tasks, entries, updateQuest, deleteQuest } = useStore()
  const own = tasks.filter((t) => t.quest_id === quest.id)
  const done = own.filter((t) => t.done).length
  const ids = new Set(own.map((t) => t.id))
  const time = entries.filter((e) => ids.has(e.task_id)).reduce((s, e) => s + entryMs(e), 0)
  const pct = own.length ? Math.round((done / own.length) * 100) : 0
  const week = startOfWeek()
  const weekMs = entries.filter((e) => ids.has(e.task_id)).reduce((s, e) => s + overlapMs(e, week, addDays(week, 7)), 0)
  const goalMs = (quest.weekly_goal_minutes ?? 0) * 60_000

  return (
    <Card className={quest.status !== 'active' ? 'opacity-60' : ''}>
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: quest.color }} />
          <h3 className="flex-1 truncate font-semibold">{quest.title}</h3>
          {quest.status === 'done' && <span className="text-xs text-good">✓ geschafft</span>}
        </div>
        {quest.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{quest.description}</p>}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: quest.color }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{done}/{own.length} Tasks</span>
          <span className="tabular">{formatDuration(time)} gesamt</span>
        </div>
      </button>
      <div className="mt-4 rounded-xl bg-panel-2/50 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted">Diese Woche</span>
          <label className="flex items-center gap-1.5 text-muted">
            Ziel
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={quest.weekly_goal_minutes ? quest.weekly_goal_minutes / 60 : ''}
              placeholder="–"
              onBlur={(e) => {
                const h = Number(e.target.value)
                const minutes = h > 0 ? Math.round(h * 60) : null
                if (minutes !== quest.weekly_goal_minutes) updateQuest(quest.id, { weekly_goal_minutes: minutes })
              }}
              className="w-14 rounded-md border border-line bg-bg px-1.5 py-0.5 text-right text-white outline-none focus:border-accent"
              style={{ fontSize: 13 }}
            />
            h / Woche
          </label>
        </div>
        <div className="tabular mt-2 text-sm">
          {formatDuration(weekMs)}
          {goalMs > 0 && <span className="text-muted"> von {formatDuration(goalMs)}</span>}
        </div>
        {goalMs > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (weekMs / goalMs) * 100)}%`, background: quest.color }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-1 border-t border-line pt-3">
        {quest.status === 'active' ? (
          <>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => updateQuest(quest.id, { status: 'done' })}>
              <Icon.check className="h-3.5 w-3.5" /> Abschließen
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => updateQuest(quest.id, { status: 'archived' })}>
              Archivieren
            </Button>
          </>
        ) : (
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => updateQuest(quest.id, { status: 'active' })}>
            <Icon.undo className="h-3.5 w-3.5" /> Reaktivieren
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="danger"
          className="px-2 py-1 text-xs"
          onClick={() => confirm(`Quest „${quest.title}“ löschen? Tasks bleiben erhalten.`) && deleteQuest(quest.id)}
        >
          <Icon.trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
