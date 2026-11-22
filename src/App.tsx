import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { StoreProvider, useStore } from './lib/store'
import { Login } from './views/Login'
import { TasksView } from './views/TasksView'
import { QuestsView } from './views/QuestsView'
import { DashboardView } from './views/DashboardView'
import { SettingsView } from './views/SettingsView'
import { TimerBar } from './components/TimerBar'
import { Icon } from './components/ui'

export type Tab = 'tasks' | 'quests' | 'dashboard' | 'settings'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <NotConfigured />
  if (session === undefined) return <Splash />
  if (!session) return <Login />
  return (
    <StoreProvider key={session.user.id}>
      <Shell email={session.user.email ?? ''} />
    </StoreProvider>
  )
}

function Shell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('tasks')
  const [questFilter, setQuestFilter] = useState<string | null>(null)
  const { loading, error, notice, clearMessages } = useStore()

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(clearMessages, 3500)
    return () => clearTimeout(t)
  }, [notice, clearMessages])

  const nav: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
    { id: 'tasks', label: 'Tasks', icon: 'list' },
    { id: 'quests', label: 'Quests', icon: 'sword' },
    { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { id: 'settings', label: 'Einstellungen', icon: 'gear' },
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col md:flex-row">
      {/* Seitenleiste Desktop */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line p-4 md:flex">
        <Logo />
        <div className="mt-6 flex flex-col gap-1">
          {nav.map((n) => {
            const I = Icon[n.icon]
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${tab === n.id ? 'bg-panel-2 text-white' : 'text-muted hover:text-white'}`}
              >
                <I className="h-4 w-4" /> {n.label}
              </button>
            )
          })}
        </div>
      </aside>

      <main className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-8">
        <div className="mb-4 md:hidden">
          <Logo />
        </div>
        <TimerBar />
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            <span>{error}</span>
            <button onClick={clearMessages} className="text-bad/70">✕</button>
          </div>
        )}
        {notice && <div className="mb-4 rounded-xl border border-good/30 bg-good/10 p-3 text-sm text-good">{notice}</div>}
        {loading ? (
          <p className="text-muted">Lade…</p>
        ) : tab === 'tasks' ? (
          <TasksView questFilter={questFilter} setQuestFilter={setQuestFilter} />
        ) : tab === 'quests' ? (
          <QuestsView
            openQuest={(id) => {
              setQuestFilter(id)
              setTab('tasks')
            }}
          />
        ) : tab === 'dashboard' ? (
          <DashboardView />
        ) : (
          <SettingsView email={email} />
        )}
      </main>

      {/* Tab-Leiste Mobil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map((n) => {
          const I = Icon[n.icon]
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${tab === n.id ? 'text-accent' : 'text-muted'}`}
            >
              <I className="h-5 w-5" />
              {n.label === 'Einstellungen' ? 'Settings' : n.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight">MainQuest</span>
    </div>
  )
}

function Splash() {
  return <div className="grid min-h-dvh place-items-center text-muted">Lade…</div>
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <Logo />
      <h1 className="mt-8 text-xl font-semibold">Noch nicht konfiguriert</h1>
      <p className="mt-2 text-muted">
        Lege eine <code>.env</code> nach Vorlage von <code>.env.example</code> an (lokal) bzw. setze die
        Umgebungsvariablen <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel. Details
        stehen in der README.
      </p>
    </div>
  )
}
