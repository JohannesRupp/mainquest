import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { StoreProvider, useStore } from './lib/store'
import { useLocalState } from './lib/useLocalState'
import { Login } from './views/Login'
import { HomeView } from './views/HomeView'
import { PlanView } from './views/PlanView'
import { CalendarView } from './views/CalendarView'
import { QuestsView } from './views/QuestsView'
import { DashboardView } from './views/DashboardView'
import { SettingsView } from './views/SettingsView'
import { TimeEntriesView } from './views/TimeEntriesView'
import { FocusView } from './views/FocusView'
import { TimerBar } from './components/TimerBar'
import { Icon, popoverCls, usePopover } from './components/ui'

export type Tab = 'home' | 'plan' | 'calendar' | 'focus' | 'quests' | 'review' | 'settings' | 'entries'

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

const NAV: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar' },
  { id: 'focus', label: 'Fokus', icon: 'focus' },
  { id: 'quests', label: 'Quests', icon: 'sword' },
  { id: 'review', label: 'Review', icon: 'review' },
]

const WIDE: Tab[] = ['home', 'plan', 'calendar', 'quests', 'review']

function Shell({ email }: { email: string }) {
  const [tab, setTabState] = useState<Tab>('home')
  const [lastTab, setLastTab] = useState<Tab>('home')
  const [planFilter, setPlanFilter] = useLocalState<string[]>('mainquest.planFilter', [])
  const { loading, error, notice, clearMessages } = useStore()

  const setTab = (t: Tab) => {
    if (t !== 'focus') setLastTab(t)
    setTabState(t)
    window.scrollTo(0, 0)
  }
  const closeFocus = useCallback(() => setTabState(lastTab), [lastTab])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(clearMessages, 3500)
    return () => clearTimeout(t)
  }, [notice, clearMessages])

  if (tab === 'focus' && !loading) return <FocusView onBack={closeFocus} onPlan={() => setTab('plan')} />

  const wide = WIDE.includes(tab)

  return (
    <div className="min-h-dvh">
      {/* Navigation oben (Desktop) */}
      <header className="sticky top-0 z-20 hidden border-b border-line bg-bg/85 backdrop-blur md:block">
        <div className="flex items-center gap-8 px-8 py-3">
          <img src="/favicon.svg" alt="MainQuest" className="h-7 w-7" />
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === n.id ? 'bg-panel-2 text-white' : 'text-white/45 hover:text-white'}`}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <AccountMenu email={email} onNavigate={setTab} />
        </div>
      </header>

      <main
        className={`mx-auto px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-12 ${wide ? 'max-w-[1500px] md:pt-10' : 'max-w-3xl md:pt-10'}`}
      >
        <div className="mb-5 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">MainQuest</span>
          </div>
          <AccountMenu email={email} onNavigate={setTab} />
        </div>
        {tab !== 'home' && <TimerBar onOpenFocus={() => setTab('focus')} />}
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            <span>{error}</span>
            <button onClick={clearMessages} className="text-bad/70">✕</button>
          </div>
        )}
        {notice && <div className="mb-4 rounded-xl border border-good/30 bg-good/10 p-3 text-sm text-good">{notice}</div>}
        {loading ? (
          <p className="text-muted">Lade…</p>
        ) : tab === 'home' ? (
          <HomeView />
        ) : tab === 'plan' ? (
          <PlanView filter={planFilter} setFilter={setPlanFilter} />
        ) : tab === 'calendar' ? (
          <CalendarView />
        ) : tab === 'quests' ? (
          <QuestsView
            openQuest={(id) => {
              setPlanFilter([id])
              setTab('plan')
            }}
          />
        ) : tab === 'review' ? (
          <DashboardView />
        ) : tab === 'entries' ? (
          <TimeEntriesView onBack={() => setTab('settings')} />
        ) : (
          <SettingsView email={email} onOpenEntries={() => setTab('entries')} />
        )}
      </main>

      <ChatButton />

      {/* Tab-Leiste Mobil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => {
          const I = Icon[n.icon]
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] ${tab === n.id ? 'text-accent' : 'text-muted'}`}
            >
              <I className="h-5 w-5" />
              {n.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function AccountMenu({ email, onNavigate }: { email: string; onNavigate: (t: Tab) => void }) {
  const pop = usePopover()
  const go = (t: Tab) => {
    pop.setOpen(false)
    onNavigate(t)
  }
  return (
    <div ref={pop.ref} className="relative">
      <button
        onClick={() => pop.setOpen(!pop.open)}
        title={email}
        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-sm font-semibold uppercase transition hover:border-white/25"
      >
        {email.charAt(0) || '?'}
      </button>
      {pop.open && (
        <div className={`${popoverCls} right-0`}>
          <div className="truncate px-2.5 py-2 text-xs text-muted">{email}</div>
          <MenuItem icon="gear" label="Einstellungen" onClick={() => go('settings')} />
          <MenuItem icon="clock" label="Zeiteinträge" onClick={() => go('entries')} />
          <MenuItem icon="logout" label="Abmelden" onClick={() => supabase.auth.signOut()} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: keyof typeof Icon; label: string; onClick: () => void }) {
  const I = Icon[icon]
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/80 hover:bg-panel-2 hover:text-white">
      <I className="h-4 w-4 text-muted" /> {label}
    </button>
  )
}

/** Chat-Button unten rechts (Funktion folgt) */
function ChatButton() {
  const pop = usePopover()
  return (
    <div ref={pop.ref} className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6">
      {pop.open && (
        <div className="absolute bottom-14 right-0 w-72 rounded-2xl border border-line bg-panel p-4 shadow-2xl shadow-black/60">
          <div className="mb-1 font-medium">Quest-Coach</div>
          <p className="text-sm text-muted">Hier kommt bald ein Chat, der dir beim Planen und Fokussieren hilft.</p>
        </div>
      )}
      <button
        onClick={() => pop.setOpen(!pop.open)}
        title="Chat"
        className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-white/70 shadow-lg shadow-black/40 transition hover:border-white/25 hover:text-white"
      >
        <Icon.chat className="h-5 w-5" />
      </button>
    </div>
  )
}

function Splash() {
  return <div className="grid min-h-dvh place-items-center text-muted">Lade…</div>
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <h1 className="mt-8 text-xl font-semibold">Noch nicht konfiguriert</h1>
      <p className="mt-2 text-muted">
        Lege eine <code>.env</code> nach Vorlage von <code>.env.example</code> an (lokal) bzw. setze die
        Umgebungsvariablen <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel. Details
        stehen in der README.
      </p>
    </div>
  )
}
