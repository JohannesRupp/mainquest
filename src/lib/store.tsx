import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { InsertAt, Quest, RecurringTask, Settings, Task, TimeEntry } from './types'
import { StoreContext, type Store } from './useStore'
import { createEvent, deleteEvent, getToken, googleConfigured, isGoogleConnected, loadGis } from './google'
import { addDays, dayKey, isoWeekday, parseDay, startOfWeek } from './time'

const MIN_SYNC_MS = 60_000 // Einträge unter 1 Minute werden nicht in den Kalender geschrieben
const RECURRING_HORIZON_DAYS = 13 // so weit im Voraus werden wiederkehrende Tasks angelegt

const byPos = (a: Task, b: Task) => a.position - b.position || a.created_at.localeCompare(b.created_at)

/** Position für Einfügen oben/unten in einer sortierten Liste */
function edgePosition(list: Task[], at: InsertAt): number {
  if (!list.length) return 0
  return at === 'top' ? list[0].position - 1 : list[list.length - 1].position + 1
}

/** Tage von from (exklusiv) bis to (inklusiv), die auf die Wochentage passen */
function occurrences(r: RecurringTask, from: Date, to: Date): string[] {
  const n = Math.max(1, r.interval_count ?? 1)
  const unit = r.unit ?? 'week'
  const start = r.starts_on ? parseDay(r.starts_on) : parseDay('2000-01-03')
  const end = r.ends_on ? parseDay(r.ends_on) : null
  const diff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400_000)
  const out: string[] = []
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    if (d < start || (end && d > end)) continue
    const hit =
      unit === 'day'
        ? diff(start, d) % n === 0
        : r.weekdays.includes(isoWeekday(d)) && Math.floor(diff(startOfWeek(start), d) / 7) % n === 0
    if (hit) out.push(dayKey(d))
  }
  return out
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [recurring, setRecurring] = useState<RecurringTask[]>([])
  const [settings, setSettings] = useState<Settings>({ calendar_id: 'primary', auto_sync: true, weekly_goal_minutes: null })
  const loadInFlight = useRef<Promise<void> | null>(null)

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

  /** Wiederkehrende Tasks bis zum Horizont anlegen */
  const materialize = async (rules: RecurringTask[], current: Task[]): Promise<Task[]> => {
    const today = parseDay(dayKey())
    const horizon = addDays(today, RECURRING_HORIZON_DAYS)
    const created: Task[] = []
    for (const r of rules) {
      const from = r.generated_until ? parseDay(r.generated_until) : addDays(today, -1)
      const start = from < addDays(today, -1) ? addDays(today, -1) : from
      const days = occurrences(r, start, horizon)
      if (days.length) {
        const rows = days.map((day) => {
          const list = [...current, ...created].filter((t) => t.scheduled_on === day).sort(byPos)
          return { title: r.title, quest_id: r.quest_id, recurring_id: r.id, scheduled_on: day, position: edgePosition(list, 'bottom') }
        })
        const { data, error } = await supabase
          .from('tasks')
          .upsert(rows, { onConflict: 'recurring_id,scheduled_on', ignoreDuplicates: true })
          .select()
        if (error) throw error
        created.push(...((data ?? []) as Task[]))
      }
      if (r.generated_until !== dayKey(horizon)) {
        await supabase.from('recurring_tasks').update({ generated_until: dayKey(horizon) }).eq('id', r.id)
        r.generated_until = dayKey(horizon)
      }
    }
    return created
  }

  /** Unerledigte Tasks aus der Vergangenheit ans Ende von heute schieben */
  const rollover = async (current: Task[]): Promise<Task[]> => {
    const today = dayKey()
    const late = current.filter((t) => !t.done && !t.recurring_id && t.scheduled_on < today)
    if (!late.length) return current
    late.sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || byPos(a, b))
    let pos = edgePosition(current.filter((t) => t.scheduled_on === today).sort(byPos), 'bottom')
    const moved = new Map<string, number>()
    for (const t of late) moved.set(t.id, pos++)
    await Promise.all(
      late.map((t) => supabase.from('tasks').update({ scheduled_on: today, position: moved.get(t.id) }).eq('id', t.id)),
    )
    return current.map((t) => (moved.has(t.id) ? { ...t, scheduled_on: today, position: moved.get(t.id)! } : t))
  }

  const loadOnce = async () => {
    const since = new Date(Date.now() - 400 * 86400_000).toISOString()
    const [q, t, e, s, r] = await Promise.all([
      supabase.from('quests').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('position'),
      supabase.from('time_entries').select('*').gte('started_at', since).order('started_at'),
      supabase.from('user_settings').select('*').maybeSingle(),
      supabase.from('recurring_tasks').select('*').order('created_at'),
    ])
    const err = q.error ?? t.error ?? e.error ?? s.error ?? r.error
    if (err) {
      setLoading(false)
      return fail(
        /column|relation|schema cache/i.test(err.message)
          ? `Datenbank nicht aktuell: Bitte alle Dateien aus supabase/migrations/ der Reihe nach im SQL Editor ausführen. (${err.message})`
          : err,
      )
    }
    let taskList = t.data as Task[]
    const rules = r.data as RecurringTask[]
    setQuests(q.data as Quest[])
    setEntries(e.data as TimeEntry[])
    if (s.data)
      setSettings({
        calendar_id: s.data.calendar_id,
        auto_sync: s.data.auto_sync,
        weekly_goal_minutes: s.data.weekly_goal_minutes ?? null,
      })

    try {
      taskList = await rollover(taskList)
      taskList = [...taskList, ...(await materialize(rules, taskList))]
    } catch (x) {
      fail(x)
    }
    setTasks(taskList)
    setRecurring(rules)
    setLoading(false)
  }

  const load = useCallback(() => {
    // Läuft schon ein Load (z.B. Start + Tab wieder sichtbar), keinen zweiten parallel starten
    if (!loadInFlight.current) {
      loadInFlight.current = loadOnce().finally(() => {
        loadInFlight.current = null
      })
    }
    return loadInFlight.current
  }, []) // eslint-disable-line

  useEffect(() => {
    void load() // eslint-disable-line react/set-state-in-effect -- Daten von Supabase laden ist Sync mit externem System
    if (googleConfigured) loadGis().catch(() => {})
    const reload = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', reload)
    // Um Mitternacht neu laden: offene Tasks rollen auf den neuen Tag, Wiederholungen werden nachgelegt
    let midnight: ReturnType<typeof setTimeout>
    const scheduleMidnight = () => {
      const next = addDays(parseDay(dayKey()), 1).getTime() + 5_000
      midnight = setTimeout(() => {
        void load()
        scheduleMidnight()
      }, next - Date.now())
    }
    scheduleMidnight()
    return () => {
      document.removeEventListener('visibilitychange', reload)
      clearTimeout(midnight)
    }
  }, [load])

  const running = useMemo(() => entries.find((e) => !e.ended_at) ?? null, [entries])

  const tasksOn = useCallback((day: string) => tasks.filter((t) => t.scheduled_on === day).sort(byPos), [tasks])

  /** Token nur holen, wenn Google verbunden ist (muss im Klick passieren) */
  const tokenIfConnected = () => {
    if (!googleConfigured || !isGoogleConnected()) return null
    const p = getToken()
    p.catch(() => {})
    return p
  }

  const removeGoogleEvent = async (tokenP: Promise<string> | null, eventId: string | null) => {
    if (!eventId || !tokenP) return
    try {
      await deleteEvent(await tokenP, settings.calendar_id, eventId)
    } catch {
      /* Termin evtl. schon gelöscht */
    }
  }

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
  const addTask: Store['addTask'] = async (title, questId, day, at) => {
    const group = tasksOn(day).filter((t) => Boolean(t.quest_id) === Boolean(questId))
    const position = edgePosition(group, at)
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, quest_id: questId, scheduled_on: day, position })
      .select()
      .single()
    if (error) return fail(error)
    setTasks((xs) => [...xs, data as Task])
  }
  const updateTask: Store['updateTask'] = async (id, patch) => {
    setTasks((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) fail(error)
  }
  const moveTask: Store['moveTask'] = async (id, day, beforeId) => {
    if (id === beforeId) return
    const list = tasksOn(day).filter((t) => t.id !== id)
    const idx = beforeId ? list.findIndex((t) => t.id === beforeId) : -1
    let position: number
    if (idx === -1) position = edgePosition(list, 'bottom')
    else if (idx === 0) position = list[0].position - 1
    else position = (list[idx - 1].position + list[idx].position) / 2
    const prev = tasks.find((t) => t.id === id)
    setTasks((xs) => xs.map((x) => (x.id === id ? { ...x, scheduled_on: day, position } : x)))
    const { error } = await supabase.from('tasks').update({ scheduled_on: day, position }).eq('id', id)
    if (error) {
      if (prev) setTasks((xs) => xs.map((x) => (x.id === id ? prev : x)))
      fail(error.code === '23505' ? 'Diesen wiederkehrenden Task gibt es an dem Tag schon.' : error)
    }
  }
  const deleteTask: Store['deleteTask'] = async (id) => {
    const eventIds = entries.filter((e) => e.task_id === id && e.google_event_id).map((e) => e.google_event_id!)
    const tokenP = eventIds.length ? tokenIfConnected() : null
    setTasks((xs) => xs.filter((x) => x.id !== id))
    setEntries((xs) => xs.filter((e) => e.task_id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return fail(error)
    for (const eventId of eventIds) await removeGoogleEvent(tokenP, eventId)
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
    if (error) {
      if (error.code !== '23505') return fail(error)
      await load()
      return fail('Auf einem anderen Gerät läuft schon ein Timer. Stoppe ihn und starte dann neu.')
    }
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

  const updateEntry: Store['updateEntry'] = async (id, patch) => {
    const old = entries.find((e) => e.id === id)
    if (!old) return
    if (new Date(patch.ended_at) <= new Date(patch.started_at)) return fail('Das Ende muss nach dem Start liegen.')
    const tokenP = old.google_event_id ? tokenIfConnected() : null
    const next = { ...old, ...patch, google_event_id: null }
    setEntries((xs) => xs.map((e) => (e.id === id ? next : e)).sort((a, b) => a.started_at.localeCompare(b.started_at)))
    const { error } = await supabase.from('time_entries').update({ ...patch, google_event_id: null }).eq('id', id)
    if (error) return fail(error)
    if (old.google_event_id && tokenP) {
      await removeGoogleEvent(tokenP, old.google_event_id)
      const task = tasks.find((t) => t.id === old.task_id)
      if (task?.done) {
        try {
          await syncEntries(await tokenP, pendingFor(new Set([task.id]), [next]), tasks)
          setNotice('Zeiteintrag und Kalendertermin aktualisiert')
        } catch (e) {
          fail(e)
        }
      }
    }
  }
  const deleteEntry: Store['deleteEntry'] = async (id) => {
    const old = entries.find((e) => e.id === id)
    const tokenP = old?.google_event_id ? tokenIfConnected() : null
    setEntries((xs) => xs.filter((e) => e.id !== id))
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (error) return fail(error)
    await removeGoogleEvent(tokenP, old?.google_event_id ?? null)
  }

  // ---------- Wiederkehrende Tasks ----------
  const regenerate = async (rule: RecurringTask, keepTaskId?: string, base: Task[] = tasks) => {
    // Künftige, offene Instanzen ab heute neu aufbauen
    const today = dayKey()
    // Instanzen mit getrackter Zeit bleiben erhalten, sonst gingen die Zeiteinträge verloren
    const stale = base.filter(
      (t) =>
        t.recurring_id === rule.id &&
        t.id !== keepTaskId &&
        !t.done &&
        t.scheduled_on >= today &&
        !entries.some((e) => e.task_id === t.id),
    )
    if (stale.length) {
      const ids = stale.map((t) => t.id)
      const { error } = await supabase.from('tasks').delete().in('id', ids)
      if (error) throw error
    }
    const remaining = base.filter((t) => !stale.includes(t))
    const fresh = { ...rule, generated_until: dayKey(addDays(parseDay(today), -1)) }
    const created = await materialize([fresh], remaining)
    setTasks([...remaining, ...created])
    return fresh
  }

  const addRecurring: Store['addRecurring'] = async (r, linkTaskId) => {
    const { data, error } = await supabase.from('recurring_tasks').insert(r).select().single()
    if (error) return fail(error)
    try {
      let base = tasks
      if (linkTaskId) {
        const { error: e2 } = await supabase.from('tasks').update({ recurring_id: data.id }).eq('id', linkTaskId)
        if (e2) throw e2
        base = tasks.map((t) => (t.id === linkTaskId ? { ...t, recurring_id: data.id as string } : t))
      }
      const rule = await regenerate(data as RecurringTask, linkTaskId, base)
      setRecurring((xs) => [...xs, rule])
    } catch (e) {
      fail(e)
    }
  }
  const updateRecurring: Store['updateRecurring'] = async (id, patch, keepTaskId) => {
    const old = recurring.find((r) => r.id === id)
    if (!old) return
    const { error } = await supabase.from('recurring_tasks').update(patch).eq('id', id)
    if (error) return fail(error)
    try {
      const rule = await regenerate({ ...old, ...patch }, keepTaskId)
      setRecurring((xs) => xs.map((x) => (x.id === id ? rule : x)))
    } catch (e) {
      fail(e)
    }
  }
  const deleteRecurring: Store['deleteRecurring'] = async (id, keepTaskId) => {
    const today = dayKey()
    const future = tasks
      .filter(
        (t) =>
          t.recurring_id === id &&
          t.id !== keepTaskId &&
          !t.done &&
          t.scheduled_on >= today &&
          !entries.some((e) => e.task_id === t.id),
      )
      .map((t) => t.id)
    setRecurring((xs) => xs.filter((x) => x.id !== id))
    // verbleibende Instanzen verlieren die Verknüpfung (on delete set null)
    setTasks((xs) => xs.filter((t) => !future.includes(t.id)).map((t) => (t.recurring_id === id ? { ...t, recurring_id: null } : t)))
    if (future.length) {
      const { error: e1 } = await supabase.from('tasks').delete().in('id', future)
      if (e1) return fail(e1)
    }
    const { error } = await supabase.from('recurring_tasks').delete().eq('id', id)
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
      const { error } = await supabase.from('time_entries').update({ google_event_id: eventId }).eq('id', e.id)
      if (error) {
        await deleteEvent(token, settings.calendar_id, eventId).catch(() => {})
        throw error
      }
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
      const { error: stopErr } = await supabase.from('time_entries').update({ ended_at }).eq('id', running.id)
      if (stopErr) return fail(stopErr)
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
    recurring,
    settings,
    running,
    clearMessages,
    addQuest,
    updateQuest,
    deleteQuest,
    tasksOn,
    addTask,
    updateTask,
    moveTask,
    deleteTask,
    completeTask,
    reopenTask,
    startTimer,
    stopTimer,
    addManualEntry,
    updateEntry,
    deleteEntry,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    saveSettings,
    syncPending,
    pendingSyncCount,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
