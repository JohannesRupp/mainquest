import { createContext, useContext } from 'react'
import type { InsertAt, Quest, RecurringInput, RecurringTask, Settings, Task, TimeEntry } from './types'

export interface Store {
  loading: boolean
  error: string | null
  notice: string | null
  quests: Quest[]
  tasks: Task[]
  entries: TimeEntry[]
  recurring: RecurringTask[]
  settings: Settings
  running: TimeEntry | null
  clearMessages: () => void
  addQuest: (q: Pick<Quest, 'title' | 'description' | 'color'> & { weekly_goal_minutes?: number | null }) => Promise<void>
  updateQuest: (id: string, patch: Partial<Quest>) => Promise<void>
  deleteQuest: (id: string) => Promise<void>
  /** Tasks eines Tages in Reihenfolge */
  tasksOn: (day: string) => Task[]
  addTask: (title: string, questId: string | null, day: string, at: InsertAt) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  /** Task auf einen Tag verschieben, vor beforeId (null = ans Ende) */
  moveTask: (id: string, day: string, beforeId: string | null) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<void>
  reopenTask: (id: string) => Promise<void>
  startTimer: (taskId: string) => Promise<void>
  stopTimer: () => Promise<void>
  addManualEntry: (taskId: string, startedAt: Date, minutes: number) => Promise<void>
  updateEntry: (id: string, patch: { started_at: string; ended_at: string }) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  /** Neue Wiederholung; linkTaskId macht einen bestehenden Task zur ersten Instanz */
  addRecurring: (r: RecurringInput, linkTaskId?: string) => Promise<void>
  updateRecurring: (id: string, patch: RecurringInput, keepTaskId?: string) => Promise<void>
  deleteRecurring: (id: string, keepTaskId?: string) => Promise<void>
  saveSettings: (s: Partial<Settings>) => Promise<void>
  syncPending: () => Promise<number>
  pendingSyncCount: number
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreProvider fehlt')
  return s
}
