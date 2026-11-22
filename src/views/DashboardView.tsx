import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/useNow'
import { addDays, formatDuration, overlapMs, startOfDay, startOfWeek, weekdayShort } from '../lib/time'
import { Card, SectionTitle } from '../components/ui'

type Range = 7 | 30

export function DashboardView() {
  const { entries, tasks, quests, running, settings } = useStore()
  const now = useNow(Boolean(running), 30_000)
  const [range, setRange] = useState<Range>(7)

  const stats = useMemo(() => {
    const today = startOfDay()
    const tomorrow = addDays(today, 1)
    const weekStart = addDays(today, -((today.getDay() + 6) % 7)) // Montag
    const from = addDays(today, -(range - 1))
    const sum = (a: Date, b: Date) => entries.reduce((s, e) => s + overlapMs(e, a, b, now), 0)

    const days = Array.from({ length: range }, (_, i) => {
      const d = addDays(from, i)
      const next = addDays(d, 1)
      const byQuest = new Map<string, number>()
      for (const e of entries) {
        const ms = overlapMs(e, d, next, now)
        if (!ms) continue
        const qid = tasks.find((t) => t.id === e.task_id)?.quest_id ?? 'none'
        byQuest.set(qid, (byQuest.get(qid) ?? 0) + ms)
      }
      return { date: d, total: [...byQuest.values()].reduce((a, b) => a + b, 0), byQuest }
    })

    const questTotals = new Map<string, number>()
    for (const d of days) for (const [k, v] of d.byQuest) questTotals.set(k, (questTotals.get(k) ?? 0) + v)

    // Streak: aufeinanderfolgende Tage mit getrackter Zeit oder erledigtem Task
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, -i)
      const n = addDays(d, 1)
      const active =
        sum(d, n) > 0 ||
        tasks.some((t) => t.done_at && new Date(t.done_at) >= d && new Date(t.done_at) < n)
      if (active) streak++
      else if (i > 0) break
    }

    const doneInRange = tasks.filter((t) => t.done_at && new Date(t.done_at) >= from).length

    return {
      todayMs: sum(today, tomorrow),
      weekMs: sum(weekStart, tomorrow),
      rangeMs: sum(from, tomorrow),
      days,
      questTotals: [...questTotals.entries()].sort((a, b) => b[1] - a[1]),
      streak,
      doneInRange,
    }
  }, [entries, tasks, range, now])

  const max = Math.max(...stats.days.map((d) => d.total), 1)
  const questColor = (id: string) => quests.find((q) => q.id === id)?.color ?? '#5b6170'
  const questName = (id: string) => quests.find((q) => q.id === id)?.title ?? 'Ohne Quest'

  const recentDone = tasks
    .filter((t) => t.done && t.done_at)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!))
    .slice(0, 8)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tight">Review</h1>
        <div className="flex rounded-xl bg-panel-2 p-1 text-sm">
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 ${range === r ? 'bg-line text-white' : 'text-muted'}`}
            >
              {r} Tage
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Heute" value={formatDuration(stats.todayMs)} />
        <Stat label="Diese Woche" value={formatDuration(stats.weekMs)} />
        <Stat label={`Erledigt (${range} T.)`} value={String(stats.doneInRange)} />
        <Stat label="Streak" value={`${stats.streak} ${stats.streak === 1 ? 'Tag' : 'Tage'}`} accent />
      </div>

      <WeeklyGoals
        weekMs={stats.weekMs}
        goalMs={(settings.weekly_goal_minutes ?? 0) * 60_000}
        perQuest={quests
          .filter((q) => q.status === 'active' && q.weekly_goal_minutes)
          .map((q) => {
            const ids = new Set(tasks.filter((t) => t.quest_id === q.id).map((t) => t.id))
            const ws = startOfWeek()
            const ms = entries.filter((e) => ids.has(e.task_id)).reduce((s, e) => s + overlapMs(e, ws, addDays(ws, 7), now), 0)
            return { id: q.id, title: q.title, color: q.color, ms, goalMs: q.weekly_goal_minutes! * 60_000 }
          })}
      />

      <SectionTitle right={<span className="tabular text-xs text-muted">Σ {formatDuration(stats.rangeMs)}</span>}>
        Fokuszeit pro Tag
      </SectionTitle>
      <Card>
        <div className="flex h-44 items-end gap-1">
          {stats.days.map((d) => (
            <div key={d.date.toISOString()} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="flex flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(d.total / max) * 100}%` }}>
                {[...d.byQuest.entries()].map(([qid, ms]) => (
                  <div key={qid} style={{ height: `${(ms / d.total) * 100}%`, background: questColor(qid) }} />
                ))}
              </div>
              <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-line px-2 py-0.5 text-xs group-hover:block">
                {formatDuration(d.total)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-center text-[10px] text-muted">
          {stats.days.map((d, i) => (
            <div key={i} className="flex-1">
              {range === 7 ? weekdayShort(d.date) : i % 5 === 0 ? d.date.getDate() + '.' : ''}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-x-6 md:grid-cols-2">
        <div>
          <SectionTitle>Zeit nach Quest</SectionTitle>
          <Card className="flex flex-col gap-3">
            {stats.questTotals.length === 0 && <p className="text-sm text-muted">Noch keine Zeit getrackt.</p>}
            {stats.questTotals.map(([qid, ms]) => (
              <div key={qid}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate">{questName(qid)}</span>
                  <span className="tabular text-muted">{formatDuration(ms)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full" style={{ width: `${(ms / stats.rangeMs) * 100}%`, background: questColor(qid) }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>Zuletzt erledigt</SectionTitle>
          <Card className="flex flex-col gap-2">
            {recentDone.length === 0 && <p className="text-sm text-muted">Noch nichts erledigt.</p>}
            {recentDone.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: questColor(t.quest_id ?? '') }} />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-xs text-muted">
                  {new Date(t.done_at!).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular mt-1 text-xl font-bold ${accent ? 'text-accent' : ''}`}>{value}</div>
    </Card>
  )
}

function WeeklyGoals({
  weekMs,
  goalMs,
  perQuest,
}: {
  weekMs: number
  goalMs: number
  perQuest: { id: string; title: string; color: string; ms: number; goalMs: number }[]
}) {
  if (!goalMs && perQuest.length === 0) return null
  const rows = [...(goalMs ? [{ id: 'all', title: 'Gesamt', color: '#f5b942', ms: weekMs, goalMs }] : []), ...perQuest]
  return (
    <>
      <SectionTitle>Wochenziele</SectionTitle>
      <Card className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.id}>
            <div className="mb-1.5 flex justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className={`truncate ${r.id === 'all' ? 'font-semibold' : ''}`}>{r.title}</span>
              </span>
              <span className="tabular shrink-0 text-muted">
                {formatDuration(r.ms)} / {formatDuration(r.goalMs)}
                {r.ms >= r.goalMs && <span className="ml-1.5 text-good">✓</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.ms / r.goalMs) * 100)}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}
