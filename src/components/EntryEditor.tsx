import { useState } from 'react'
import { useStore } from '../lib/useStore'
import { entryMs, formatDuration, toLocalInput } from '../lib/time'
import type { TimeEntry } from '../lib/types'
import { Button, Icon, Modal, inputCls } from './ui'

/** Zeiteintrag bearbeiten oder löschen */
export function EntryEditor({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  const { tasks, quests, updateEntry, deleteEntry } = useStore()
  const task = tasks.find((t) => t.id === entry.task_id)
  const quest = quests.find((q) => q.id === task?.quest_id)
  const [start, setStart] = useState(toLocalInput(entry.started_at))
  const [end, setEnd] = useState(entry.ended_at ? toLocalInput(entry.ended_at) : '')
  const running = !entry.ended_at

  const preview =
    start && end ? entryMs({ ...entry, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString() }) : 0

  async function save() {
    if (running || !start || !end) return
    await updateEntry(entry.id, { started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString() })
    onClose()
  }

  return (
    <Modal title="Zeiteintrag bearbeiten" onClose={onClose}>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="h-2 w-2 rounded-full" style={{ background: quest?.color ?? '#8a8a93' }} />
        <span className="truncate">{task?.title ?? 'Gelöschter Task'}</span>
      </div>
      {running ? (
        <p className="text-sm text-muted">Dieser Timer läuft noch. Stoppe ihn zuerst, um ihn zu bearbeiten.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Start</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Ende</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </label>
          <p className="tabular text-sm text-muted">
            Dauer: {preview > 0 ? formatDuration(preview) : 'ungültig'}
            {entry.google_event_id && ' · Der Kalendertermin wird mit angepasst.'}
          </p>
        </div>
      )}
      <div className="mt-5 flex items-center gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm('Zeiteintrag löschen?')) return
            await deleteEntry(entry.id)
            onClose()
          }}
          disabled={running}
        >
          <Icon.trash className="h-4 w-4" /> Löschen
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        {!running && (
          <Button variant="primary" onClick={save} disabled={preview <= 0}>
            Speichern
          </Button>
        )}
      </div>
    </Modal>
  )
}
