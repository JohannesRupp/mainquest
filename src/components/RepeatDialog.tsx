import { useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { dayKey } from '../lib/time'
import type { RecurringInput, RecurringTask, Task } from '../lib/types'
import { QuestPicker } from './QuestPicker'
import { Button, Icon, Modal, inputCls } from './ui'

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Kurzbeschreibung einer Regel, z. B. "Alle 2 Wochen · Mo, Mi" */
export function describeRule(r: RecurringTask): string {
  const n = r.interval_count ?? 1
  const unit = r.unit ?? 'week'
  const every = unit === 'day' ? (n === 1 ? 'Täglich' : `Alle ${n} Tage`) : n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`
  const days = unit === 'week' ? ` · ${r.weekdays.length === 7 ? 'jeden Tag' : [...r.weekdays].sort().map((d) => WEEKDAYS[d - 1]).join(', ')}` : ''
  const end = r.ends_on ? ` · bis ${new Date(r.ends_on).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : ''
  return every + days + end
}

const selectCls = `${inputCls} appearance-none pr-9`

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  )
}

export function RepeatForm({
  initial,
  standalone,
  onSave,
  onCancel,
  onRemove,
}: {
  initial: Partial<RecurringInput>
  /** Titel und Quest mit abfragen (Regel ohne bestehenden Task) */
  standalone?: boolean
  onSave: (r: RecurringInput) => void
  onCancel: () => void
  onRemove?: () => void
}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [questId, setQuestId] = useState<string | null>(initial.quest_id ?? null)
  const [count, setCount] = useState(String(initial.interval_count ?? 1))
  const [unit, setUnit] = useState<'day' | 'week'>(initial.unit ?? 'day')
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays ?? [1, 2, 3, 4, 5])
  const [start, setStart] = useState(initial.starts_on ?? dayKey())
  const [endMode, setEndMode] = useState<'never' | 'date'>(initial.ends_on ? 'date' : 'never')
  const [end, setEnd] = useState(initial.ends_on ?? '')
  const toggle = (d: number) => setWeekdays(weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d])

  const n = Math.max(1, Math.floor(Number(count) || 1))
  const valid = (!standalone || title.trim()) && (unit === 'day' || weekdays.length > 0) && (endMode === 'never' || (end && end >= start))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({
          title: title.trim(),
          quest_id: questId,
          interval_count: n,
          unit,
          weekdays: unit === 'week' ? [...weekdays].sort() : [1, 2, 3, 4, 5, 6, 7],
          starts_on: start,
          ends_on: endMode === 'date' ? end : null,
        })
      }}
      className="flex flex-col gap-4"
    >
      {standalone && (
        <>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Lineare Algebra Übungsblätter" className={inputCls} />
          <Row label="Quest">
            <div>
              <QuestPicker value={questId} onChange={setQuestId} />
            </div>
          </Row>
        </>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2/40 p-3">
        <span className="text-sm text-muted">Alle</span>
        <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} className={`${inputCls} w-20`} />
        <div className="relative flex-1">
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'day' | 'week')} className={selectCls}>
            <option value="day">{n === 1 ? 'Tag' : 'Tage'}</option>
            <option value="week">{n === 1 ? 'Woche' : 'Wochen'}</option>
          </select>
          <Icon.chevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted" />
        </div>
      </div>

      {unit === 'week' && (
        <Row label="An">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggle(i + 1)}
                className={`h-9 w-10 rounded-lg border text-sm transition ${weekdays.includes(i + 1) ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
      )}

      <Row label="Beginnt">
        <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className={inputCls} />
      </Row>

      <Row label="Endet">
        <div className="flex gap-2">
          <div className="relative w-36 shrink-0">
            <select value={endMode} onChange={(e) => setEndMode(e.target.value as 'never' | 'date')} className={selectCls}>
              <option value="never">Nie</option>
              <option value="date">Am Datum</option>
            </select>
            <Icon.chevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted" />
          </div>
          {endMode === 'date' && (
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} min-w-0`} />
          )}
        </div>
      </Row>

      <div className="mt-2 flex items-center gap-2 border-t border-line pt-4">
        {onRemove && (
          <Button type="button" variant="danger" onClick={onRemove}>
            Nicht mehr wiederholen
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="subtle" className="border border-line" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button variant="primary" disabled={!valid}>
          Speichern
        </Button>
      </div>
    </form>
  )
}

/** Wiederholung für einen bestehenden Task einrichten oder ändern */
export function RepeatDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { recurring, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const rule = recurring.find((r) => r.id === task.recurring_id)

  return (
    <Modal title="Wiederholen" subtitle={task.title} icon={<Icon.repeat className="h-5 w-5" />} onClose={onClose}>
      <RepeatForm
        initial={rule ?? { starts_on: task.scheduled_on, unit: 'day' }}
        onCancel={onClose}
        onRemove={
          rule
            ? async () => {
                await deleteRecurring(rule.id, task.id)
                onClose()
              }
            : undefined
        }
        onSave={async (r) => {
          const input = { ...r, title: task.title, quest_id: task.quest_id }
          if (rule) await updateRecurring(rule.id, input, task.id)
          else await addRecurring(input, task.id)
          onClose()
        }}
      />
    </Modal>
  )
}
