import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/useStore'
import { useLocalState } from '../lib/useLocalState'
import { addDays, dayKey, startOfDay } from '../lib/time'
import type { RecurringTask } from '../lib/types'
import { AddTaskInput } from '../components/AddTaskInput'
import { QuestFilter } from '../components/QuestPicker'
import { RepeatForm, describeRule } from '../components/RepeatDialog'
import { Button, Icon, IconButton, Modal } from '../components/ui'
import { TaskList } from './HomeView'
import { openFirst } from '../lib/tasks'
import { DRAG_TYPE } from '../components/dnd'

const PAST_DAYS = 14
const FUTURE_DAYS = 41
const COL = 316 // Spaltenbreite inkl. Abstand (Desktop)

export function PlanView({ filter, setFilter }: { filter: string[]; setFilter: (ids: string[]) => void }) {
  const { tasksOn, addTask, moveTask, quests } = useStore()
  const [showOther, setShowOther] = useLocalState('mainquest.planOtherOpen', false)
  const [questId, setQuestId] = useLocalState<string | null>('mainquest.lastQuest', null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [dragDay, setDragDay] = useState<string | null>(null)
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
    // Position der Spalte relativ zum sichtbaren Bereich, unabhängig von offsetParent und Padding
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const delta = col.getBoundingClientRect().left - el.getBoundingClientRect().left - pad
    const offset = el.clientWidth > 900 ? 2 * COL : 0
    el.scrollTo({ left: el.scrollLeft + delta - offset, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => scrollToToday(), [])
  useEffect(() => {
    const reset = () => setDragDay(null)
    window.addEventListener('dragend', reset)
    return () => window.removeEventListener('dragend', reset)
  }, [])

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const first = el.querySelector<HTMLElement>('[data-col]')
    const w = first ? first.offsetWidth + 16 : COL
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor((el.scrollLeft + el.clientWidth / 2) / w)))
    if (days[idx].getMonth() !== month.getMonth()) setMonth(days[idx])
  }

  const questTasks = (day: string) =>
    openFirst(tasksOn(day).filter((t) => t.quest_id && (filter.length === 0 || filter.includes(t.quest_id))))
  const otherTasks = (day: string) => (filter.length ? [] : openFirst(tasksOn(day).filter((t) => !t.quest_id)))

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="mb-4 flex items-center gap-2 md:mb-6 md:gap-3">
        <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
          <span className="md:hidden">Plan</span>
          <span className="hidden md:inline">Woche planen</span>
        </h1>
        <QuestFilter value={filter} onChange={setFilter} />
        <div className="flex-1" />
        <span className="hidden text-lg text-white/60 sm:inline">
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
          title={showOther ? 'Sonstiges überall einklappen' : 'Sonstiges überall aufklappen'}
          active={showOther}
        >
          {showOther ? <Icon.eye className="h-4 w-4" /> : <Icon.eyeOff className="h-4 w-4" />}
        </IconButton>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative -mx-4 flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 md:-mx-8 md:snap-none md:scroll-px-8 md:gap-4 md:px-8 [scrollbar-width:none]"
      >
        {days.map((d) => {
          const key = dayKey(d)
          const isToday = key === todayKey
          const past = key < todayKey
          const all = tasksOn(key)
          const allDone = all.length > 0 && all.every((t) => t.done)
          return (
            <div
              key={key}
              data-col
              {...(isToday ? { 'data-today': true } : {})}
              // Ganze Spalte ist Ablagefläche (auch leere Tage); Listen darin bestimmen die genaue Position
              onDragOver={(e) => {
                if (past || !e.dataTransfer.types.includes(DRAG_TYPE)) return
                e.preventDefault()
                if (dragDay !== key) setDragDay(key)
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragDay(null)}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(DRAG_TYPE)
                e.preventDefault()
                setDragDay(null)
                if (id && !past) moveTask(id, key, null)
              }}
              className={`flex w-[calc(100vw-2rem)] shrink-0 snap-start snap-always flex-col rounded-2xl border p-3 transition-colors md:w-[300px] md:snap-normal ${dragDay === key ? 'border-accent/40 bg-accent/[0.03]' : 'border-white/[0.06] bg-white/[0.015]'}`}
            >
              <div className={`mb-3 border-b-2 px-1 pb-2.5 text-base ${isToday ? 'border-accent text-white' : 'border-white/[0.06] text-white/50'}`}>
                <span className="md:hidden">{d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="hidden md:inline">
                  {d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}{' '}
                  <span className={isToday ? 'text-accent' : ''}>{d.getDate()}</span>
                </span>
                {isToday && <span className="ml-2 text-sm text-accent md:hidden">Heute</span>}
                {allDone && (
                  <span className="float-right flex items-center gap-1 text-xs text-good/80">
                    <Icon.check className="h-3.5 w-3.5" /> Alles erledigt
                  </span>
                )}
              </div>
              <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2 [&>*]:shrink-0">
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
                <TaskList tasks={questTasks(key)} onDrop={past ? undefined : (id, before) => moveTask(id, key, before)} compact showTimer={false} />
                {otherTasks(key).length > 0 && (
                  <>
                    <button
                      onClick={() => setShowOther(!showOther)}
                      className="flex items-center gap-1.5 px-1 pt-1 text-sm text-white/40 transition hover:text-white"
                    >
                      <Icon.chevron className={`h-3.5 w-3.5 transition ${showOther ? 'rotate-90' : ''}`} />
                      Sonstiges <span className="tabular text-white/30">{otherTasks(key).length}</span>
                    </button>
                    {showOther && (
                      <TaskList tasks={otherTasks(key)} onDrop={past ? undefined : (id, before) => moveTask(id, key, before)} compact showTimer={false} />
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {recurringOpen && <RecurringDialog onClose={() => setRecurringOpen(false)} />}
    </div>
  )
}

function RecurringDialog({ onClose }: { onClose: () => void }) {
  const { recurring, quests, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const [editing, setEditing] = useState<RecurringTask | 'new' | null>(null)

  return (
    <Modal title="Wiederkehrende Tasks" icon={<Icon.repeat className="h-5 w-5" />} onClose={onClose} wide>
      {editing ? (
        <RepeatForm
          standalone
          initial={editing === 'new' ? { unit: 'week' } : editing}
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
            Diese Tasks werden automatisch in deinen Plan eingetragen (zwei Wochen im Voraus). Du kannst auch direkt an
            einem Task auf das Wiederholen-Symbol klicken.
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
                    <div className="truncate text-xs text-muted">
                      {describeRule(r)}
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
