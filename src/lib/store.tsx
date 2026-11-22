import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Quest, Settings, Task, TimeEntry } from './types'
import { createEvent, getToken, googleConfigured, isGoogleConnected, loadGis } from './google'

const MIN_SYNC_MS = 60_000 // Einträge unter 1 Minute werden nicht in den Kalender geschrieben

interface Store {
  loading: boolean
  error: string | null
  notice: string | null
  quests: Quest[]
  tasks: Task[]
  entries: TimeEntry[]
  settings: Settings
  running: TimeEntry | null
  clearMessages: () => void
  addQuest: (q: Pick<Quest, 'title' | 'description' | 'color'>) => Promise<void>
  updateQuest: (id: string, patch: Partial<Quest>) => Promise<void>
  deleteQuest: (id: string) => Promise<void>
  addTask: (title: string, questId: string | null) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<void>
  reopenTask: (id: string) => Promise<void>
  startTimer: (taskId: string) => Promise<void>
  stopTimer: () => Promise<void>
  addManualEntry: (taskId: string, startedAt: Date, minutes: number) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  saveSettings: (s: Partial<Settings>) => Promise<void>
  syncPending: () => Promise<number>
  pendingSyncCount: number
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider fehlt')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [settings, setSettings] = useState<Settings>({ calendar_id: 'primary', auto_sync: true })

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 400 * 86400_000).toISOString()
    const [q, t, e, s] = await Promise.all([
      supabase.from('quests').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('time_entries').select('*').gte('started_at', since).order('started_at'),
      supabase.from('user_settings').select('*').maybeSingle(),
    ])
    const err = q.error ?? t.error ?? e.error ?? s.error
    if (err) return fail(err)
    setQuests(q.data as Quest[])
    setTasks(t.data as Task[])
    setEntries(e.data as TimeEntry[])
    if (s.data) setSettings({ calendar_id: s.data.calendar_id, auto_sync: s.data.auto_sync })
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (googleConfigured) loadGis().catch(() => {})
    const reload = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', reload)
    return () => document.removeEventListener('visibilitychange', reload)
  }, [load])

  const running = useMemo(() => entries.find((e) => !e.ended_at) ?? null, [entries])

  // ---------- Quests ----------
  const addQuest: Store['addQuest'] = async (q) => {
    const { data, error } = await supabase.from('quests').insert(q).select().single()
    if (error) return fail(error)
    setQuests((xs) => [...xs, data as Quest])
  }
  const updateQuest: Store['updateQuest'] = async (id, patch) => {
    setQuests((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('quests').update(patch).eq('id', id)
    if (error) fail(error)
  }
  const deleteQuest: Store['deleteQuest'] = async (id) => {
    setQuests((xs) => xs.filter((x) => x.id !== id))
    setTasks((xs) => xs.map((t) => (t.quest_id === id ? { ...t, quest_id: null } : t)))
    const { error } = await supabase.from('quests').delete().eq('id', id)
    if (error) fail(error)
  }

  // ---------- Tasks ----------
  const addTask: Store['addTask'] = async (title, questId) => {
    const { data, error } = await supabase.from('tasks').insert({ title, quest_id: questId }).select().single()
    if (error) return fail(error)
    setTasks((xs) => [...xs, data as Task])
  }
  const updateTask: Store['updateTask'] = async (id, patch) => {
    setTasks((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) fail(error)
  }
  const deleteTask: Store['deleteTask'] = async (id) => {
    setTasks((xs) => xs.filter((x) => x.id !== id))
    setEntries((xs) => xs.filter((e) => e.task_id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) fail(error)
  }

  // ---------- Timer ----------
  const stopTimer: Store['stopTimer'] = async () => {
    if (!running) return
    const ended_at = new Date().toISOString()
    setEntries((xs) => xs.map((e) => (e.id === running.id ? { ...e, ended_at } : e)))
    const { error } = await supabase.from('time_entries').update({ ended_at }).eq('id', running.id)
    if (error) fail(error)
  }
  const startTimer: Store['startTimer'] = async (taskId) => {
    if (running) await stopTimer()
    const { data, error } = await supabase.from('time_entries').insert({ task_id: taskId }).select().single()
    if (error) return fail(error)
    setEntries((xs) => [...xs, data as TimeEntry])
  }
  const addManualEntry: Store['addManualEntry'] = async (taskId, startedAt, minutes) => {
    const ended = new Date(startedAt.getTime() + minutes * 60_000)
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ task_id: taskId, started_at: startedAt.toISOString(), ended_at: ended.toISOString() })
      .select()
      .single()
    if (error) return fail(error)
    setEntries((xs) => [...xs, data as TimeEntry].sort((a, b) => a.started_at.localeCompare(b.started_at)))
  }
  const deleteEntry: Store['deleteEntry'] = async (id) => {
    setEntries((xs) => xs.filter((e) => e.id !== id))
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (error) fail(error)
  }

  // ---------- Google Kalender ----------
  const syncEntries = async (token: string, list: TimeEntry[], taskList: Task[]): Promise<number> => {
    let n = 0
    for (const e of list) {
      const task = taskList.find((t) => t.id === e.task_id)
      if (!task || !e.ended_at) continue
      const quest = quests.find((q) => q.id === task.quest_id)
      const eventId = await createEvent(token, settings.calendar_id, {
        summary: `✓ ${task.title}`,
        description: [quest ? `Quest: ${quest.title}` : null, task.notes, 'Getrackt mit MainQuest']
          .filter(Boolean)
          .join('\n'),
        start: e.started_at,
        end: e.ended_at,
        entryId: e.id,
      })
      await supabase.from('time_entries').update({ google_event_id: eventId }).eq('id', e.id)
      setEntries((xs) => xs.map((x) => (x.id === e.id ? { ...x, google_event_id: eventId } : x)))
      n++
    }
    return n
  }

  const pendingFor = (taskIds: Set<string>, list = entries) =>
    list.filter(
      (e) =>
        taskIds.has(e.task_id) &&
        e.ended_at &&
        !e.google_event_id &&
        new Date(e.ended_at).getTime() - new Date(e.started_at).getTime() >= MIN_SYNC_MS,
    )

  const doneIds = useMemo(() => new Set(tasks.filter((t) => t.done).map((t) => t.id)), [tasks])
  const pendingSyncCount = useMemo(() => pendingFor(doneIds).length, [doneIds, entries]) // eslint-disable-line

  const syncPending: Store['syncPending'] = async () => {
    try {
      const token = await getToken()
      const n = await syncEntries(token, pendingFor(doneIds), tasks)
      setNotice(n ? `${n} Zeitblöcke in Google Kalender eingetragen` : 'Alles schon synchronisiert')
      return n
    } catch (e) {
      fail(e)
      return 0
    }
  }

  const completeTask: Store['completeTask'] = async (id) => {
    // Token direkt im Klick anfordern, damit Safari das Popup zulässt
    const wantSync = googleConfigured && settings.auto_sync && isGoogleConnected()
    const tokenPromise = wantSync ? getToken() : null
    tokenPromise?.catch(() => {})

    let list = entries
    if (running?.task_id === id) {
      const ended_at = new Date().toISOString()
      list = entries.map((e) => (e.id === running.id ? { ...e, ended_at } : e))
      setEntries(list)
      await supabase.from('time_entries').update({ ended_at }).eq('id', running.id)
    }
    const done_at = new Date().toISOString()
    const taskList = tasks.map((t) => (t.id === id ? { ...t, done: true, done_at } : t))
    setTasks(taskList)
    const { error } = await supabase.from('tasks').update({ done: true, done_at }).eq('id', id)
    if (error) return fail(error)

    if (tokenPromise) {
      try {
        const n = await syncEntries(await tokenPromise, pendingFor(new Set([id]), list), taskList)
        if (n) setNotice(`In Google Kalender eingetragen (${n} ${n === 1 ? 'Block' : 'Blöcke'})`)
      } catch (e) {
        fail(e)
      }
    }
  }

  const reopenTask: Store['reopenTask'] = (id) => updateTask(id, { done: false, done_at: null })

  const saveSettings: Store['saveSettings'] = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error } = await supabase.from('user_settings').upsert({ ...next, updated_at: new Date().toISOString() })
    if (error) fail(error)
  }

  const value: Store = {
    loading,
    error,
    notice,
    quests,
    tasks,
    entries,
    settings,
    running,
    clearMessages,
    addQuest,
    updateQuest,
    deleteQuest,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    startTimer,
    stopTimer,
    addManualEntry,
    deleteEntry,
    saveSettings,
    syncPending,
    pendingSyncCount,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
