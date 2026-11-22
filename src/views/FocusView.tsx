import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { entryMs, formatDuration } from '../lib/time'
import type { Task } from '../lib/types'
import { Icon } from '../components/ui'

const STORAGE_KEY = 'mainquest.focusTask'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Vollbild-Fokusmodus: ein Task, großer Timer, Pause/Fortsetzen und Abschließen */
export function FocusView({ onBack }: { onBack: () => void }) {
  const { tasks, running } = useStore()
  const [chosen, setChosen] = useState<string | null>(readStored)

  const focusId = running?.task_id ?? chosen
  const task = tasks.find((t) => t.id === focusId && !t.done) ?? null

  function choose(id: string | null) {
    setChosen(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* egal */
    }
  }

  // Esc führt zurück
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {task ? <FocusSession task={task} onBack={onBack} /> : <TaskPicker onBack={onBack} onPick={choose} />}
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

function TaskPicker({ onBack, onPick }: { onBack: () => void; onPick: (id: string) => void }) {
  const { tasks, quests, entries } = useStore()
  const open = tasks.filter((t) => !t.done)
  const totalOf = (id: string) => entries.filter((e) => e.task_id === id).reduce((s, e) => s + entryMs(e), 0)

  return (
    <>
      <FocusHeader onBack={onBack} label="Fokus" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-5 pb-10 pt-4 md:pt-12">
        <h1 className="text-center text-2xl font-medium md:text-3xl">Woran arbeitest du?</h1>
        <p className="mt-2 text-center text-sm text-muted">Wähl einen Task für deine Fokus-Session.</p>

        {open.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">Keine offenen Tasks. Leg zuerst einen unter „Tasks“ an.</p>
        ) : (
          <div className="mt-8 flex flex-col gap-1.5">
            {open.map((t) => {
              const q = quests.find((x) => x.id === t.quest_id)
              const total = totalOf(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-left transition hover:border-accent/50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: q?.color ?? 'var(--color-muted)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t.title}</span>
                    {q && <span className="block truncate text-xs text-muted">{q.title}</span>}
                  </span>
                  {total > 0 && <span className="tabular text-xs text-muted">{formatDuration(total)}</span>}
                  <Icon.chevron className="h-4 w-4 text-muted transition group-hover:text-accent" />
                </button>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
