export type QuestStatus = 'active' | 'done' | 'archived'

export interface Quest {
  id: string
  title: string
  description: string | null
  color: string
  status: QuestStatus
  created_at: string
}

export interface Task {
  id: string
  quest_id: string | null
  title: string
  notes: string | null
  done: boolean
  done_at: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  google_event_id: string | null
}

export interface Settings {
  calendar_id: string
  auto_sync: boolean
}
