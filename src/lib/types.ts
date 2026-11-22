export type QuestStatus = 'active' | 'done' | 'archived'

export interface Quest {
  id: string
  title: string
  description: string | null
  color: string
  status: QuestStatus
  weekly_goal_minutes: number | null
  created_at: string
}

export interface Task {
  id: string
  quest_id: string | null
  title: string
  notes: string | null
  done: boolean
  done_at: string | null
  /** Geplanter Tag, YYYY-MM-DD (lokal) */
  scheduled_on: string
  position: number
  recurring_id: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  google_event_id: string | null
}

export interface RecurringTask {
  id: string
  quest_id: string | null
  title: string
  /** 1 = Montag … 7 = Sonntag (nur bei unit = 'week') */
  weekdays: number[]
  /** alle N Tage/Wochen */
  interval_count: number
  unit: 'day' | 'week'
  starts_on: string
  ends_on: string | null
  generated_until: string | null
  created_at: string
}

export type RecurringInput = Pick<RecurringTask, 'title' | 'quest_id' | 'weekdays' | 'interval_count' | 'unit' | 'starts_on' | 'ends_on'>

export interface Settings {
  calendar_id: string
  auto_sync: boolean
  weekly_goal_minutes: number | null
}

export type InsertAt = 'top' | 'bottom'
