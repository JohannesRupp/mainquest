import { useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { entryMs, formatDuration } from '../lib/time'
import type { Task } from '../lib/types'
import { DRAG_TYPE } from './dnd'
import { QuestPicker } from './QuestPicker'
import { RepeatDialog } from './RepeatDialog'
import { Button, Icon, inputCls } from './ui'

/** Task-Karte: Titel oben, darunter Abhaken, Quest-Chip, Zeit und Play */
export function TaskCard({ task, showTimer = true, compact }: { task: Task; showTimer?: boolean; compact?: boolean }) {
  const { quests, entries, running, startTimer, stopTimer, completeTask, reopenTask, updateTask, deleteTask, moveTask, addManualEntry } =
    useStore()
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [minutes, setMinutes] = useState('30')
  const [repeatOpen, setRepeatOpen] = useState(false)
  const quest = quests.find((q) => q.id === task.quest_id)
  const color = quest?.color ?? '#5a5a63'
  const isRunning = running?.task_id === task.id
  const now = useNow(isRunning)
  const total = entries.filter((e) => e.task_id === task.id).reduce((s, e) => s + entryMs(e, now), 0)

  return (
    <div
      data-task-id={task.id}
      draggable={!open}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={`group relative rounded-xl border bg-panel transition ${dragging ? 'opacity-40' : ''} ${isRunning ? 'border-accent/40' : 'border-white/[0.07] hover:border-white/[0.13]'} ${compact ? 'py-2.5 pl-4 pr-2.5' : 'py-3 pl-5 pr-3.5'}`}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl" style={{ background: color, opacity: task.done ? 0.4 : 1 }} />

      <button
        onClick={() => setOpen((o) => !o)}
        className={`block w-full text-left leading-snug ${compact ? 'text-sm' : 'text-[15px]'} ${task.done ? 'text-white/35 line-through' : 'text-white'}`}
      >
        {task.title}
      </button>

      <div className={`flex items-center gap-2 ${compact ? 'mt-2.5' : 'mt-3'} ${task.done ? 'opacity-50' : ''}`}>
        <button
          onClick={() => (task.done ? reopenTask(task.id) : completeTask(task.id))}
          title={task.done ? 'Wieder öffnen' : 'Erledigt'}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${task.done ? '' : 'border-white/20 text-white/40 hover:border-accent hover:text-accent'}`}
          style={task.done ? { background: color, borderColor: color, color: '#09090b' } : undefined}
        >
          <Icon.check className="h-3.5 w-3.5" />
        </button>
        <div className={`min-w-0 ${compact ? 'max-w-[9.5rem]' : 'max-w-[17rem]'}`}>
          <QuestPicker value={task.quest_id} onChange={(id) => updateTask(task.id, { quest_id: id })} />
        </div>
        <button
          onClick={() => setRepeatOpen(true)}
          title={task.recurring_id ? 'Wiederholung bearbeiten' : 'Wiederholen'}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition hover:bg-panel-2 hover:text-white ${task.recurring_id ? 'text-white/40' : 'text-white/25 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
        >
          <Icon.repeat className="h-3.5 w-3.5" />
        </button>

        {showTimer && !task.done && (
          <div className="ml-6 flex items-center gap-2">
            {total > 0 && (
              <span className={`tabular text-sm ${isRunning ? 'text-accent' : 'text-white/60'}`}>{formatDuration(total, true)}</span>
            )}
            <button
              onClick={() => (isRunning ? stopTimer() : startTimer(task.id))}
              title={isRunning ? 'Pausieren' : 'Timer starten'}
              className={`grid h-8 w-8 place-items-center rounded-lg transition ${isRunning ? 'text-accent hover:bg-accent/10' : 'text-white/45 hover:bg-panel-2 hover:text-white'}`}
            >
              {isRunning ? <Icon.pause className="h-4 w-4" /> : <Icon.playFill className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <input
            defaultValue={task.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(task.id, { title: e.target.value.trim() })}
            className={inputCls}
          />
          <textarea
            defaultValue={task.notes ?? ''}
            onBlur={(e) => e.target.value !== (task.notes ?? '') && updateTask(task.id, { notes: e.target.value })}
            placeholder="Notizen…"
            rows={2}
            className={inputCls}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 text-muted">
              Tag
              <input
                type="date"
                value={task.scheduled_on}
                onChange={(e) => e.target.value && moveTask(task.id, e.target.value, null)}
                className={`${inputCls} w-auto py-1.5`}
              />
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputCls} w-20 py-1.5`} />
              <Button
                onClick={() => {
                  const m = Number(minutes)
                  if (m > 0) addManualEntry(task.id, new Date(Date.now() - m * 60_000), m)
                }}
              >
                <Icon.clock className="h-4 w-4" /> Min. nachtragen
              </Button>
            </div>
            <div className="flex-1" />
            <Button variant="danger" onClick={() => confirm('Task löschen?') && deleteTask(task.id)}>
              <Icon.trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {repeatOpen && <RepeatDialog task={task} onClose={() => setRepeatOpen(false)} />}
    </div>
  )
}
