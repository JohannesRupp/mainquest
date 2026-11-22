import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { entryMs, formatDuration } from '../lib/time'
import { Icon } from './ui'

export function TimerBar() {
  const { running, tasks, quests, stopTimer, completeTask } = useStore()
  const now = useNow(Boolean(running))
  if (!running) return null
  const task = tasks.find((t) => t.id === running.task_id)
  const quest = quests.find((q) => q.id === task?.quest_id)

  return (
    <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 mb-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-panel/95 p-3 shadow-lg shadow-black/30 backdrop-blur">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{task?.title ?? 'Task'}</div>
        {quest && <div className="truncate text-xs text-muted">{quest.title}</div>}
      </div>
      <div className="tabular text-lg font-semibold text-accent">{formatDuration(entryMs(running, now), true)}</div>
      <button onClick={stopTimer} title="Stoppen" className="rounded-xl bg-panel-2 p-2 hover:bg-line">
        <Icon.stop className="h-4 w-4" />
      </button>
      {task && (
        <button onClick={() => completeTask(task.id)} title="Erledigt" className="rounded-xl bg-accent p-2 text-accent-ink">
          <Icon.check className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
