import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../lib/useStore'
import { useNow } from '../lib/useNow'
import { addDays, dayKey, fmtHM, overlapMs, startOfDay, startOfWeek } from '../lib/time'
import { Icon } from '../components/ui'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Wochenreview: Quest-Stunden, Tagesverlauf, Verteilung nach Quest */
export function DashboardView() {
  const { entries, tasks, quests, running, settings } = useStore()
  const now = useNow(Boolean(running), 30_000)
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const isThisWeek = dayKey(weekStart) === dayKey(startOfWeek())

  const s = useMemo(() => {
    const questOf = new Map(tasks.map((t) => [t.id, t.quest_id]))
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      const n = addDays(d, 1)
      let quest = 0
      let other = 0
      for (const e of entries) {
        const ms = overlapMs(e, d, n, now)
        if (!ms) continue
        if (questOf.get(e.task_id)) quest += ms
        else other += ms
      }
      return { date: d, quest, other }
    })
    const byQuest = new Map<string, number>()
    const end = addDays(weekStart, 7)
    for (const e of entries) {
      const qid = questOf.get(e.task_id)
      if (!qid) continue
      const ms = overlapMs(e, weekStart, end, now)
      if (ms) byQuest.set(qid, (byQuest.get(qid) ?? 0) + ms)
    }
    const questMs = days.reduce((a, d) => a + d.quest, 0)
    const otherMs = days.reduce((a, d) => a + d.other, 0)
    // Bei der laufenden Woche nur die bisherigen Tage mitteln
    const elapsed = isThisWeek ? Math.min(7, Math.floor((startOfDay(new Date(now)).getTime() - weekStart.getTime()) / 86400_000) + 1) : 7
    const done = tasks.filter((t) => t.done_at && new Date(t.done_at) >= weekStart && new Date(t.done_at) < end)
    return { days, questMs, otherMs, avg: (questMs + otherMs) / Math.max(1, elapsed), byQuest: [...byQuest.entries()].sort((a, b) => b[1] - a[1]), done }
  }, [entries, tasks, weekStart, now, isThisWeek])

  const goalMs = (settings.weekly_goal_minutes ?? 0) * 60_000
  const total = s.questMs + s.otherMs
  const questPct = total ? Math.round((s.questMs / total) * 100) : 0
  const maxDay = Math.max(...s.days.map((d) => d.quest), 1)
  const maxQuest = Math.max(...s.byQuest.map(([, ms]) => ms), 1)
  const todayKey = dayKey()
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('de-DE', o)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight md:text-4xl">Wochenreview</h1>
          <p className="mt-2 text-white/50">Wie sehr hat die Woche deine Quests vorangebracht?</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg p-2 text-white/50 hover:bg-panel-2 hover:text-white" title="Vorige Woche">
            <Icon.left className="h-4 w-4" />
          </button>
          <span className="tabular min-w-36 text-center text-white/80">
            {fmt(weekStart, { day: 'numeric', month: 'short' })} – {fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}
          </span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg p-2 text-white/50 hover:bg-panel-2 hover:text-white" title="Nächste Woche">
            <Icon.chevron className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek())}
            disabled={isThisWeek}
            className="ml-2 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-white/80 transition hover:border-white/20 disabled:opacity-40"
          >
            <Icon.calendar className="h-4 w-4" /> Diese Woche
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 md:mb-6 md:gap-5">
        <Tile label="Quest-Stunden" short="Quest-Std.">
          <span className="text-accent">{fmtHM(s.questMs)}</span>
          {goalMs > 0 && <span className="ml-1.5 text-base font-normal text-white/45">/ {Math.round(goalMs / 3_600_000)}h</span>}
          {goalMs > 0 && <div className="mt-3 text-sm font-normal text-white/40">{Math.round((s.questMs / goalMs) * 100)} % vom Ziel</div>}
        </Tile>
        <Tile label="Tagesdurchschnitt" short="Ø pro Tag">{fmtHM(s.avg)}</Tile>
        <Tile label="Quest-Arbeit vs. Sonstiges" short="Quest-Anteil">
          {questPct}
          <span className="ml-1 text-base font-normal text-white/45">%</span>
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel label="Quest-Stunden · pro Tag">
          <div className="grid h-56 grid-cols-7 gap-1.5 md:h-64 md:gap-6">
            {s.days.map((d, i) => {
              const isToday = dayKey(d.date) === todayKey
              return (
                <div key={i} className="flex min-w-0 flex-col items-center">
                  <span className={`tabular mb-2 whitespace-nowrap text-[10px] md:text-[13px] ${isToday ? 'text-accent' : d.quest ? 'text-white/80' : 'text-white/30'}`}>{fmtHM(d.quest)}</span>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-12 rounded-t-md ${isToday ? 'bg-accent' : 'bg-white/[0.18]'}`}
                      style={{ height: `max(3px, ${(d.quest / maxDay) * 100}%)` }}
                    />
                  </div>
                  <span className={`mt-2 text-[13px] ${isToday ? 'text-accent' : 'text-white/40'}`}>{WEEKDAYS[i]}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel label="Stunden nach Quest">
            {s.byQuest.length === 0 && <p className="text-sm text-white/40">Diese Woche noch keine Quest-Zeit.</p>}
            <div className="flex flex-col gap-4">
              {s.byQuest.map(([qid, ms]) => {
                const q = quests.find((x) => x.id === qid)
                const goal = (q?.weekly_goal_minutes ?? 0) * 60_000
                return (
                  <div key={qid} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-4 text-[15px]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: q?.color }} />
                      <span className="truncate text-white/85">{q?.title ?? 'Quest'}</span>
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (ms / (goal || maxQuest)) * 100)}%`, background: q?.color }}
                      />
                    </div>
                    <span className="tabular text-right text-white/80">
                      {fmtHM(ms)}
                      {goal > 0 && <span className="text-white/35"> / {Math.round(goal / 3_600_000)}h</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel label="Quest-Arbeit vs. Sonstiges">
            <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full bg-accent" style={{ width: `${questPct}%` }} />
              <div className="h-full bg-white/[0.18]" style={{ width: `${total ? 100 - questPct : 0}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-sm text-white/55">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" /> Quest-Arbeit {fmtHM(s.questMs)}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/30" /> Sonstiges {fmtHM(s.otherMs)}
              </span>
            </div>
          </Panel>

          <Panel label={`Erledigt · ${s.done.length}`}>
            {s.done.length === 0 && <p className="text-sm text-white/40">Noch nichts abgehakt.</p>}
            <div className="flex flex-col gap-2">
              {s.done.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quests.find((q) => q.id === t.quest_id)?.color ?? '#8a8a93' }} />
                  <span className="flex-1 truncate text-white/80">{t.title}</span>
                  <span className="text-xs text-white/40">{fmt(new Date(t.done_at!), { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, short, children }: { label: string; short?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-panel px-3 py-4 md:px-7 md:py-6">
      <div className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-white/50 md:text-xs md:tracking-[0.15em]">
        <span className="md:hidden">{short ?? label}</span>
        <span className="hidden md:inline">{label}</span>
      </div>
      <div className="tabular mt-2 text-xl font-medium tracking-tight md:mt-4 md:text-4xl [&_div]:text-xs md:[&_div]:text-sm">{children}</div>
    </div>
  )
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-panel px-4 py-5 md:px-7 md:py-6">
      <div className="mb-6 text-xs font-medium uppercase tracking-[0.15em] text-white/50">{label}</div>
      {children}
    </div>
  )
}
