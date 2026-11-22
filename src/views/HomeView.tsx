import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../lib/useStore'
import { useNow } from '../lib/useNow'
import { useLocalState } from '../lib/useLocalState'
import { openFirst } from '../lib/tasks'
import { addDays, dayKey, formatDuration, hm, longDate, overlapMs, startOfDay, startOfWeek } from '../lib/time'
import type { Task, TimeEntry } from '../lib/types'
import { AddTaskInput } from '../components/AddTaskInput'
import { QuestFilter } from '../components/QuestPicker'
import { TaskCard } from '../components/TaskCard'
import { Timeline } from '../components/Timeline'
import { EntryEditor } from '../components/EntryEditor'
import { DropLine, useDropList } from '../components/dnd'
import { Icon, IconButton } from '../components/ui'


export function HomeView() {
  const { tasksOn, quests, addTask, moveTask } = useStore()
  const today = dayKey()
  const [filter, setFilter] = useLocalState<string[]>('mainquest.homeFilter', [])
  const [questId, setQuestId] = useLocalState<string | null>('mainquest.lastQuest', null)
  const [showOther, setShowOther] = useLocalState('mainquest.homeOtherOpen', false)
  const [editing, setEditing] = useState<TimeEntry | null>(null)

  const all = tasksOn(today)
  const validQuest = quests.some((q) => q.id === questId && q.status === 'active') ? questId : null
  const questWork = openFirst(all.filter((t) => t.quest_id && (filter.length === 0 || filter.includes(t.quest_id))))
  const other = openFirst(all.filter((t) => !t.quest_id))
  const drop = (id: string, before: string | null) => moveTask(id, today, before)

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{longDate(new Date())}</h1>
        <TimeStats />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <div className="min-w-0">
          <Section title="Quest-Arbeit" right={<QuestFilter value={filter} onChange={setFilter} />}>
            <AddTaskInput
              placeholder="Quest-Arbeit hinzufügen…"
              questId={validQuest}
              onQuestChange={setQuestId}
              onAdd={(title, at) => addTask(title, validQuest, today, at)}
            />
            <TaskList tasks={questWork} onDrop={drop} empty="Noch keine Quest-Arbeit für heute." />
          </Section>

          <Section
            title="Sonstiges"
            right={
              <IconButton onClick={() => setShowOther(!showOther)} title={showOther ? 'Ausblenden' : 'Einblenden'}>
                {showOther ? <Icon.eye className="h-4 w-4" /> : <Icon.eyeOff className="h-4 w-4" />}
              </IconButton>
            }
          >
            {showOther ? (
              <>
                <AddTaskInput placeholder="Task hinzufügen…" onAdd={(title, at) => addTask(title, null, today, at)} />
                <TaskList tasks={other} onDrop={drop} />
              </>
            ) : (
              <p className="text-sm text-muted">{other.length} ausgeblendet</p>
            )}
          </Section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Timeline days={[startOfDay()]} onEntryClick={setEditing} className="h-[28rem] lg:h-[calc(100dvh-7.5rem)]" />
        </div>
      </div>

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-white/45">{title}</h2>
        {right}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function TaskList({
  tasks,
  onDrop,
  empty,
  compact,
  showTimer = true,
}: {
  tasks: Task[]
  onDrop: (id: string, before: string | null) => void
  empty?: string
  compact?: boolean
  showTimer?: boolean
}) {
  const { ref, before, handlers } = useDropList(onDrop)
  return (
    <div ref={ref} {...handlers} className="flex min-h-12 flex-col gap-3">
      {tasks.map((t) => (
        <div key={t.id} className="flex flex-col gap-3">
          {before === t.id && <DropLine />}
          <TaskCard task={t} compact={compact} showTimer={showTimer} />
        </div>
      ))}
      {before === null && <DropLine />}
      {tasks.length === 0 && empty && before === undefined && <p className="px-1 text-sm text-white/30">{empty}</p>}
    </div>
  )
}

/** "9h 38m heute" + Wochenfortschritt */
function TimeStats() {
  const { entries, running, settings } = useStore()
  const now = useNow(Boolean(running), 15_000)
  const { todayMs, weekMs } = useMemo(() => {
    const t = startOfDay(new Date(now))
    const tomorrow = addDays(t, 1)
    const sum = (a: Date) => entries.reduce((s, e) => s + overlapMs(e, a, tomorrow, now), 0)
    return { todayMs: sum(t), weekMs: sum(startOfWeek(new Date(now))) }
  }, [entries, now])
  const { h, m } = hm(todayMs)
  const goalMs = (settings.weekly_goal_minutes ?? 0) * 60_000
  const pct = goalMs ? Math.min(100, (weekMs / goalMs) * 100) : 0

  return (
    <div className="flex items-end gap-6">
      <div className="tabular flex items-baseline">
        <span className="text-2xl font-medium">{h}</span>
        <span className="ml-0.5 mr-2 text-muted">h</span>
        <span className="text-2xl font-medium">{m}</span>
        <span className="ml-0.5 text-muted">m heute</span>
      </div>
      <div className="w-44 pb-1">
        {goalMs > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="tabular mt-1.5 text-xs text-muted">
          {formatDuration(weekMs).replace(' min', 'm').replace(' h', 'h')} diese Woche
          {goalMs > 0 && ` / ${Math.round(goalMs / 3_600_000)}h`}
        </div>
      </div>
    </div>
  )
}
