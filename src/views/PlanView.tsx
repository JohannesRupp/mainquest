import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { useLocalState } from '../lib/useLocalState'
import { addDays, dayKey, startOfDay } from '../lib/time'
import type { RecurringTask } from '../lib/types'
import { AddTaskInput } from '../components/AddTaskInput'
import { QuestFilter, QuestPicker } from '../components/QuestPicker'
import { Button, Icon, IconButton, Modal, inputCls } from '../components/ui'
import { TaskList, openFirst } from './HomeView'

const PAST_DAYS = 14
const FUTURE_DAYS = 41
const COL = 316 // Spaltenbreite inkl. Abstand (Desktop)

export function PlanView({ filter, setFilter }: { filter: string[]; setFilter: (ids: string[]) => void }) {
  const { tasksOn, addTask, moveTask, quests } = useStore()
  const [showOther, setShowOther] = useLocalState('mainquest.planShowOther', false)
  const [questId, setQuestId] = useLocalState<string | null>('mainquest.lastQuest', null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const today = startOfDay()
  const todayKey = dayKey(today)
  const days = useMemo(() => Array.from({ length: PAST_DAYS + FUTURE_DAYS }, (_, i) => addDays(startOfDay(), i - PAST_DAYS)), [])
  const [month, setMonth] = useState(today)
  const validQuest = quests.some((q) => q.id === questId && q.status === 'active') ? questId : null

  function scrollToToday(smooth = false) {
    const el = scroller.current
    const col = el?.querySelector<HTMLElement>('[data-today]')
    if (!el || !col) return
    const offset = el.clientWidth > 900 ? 2 * COL : 0
    el.scrollTo({ left: col.offsetLeft - offset, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => scrollToToday(), [])

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const first = el.querySelector<HTMLElement>('[data-col]')
    const w = first ? first.offsetWidth + 16 : COL
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor((el.scrollLeft + el.clientWidth / 2) / w)))
    if (days[idx].getMonth() !== month.getMonth()) setMonth(days[idx])
  }

  const visible = (day: string) =>
    openFirst(
      tasksOn(day).filter((t) =>
        t.quest_id ? filter.length === 0 || filter.includes(t.quest_id) : showOther && filter.length === 0,
      ),
    )

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-medium tracking-tight">Woche planen</h1>
        <QuestFilter value={filter} onChange={setFilter} />
        <div className="flex-1" />
        <span className="hidden text-xl text-white/60 sm:inline">
          {month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </span>
        <Button variant="subtle" className="border border-line" onClick={() => scrollToToday(true)}>
          Heute
        </Button>
        <Button variant="ghost" onClick={() => setRecurringOpen(true)}>
          <Icon.repeat className="h-4 w-4" /> <span className="hidden sm:inline">Wiederkehrende Tasks</span>
        </Button>
        <IconButton
          onClick={() => setShowOther(!showOther)}
          title={showOther ? 'Tasks ohne Quest ausblenden' : 'Tasks ohne Quest einblenden'}
          active={showOther}
        >
          {showOther ? <Icon.eye className="h-4 w-4" /> : <Icon.eyeOff className="h-4 w-4" />}
        </IconButton>
      </div>

      <div ref={scroller} onScroll={onScroll} className="relative -mx-4 flex flex-1 snap-x gap-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
        {days.map((d) => {
          const key = dayKey(d)
          const isToday = key === todayKey
          const past = key < todayKey
          return (
            <div
              key={key}
              data-col
              {...(isToday ? { 'data-today': true } : {})}
              className="flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3"
            >
              <div className={`mb-3 border-b-2 px-1 pb-2.5 text-lg ${isToday ? 'border-accent text-white' : 'border-white/[0.06] text-white/50'}`}>
                {d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}{' '}
                <span className={isToday ? 'text-accent' : ''}>{d.getDate()}</span>
              </div>
              <div className="-mx-1 flex flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
                {!past && (
                  <AddTaskInput
                    compact
                    placeholder="Task hinzufügen…"
                    questId={validQuest}
                    onQuestChange={setQuestId}
                    onAdd={(title, at) => {
                      addTask(title, validQuest, key, at)
                      if (!validQuest && !showOther) setShowOther(true)
                    }}
                  />
                )}
                <TaskList tasks={visible(key)} onDrop={(id, before) => moveTask(id, key, before)} compact showTimer={false} />
              </div>
            </div>
          )
        })}
      </div>

      {recurringOpen && <RecurringDialog onClose={() => setRecurringOpen(false)} />}
    </div>
  )
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function RecurringDialog({ onClose }: { onClose: () => void }) {
  const { recurring, quests, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const [editing, setEditing] = useState<RecurringTask | 'new' | null>(null)

  return (
    <Modal title="Wiederkehrende Tasks" onClose={onClose} wide>
      {editing ? (
        <RecurringForm
          rule={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (r) => {
            if (editing === 'new') await addRecurring(r)
            else await updateRecurring(editing.id, r)
            setEditing(null)
          }}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Diese Tasks werden automatisch an den gewählten Wochentagen in deinen Plan eingetragen (zwei Wochen im Voraus).
          </p>
          <div className="flex flex-col gap-2">
            {recurring.length === 0 && <p className="text-sm text-white/40">Noch keine wiederkehrenden Tasks.</p>}
            {recurring.map((r) => {
              const q = quests.find((x) => x.id === r.quest_id)
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2/40 px-3 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: q?.color ?? '#8a8a93' }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.title}</div>
                    <div className="text-xs text-muted">
                      {r.weekdays.length === 7 ? 'Täglich' : [...r.weekdays].sort().map((d) => WEEKDAYS[d - 1]).join(', ')}
                      {q && ` · ${q.title}`}
                    </div>
                  </div>
                  <button onClick={() => setEditing(r)} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-white" title="Bearbeiten">
                    <Icon.pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => confirm(`„${r.title}“ löschen? Künftige offene Einträge werden entfernt.`) && deleteRecurring(r.id)}
                    className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad"
                    title="Löschen"
                  >
                    <Icon.trash className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <Button variant="primary" className="mt-4" onClick={() => setEditing('new')}>
            <Icon.plus className="h-4 w-4" /> Neuer wiederkehrender Task
          </Button>
        </>
      )}
    </Modal>
  )
}

function RecurringForm({
  rule,
  onSave,
  onCancel,
}: {
  rule: RecurringTask | null
  onSave: (r: Pick<RecurringTask, 'title' | 'quest_id' | 'weekdays'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(rule?.title ?? '')
  const [questId, setQuestId] = useState<string | null>(rule?.quest_id ?? null)
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? [1, 2, 3, 4, 5])
  const toggle = (d: number) => setWeekdays(weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim() && weekdays.length) onSave({ title: title.trim(), quest_id: questId, weekdays: [...weekdays].sort() })
      }}
      className="flex flex-col gap-4"
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Lineare Algebra Übungsblätter" className={inputCls} />
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">Quest</span>
        <QuestPicker value={questId} onChange={setQuestId} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => toggle(i + 1)}
            className={`h-10 w-11 rounded-lg border text-sm transition ${weekdays.includes(i + 1) ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button variant="primary" disabled={!title.trim() || !weekdays.length}>
          Speichern
        </Button>
      </div>
    </form>
  )
}
