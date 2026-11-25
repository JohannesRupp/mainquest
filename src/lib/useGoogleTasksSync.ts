import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from './supabase'
import type { Task } from './types'
import {
  GoogleError,
  TOKEN_EVENT,
  cachedToken,
  createGTask,
  deleteGTask,
  googleConfigured,
  isGoogleConnected,
  updateGTask,
} from './google'
import { addDays, dayKey } from './time'

interface Snap {
  gid: string
  title: string
  day: string
  done: boolean
}

/**
 * Spiegelt alle Tasks ohne Quest nach Google Tasks („Meine Aufgaben“).
 * Funktioniert als Abgleich: Bei jeder Änderung an `tasks` wird verglichen, was zuletzt
 * an Google gesendet wurde, und nur der Unterschied übertragen. Ohne gültiges Token
 * bleibt alles liegen und wird nachgeholt, sobald ein Token da ist.
 */
export function useGoogleTasksSync({
  tasks,
  setTasks,
  loading,
  columnReady,
  fail,
}: {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  loading: boolean
  columnReady: boolean
  fail: (e: unknown) => void
}) {
  const snap = useRef(new Map<string, Snap>())
  const busy = useRef(new Set<string>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const blocked = useRef(false)
  // Nach einem vorübergehenden Fehler (z.B. offline) eine Minute Pause statt Dauerschleife
  const pauseUntil = useRef(0)
  const [tick, setTick] = useState(0)

  // Neues Token (z.B. nach Klick auf Verbinden oder beim Abhaken) -> ausstehendes nachholen
  useEffect(() => {
    const onToken = () => {
      blocked.current = false
      setTick((t) => t + 1)
    }
    window.addEventListener(TOKEN_EVENT, onToken)
    return () => window.removeEventListener(TOKEN_EVENT, onToken)
  }, [])

  useEffect(() => {
    if (loading || !columnReady || !googleConfigured || !isGoogleConnected()) return

    // Beim ersten Sehen gilt der gespeicherte Stand als bereits synchron
    for (const t of tasks) {
      if (t.google_task_id && !snap.current.has(t.id)) snap.current.set(t.id, snapOf(t, t.google_task_id))
    }

    const token = cachedToken()
    if (!token || blocked.current || Date.now() < pauseUntil.current) return

    const today = dayKey()
    const tomorrow = dayKey(addDays(new Date(), 1))
    const jobs: { id: string; run: () => Promise<void> }[] = []

    for (const t of tasks) {
      if (busy.current.has(t.id)) continue
      const wanted = !t.quest_id
      const gid = t.google_task_id
      const s = snap.current.get(t.id)

      if (wanted && !gid) {
        // Neu anlegen: offene Tasks ab heute; Wiederholungen nur heute/morgen, sonst flutet es die Liste
        const inRange = t.scheduled_on >= today && (!t.recurring_id || t.scheduled_on <= tomorrow)
        if (t.done || !inRange) continue
        jobs.push({
          id: t.id,
          run: async () => {
            const newId = await createGTask(token, gtaskOf(t))
            const { error } = await supabase.from('tasks').update({ google_task_id: newId }).eq('id', t.id)
            if (error) {
              await deleteGTask(token, newId).catch(() => {})
              blocked.current = true
              throw new Error(
                /google_task_id/.test(error.message)
                  ? 'Google Tasks: Bitte supabase/migrations/004_google_tasks.sql im Supabase SQL Editor ausführen.'
                  : error.message,
              )
            }
            snap.current.set(t.id, snapOf(t, newId))
            setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, google_task_id: newId } : x)))
          },
        })
      } else if (wanted && gid && (!s || changed(s, t))) {
        jobs.push({
          id: t.id,
          run: async () => {
            await ignore404(updateGTask(token, gid, gtaskOf(t)))
            snap.current.set(t.id, snapOf(t, gid))
          },
        })
      } else if (!wanted && gid) {
        // Task hat jetzt eine Quest -> aus Google Tasks entfernen
        jobs.push({
          id: t.id,
          run: async () => {
            await ignore404(deleteGTask(token, gid))
            snap.current.delete(t.id)
            await supabase.from('tasks').update({ google_task_id: null }).eq('id', t.id)
            setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, google_task_id: null } : x)))
          },
        })
      }
    }

    // In MainQuest gelöscht -> auch in Google löschen
    const ids = new Set(tasks.map((t) => t.id))
    for (const [id, s] of snap.current) {
      if (ids.has(id) || busy.current.has(id)) continue
      jobs.push({
        id,
        run: async () => {
          await ignore404(deleteGTask(token, s.gid))
          snap.current.delete(id)
        },
      })
    }

    for (const job of jobs) {
      busy.current.add(job.id)
      queue.current = queue.current
        .then(async () => {
          if (blocked.current) return
          try {
            await job.run()
          } catch (e) {
            if (e instanceof GoogleError && (e.status === 401 || e.status === 403)) blocked.current = true
            else pauseUntil.current = Date.now() + 60_000
            fail(e)
          }
        })
        .finally(() => {
          busy.current.delete(job.id)
        })
    }
    // Nach Abschluss erneut prüfen, falls sich in der Zwischenzeit etwas geändert hat
    if (jobs.length)
      void queue.current.then(() => {
        if (!blocked.current && Date.now() >= pauseUntil.current) setTick((x) => x + 1)
      })
  }, [tasks, loading, columnReady, tick, setTasks, fail])
}

const gtaskOf = (t: Task) => ({ title: t.title, day: t.scheduled_on, done: t.done })
const snapOf = (t: Task, gid: string): Snap => ({ gid, title: t.title, day: t.scheduled_on, done: t.done })
const changed = (s: Snap, t: Task) => s.title !== t.title || s.day !== t.scheduled_on || s.done !== t.done

/** Wurde der Task in Google schon gelöscht, ist das kein Fehler */
async function ignore404(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) return
    throw e
  }
}
