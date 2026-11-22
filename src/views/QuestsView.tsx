import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { addDays, entryMs, fmtHM, overlapMs, startOfDay, startOfWeek } from '../lib/time'
import type { Quest } from '../lib/types'
import { Button, Icon, Modal, QUEST_COLORS, inputCls } from '../components/ui'

type Tab = 'active' | 'finished'

/** Nächste Farbe: erste, die noch keine aktive Quest hat, sonst reihum */
function nextColor(quests: Quest[]): string {
  const used = new Set(quests.filter((q) => q.status === 'active').map((q) => q.color))
  return QUEST_COLORS.find((c) => !used.has(c)) ?? QUEST_COLORS[quests.length % QUEST_COLORS.length]
}

export function QuestsView({ openQuest }: { openQuest: (id: string) => void }) {
  const { quests, tasks, entries } = useStore()
  const [tab, setTab] = useState<Tab>('active')
  const [editing, setEditing] = useState<Quest | 'new' | null>(null)

  const active = quests.filter((q) => q.status === 'active')
  const finished = quests.filter((q) => q.status !== 'active')
  const questTaskIds = useMemo(() => new Set(tasks.filter((t) => t.quest_id).map((t) => t.id)), [tasks])
  const allTime = entries.filter((e) => questTaskIds.has(e.task_id)).reduce((s, e) => s + entryMs(e), 0)
  const list = tab === 'active' ? active : finished

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Quests</h1>
          <p className="mt-2 text-white/50">Gib deiner Zeit ein Ziel. Mach Platz für das, was kommt.</p>
        </div>
        <Button variant="primary" className="px-5 py-2.5" onClick={() => setEditing('new')}>
          <Icon.plus className="h-4 w-4" /> Neue Quest
        </Button>
      </div>

      <div className="mb-8 grid overflow-hidden rounded-2xl border border-line bg-panel sm:grid-cols-3">
        <Stat label="Quest-Stunden · gesamt" value={fmtHM(allTime)} />
        <Stat label="In Arbeit" value={String(active.length).padStart(2, '0')} />
        <Stat
          label={
            <span className="flex items-center gap-2">
              <Icon.trophy className="h-4 w-4 text-accent" /> Abgeschlossen
            </span>
          }
          value={String(quests.filter((q) => q.status === 'done').length).padStart(2, '0')}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex rounded-xl border border-line bg-panel p-1 text-[15px]">
          {(
            [
              ['active', `Aktiv · ${active.length}`],
              ['finished', `Abgeschlossen · ${finished.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-1.5 transition ${tab === id ? 'bg-panel-2 text-white' : 'text-white/45 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-white/45">Kleine Schritte. Große Ergebnisse.</span>
      </div>

      <p className="mb-5 text-sm text-white/45">Klick auf eine Quest, um sie zu bearbeiten oder abzuschließen.</p>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((q) => (
          <QuestCard key={q.id} quest={q} onClick={() => setEditing(q)} />
        ))}
        {tab === 'active' && (
          <button
            onClick={() => setEditing('new')}
            className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.12] text-white/45 transition hover:border-white/25 hover:text-white"
          >
            <Icon.plus className="h-6 w-6" />
            Neue Quest
          </button>
        )}
        {tab === 'finished' && finished.length === 0 && <p className="text-sm text-white/40">Noch keine abgeschlossenen Quests.</p>}
      </div>

      {editing && (
        <QuestEditor
          quest={editing === 'new' ? null : editing}
          defaultColor={nextColor(quests)}
          onClose={() => setEditing(null)}
          onOpenTasks={(id) => {
            setEditing(null)
            openQuest(id)
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="border-line px-7 py-6 sm:border-l sm:first:border-l-0 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0">
      <div className="text-[15px] text-white/50">{label}</div>
      <div className="tabular mt-2 text-3xl font-medium">{value}</div>
    </div>
  )
}

function QuestCard({ quest, onClick }: { quest: Quest; onClick: () => void }) {
  const { tasks, entries } = useStore()
  const { weekMs, totalMs, points } = useMemo(() => {
    const ids = new Set(tasks.filter((t) => t.quest_id === quest.id).map((t) => t.id))
    const own = entries.filter((e) => ids.has(e.task_id))
    const week = startOfWeek()
    const today = startOfDay()
    // kumulierte Zeit über die letzten 14 Tage für die Verlaufslinie
    const points = Array.from({ length: 14 }, (_, i) => {
      const end = addDays(today, i - 12)
      return own.reduce((s, e) => s + overlapMs(e, new Date(0), end), 0)
    })
    return {
      weekMs: own.reduce((s, e) => s + overlapMs(e, week, addDays(week, 7)), 0),
      totalMs: own.reduce((s, e) => s + entryMs(e), 0),
      points,
    }
  }, [tasks, entries, quest.id])
  const goalMs = (quest.weekly_goal_minutes ?? 0) * 60_000

  return (
    <button
      onClick={onClick}
      className={`relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-line bg-panel p-6 text-left transition hover:border-white/15 ${quest.status !== 'active' ? 'opacity-60' : ''}`}
    >
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${quest.color}aa, transparent)` }} />
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04]" style={{ color: quest.color }}>
          <Icon.rocket className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-1.5">
          <h3 className="text-lg leading-snug">{quest.title}</h3>
          {quest.status === 'done' && <span className="text-xs text-good">✓ geschafft</span>}
        </div>
      </div>
      <div className="flex-1" />
      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <div className="tabular text-4xl font-medium tracking-tight">
            {fmtHM(weekMs)}
            {goalMs > 0 && <span className="ml-1.5 text-base font-normal text-white/40">/ {fmtHM(goalMs).replace(' 0m', '')}</span>}
          </div>
          <div className="mt-1.5 text-xs uppercase tracking-[0.15em] text-white/45">Diese Woche</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Sparkline points={points} color={quest.color} />
          <span className="tabular text-xs text-white/45">{totalMs > 0 ? `${fmtHM(totalMs)} gesamt` : 'noch keine Zeit'}</span>
        </div>
      </div>
      {goalMs > 0 && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (weekMs / goalMs) * 100)}%`, background: quest.color }} />
        </div>
      )}
    </button>
  )
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 150
  const h = 40
  const max = Math.max(...points, 1)
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (w - 4) + 2, h - 3 - (v / max) * (h - 6)])
  const last = xy[xy.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" opacity={0.9} />
      <circle cx={last[0]} cy={last[1]} r={2.75} fill={color} />
    </svg>
  )
}

function QuestEditor({
  quest,
  defaultColor,
  onClose,
  onOpenTasks,
}: {
  quest: Quest | null
  defaultColor: string
  onClose: () => void
  onOpenTasks: (id: string) => void
}) {
  const { addQuest, updateQuest, deleteQuest } = useStore()
  const [title, setTitle] = useState(quest?.title ?? '')
  const [description, setDescription] = useState(quest?.description ?? '')
  const [color, setColor] = useState(quest?.color ?? defaultColor)
  const [goal, setGoal] = useState(quest?.weekly_goal_minutes ? String(quest.weekly_goal_minutes / 60) : '')

  async function save() {
    if (!title.trim()) return
    const h = Number(goal)
    const weekly_goal_minutes = h > 0 ? Math.round(h * 60) : null
    const data = { title: title.trim(), description: description.trim() || null, color }
    if (quest) await updateQuest(quest.id, { ...data, weekly_goal_minutes })
    else await addQuest({ ...data, weekly_goal_minutes })
    onClose()
  }

  const setStatus = async (status: Quest['status']) => {
    if (!quest) return
    await updateQuest(quest.id, { status })
    onClose()
  }

  return (
    <Modal title={quest ? 'Quest bearbeiten' : 'Neue Quest'} icon={<Icon.rocket className="h-5 w-5" />} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex flex-col gap-4"
      >
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel, z. B. Lineare Algebra" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Worum geht's? (optional)" rows={2} className={inputCls} />
        <div className="flex flex-wrap gap-2.5">
          {QUEST_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : 'opacity-70 hover:opacity-100'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Wochenziel</span>
          <span className="flex items-center gap-2 text-muted">
            <input type="number" min={0} step={0.5} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="–" className={`${inputCls} w-24 text-right`} />
            Std. / Woche
          </span>
        </label>

        {quest && (
          <div className="flex flex-wrap gap-1 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenTasks(quest.id)}>
              <Icon.plan className="h-4 w-4" /> Im Plan zeigen
            </Button>
            {quest.status === 'active' ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setStatus('done')}>
                  <Icon.check className="h-4 w-4" /> Abschließen
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStatus('archived')}>
                  Archivieren
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setStatus('active')}>
                <Icon.undo className="h-4 w-4" /> Reaktivieren
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!confirm(`Quest „${quest.title}“ löschen? Tasks bleiben erhalten.`)) return
                await deleteQuest(quest.id)
                onClose()
              }}
            >
              <Icon.trash className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="subtle" className="border border-line" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!title.trim()}>
            {quest ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
