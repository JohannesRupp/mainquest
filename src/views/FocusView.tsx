import { useEffect } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { dayKey, entryMs, formatDuration } from '../lib/time'
import type { Task } from '../lib/types'
import { Icon } from '../components/ui'

/** Vollbild-Fokusmodus: laufender Task, sonst der oberste offene Task von heute */
export function FocusView({ onBack, onPlan }: { onBack: () => void; onPlan: () => void }) {
  const { tasks, tasksOn, running } = useStore()
  const runningTask = tasks.find((t) => t.id === running?.task_id && !t.done)
  const open = tasksOn(dayKey()).filter((t) => !t.done)
  const task = runningTask ?? open.find((t) => t.quest_id) ?? open[0] ?? null

  // Esc führt zurück
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {task ? <FocusSession key={task.id} task={task} onBack={onBack} /> : <AllDone onBack={onBack} onPlan={onPlan} />}
    </div>
  )
}

function FocusHeader({ onBack, label, color }: { onBack: () => void; label: string; color?: string }) {
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-6">
      <button onClick={onBack} title="Zurück (Esc)" className="rounded-lg p-2 text-muted transition hover:bg-panel-2 hover:text-white">
        <Icon.back className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted md:text-xs">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color ?? 'var(--color-muted)' }} />
        <span className="truncate">{label}</span>
      </div>
    </header>
  )
}

function FocusSession({ task, onBack }: { task: Task; onBack: () => void }) {
  const { quests, entries, running, startTimer, stopTimer, completeTask, error, notice } = useStore()
  const quest = quests.find((q) => q.id === task.quest_id)
  const isRunning = running?.task_id === task.id
  const now = useNow(isRunning)
  const total = entries.filter((e) => e.task_id === task.id).reduce((s, e) => s + entryMs(e, now), 0)
  const time = formatDuration(total, true)
  const color = quest?.color ?? '#8a8a93'

  const toggle = () => (isRunning ? stopTimer() : startTimer(task.id))

  // Leertaste startet/pausiert
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, textarea, button')) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Laufende Zeit im Browser-Tab anzeigen
  useEffect(() => {
    const prev = document.title
    document.title = isRunning ? `${time} · ${task.title}` : `Pausiert · ${task.title}`
    return () => {
      document.title = prev
    }
  }, [time, isRunning, task.title])

  return (
    <>
      <FocusHeader onBack={onBack} color={color} label={`Fokus · ${quest?.title ?? task.title}`} />

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        {quest && (
          <span
            className="mb-6 inline-flex max-w-full items-center gap-2.5 rounded-full border px-4 py-1.5 text-sm"
            style={{ borderColor: `${color}55`, color, background: `${color}0d` }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate">{quest.title}</span>
          </span>
        )}

        <h1 className="max-w-2xl text-2xl font-medium md:text-3xl">{task.title}</h1>

        <div
          className={`tabular mt-6 font-semibold leading-none tracking-tight transition-colors ${isRunning ? 'text-white' : 'text-white/85'}`}
          style={{ fontSize: 'clamp(4.5rem, 19vw, 11rem)' }}
        >
          {time}
        </div>

        <div className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-muted">
          {isRunning ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Läuft
            </span>
          ) : total > 0 ? (
            'Pausiert'
          ) : (
            'Bereit'
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-2.5 rounded-lg bg-accent px-7 py-3.5 text-lg font-semibold text-accent-ink transition hover:brightness-110"
          >
            {isRunning ? <Icon.pause className="h-5 w-5" /> : <Icon.playFill className="h-5 w-5" />}
            {isRunning ? 'Pause' : total > 0 ? 'Fortsetzen' : 'Starten'}
          </button>
          <button
            onClick={() => completeTask(task.id)}
            className="inline-flex items-center gap-2.5 rounded-lg px-5 py-3.5 text-lg text-muted transition hover:bg-panel-2 hover:text-white"
          >
            <Icon.check className="h-5 w-5" /> Abschließen
          </button>
        </div>

        {(error || notice) && <p className={`mt-6 text-sm ${error ? 'text-bad' : 'text-good'}`}>{error ?? notice}</p>}
      </main>
    </>
  )
}

function AllDone({ onBack, onPlan }: { onBack: () => void; onPlan: () => void }) {
  return (
    <>
      <FocusHeader onBack={onBack} label="Fokus" />
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-good/40 text-good">
          <Icon.check className="h-6 w-6" />
        </div>
        <h1 className="mt-6 text-2xl font-medium md:text-3xl">Für heute ist alles erledigt</h1>
        <p className="mt-2 text-sm text-muted">Plane neue Tasks für heute, dann geht es hier weiter.</p>
        <button
          onClick={onPlan}
          className="mt-8 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110"
        >
          Zur Planung
        </button>
      </main>
    </>
  )
}
