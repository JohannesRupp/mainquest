import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../lib/useStore'
import { supabase } from '../lib/supabase'
import {
  cachedToken,
  disconnectGoogle,
  getToken,
  googleConfigured,
  isGoogleConnected,
  listCalendars,
  type CalendarInfo,
} from '../lib/google'
import { Button, Card, Icon, SectionTitle, inputCls } from '../components/ui'

export function SettingsView({ email, onOpenEntries }: { email: string; onOpenEntries: () => void }) {
  const { settings, saveSettings, syncPending, pendingSyncCount } = useStore()
  const [connected, setConnected] = useState(isGoogleConnected())
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function loadCalendars(token: string) {
    try {
      setCalendars(await listCalendars(token))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  useEffect(() => {
    // Kalenderliste nur laden, wenn ein gültiges Token im Speicher liegt (kein Popup ohne Klick)
    const token = connected && cachedToken()
    if (!token) return
    let cancelled = false
    listCalendars(token)
      .then((list) => !cancelled && setCalendars(list))
      .catch((e: Error) => !cancelled && setErr(e.message))
    return () => {
      cancelled = true
    }
  }, [connected])

  async function connect() {
    setErr('')
    try {
      const token = await getToken(true)
      setConnected(true)
      await loadCalendars(token)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-5 text-3xl font-medium tracking-tight">Einstellungen</h1>

      <SectionTitle>Ziele</SectionTitle>
      <Card className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm">Wochenziel für Quest-Arbeit</div>
          <div className="text-xs text-muted">Wird auf Home und im Review als Fortschritt angezeigt.</div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
          <input
            type="number"
            min={0}
            step={1}
            defaultValue={settings.weekly_goal_minutes ? settings.weekly_goal_minutes / 60 : ''}
            placeholder="40"
            onBlur={(e) => {
              const h = Number(e.target.value)
              const minutes = h > 0 ? Math.round(h * 60) : null
              if (minutes !== settings.weekly_goal_minutes) saveSettings({ weekly_goal_minutes: minutes })
            }}
            className={`${inputCls} w-20 text-right`}
          />
          Std.
        </label>
      </Card>

      <SectionTitle>Zeiteinträge</SectionTitle>
      <Card className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted">Alle getrackten Zeitblöcke ansehen, anpassen oder löschen.</div>
        <Button onClick={onOpenEntries} className="shrink-0">
          <Icon.clock className="h-4 w-4" /> Öffnen
        </Button>
      </Card>


      <SectionTitle>Google Kalender</SectionTitle>
      <Card className="flex flex-col gap-4">
        {!googleConfigured ? (
          <p className="text-sm text-muted">
            Keine Google Client ID gesetzt. Trage <code>VITE_GOOGLE_CLIENT_ID</code> ein (siehe README).
          </p>
        ) : !connected ? (
          <>
            <p className="text-sm text-muted">
              Verbinde dein Google-Konto: Sobald du einen Task abhakst, wird jeder getrackte Zeitblock als Termin
              eingetragen. Tasks ohne Quest landen außerdem automatisch in Google Tasks („Meine Aufgaben“).
            </p>
            <Button variant="primary" onClick={connect}>
              <Icon.calendar className="h-4 w-4" /> Mit Google verbinden
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-good">
                <Icon.check className="h-4 w-4" /> Verbunden
              </span>
              <Button
                variant="ghost"
                onClick={() => {
                  disconnectGoogle()
                  setConnected(false)
                  setCalendars([])
                }}
              >
                Trennen
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Tasks ohne Quest werden automatisch in Google Tasks („Meine Aufgaben“) gespiegelt.</span>
              <Button onClick={() => getToken().catch((e: Error) => setErr(e.message))}>Jetzt abgleichen</Button>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Zielkalender</span>
              {calendars.length > 0 ? (
                <select
                  value={settings.calendar_id}
                  onChange={(e) => saveSettings({ calendar_id: e.target.value })}
                  className={inputCls}
                >
                  {!calendars.some((c) => c.id === settings.calendar_id) && settings.calendar_id !== 'primary' && (
                    <option value={settings.calendar_id}>{settings.calendar_id}</option>
                  )}
                  <option value="primary">Hauptkalender</option>
                  {calendars
                    .filter((c) => !c.primary)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input readOnly value={settings.calendar_id === 'primary' ? 'Hauptkalender' : settings.calendar_id} className={inputCls} />
                  <Button onClick={connect}>Liste laden</Button>
                </div>
              )}
              <span className="text-xs text-muted">Tipp: Leg in Google einen eigenen Kalender „MainQuest“ an.</span>
            </label>

            <label className="flex items-center justify-between text-sm">
              <span>Beim Abhaken automatisch eintragen</span>
              <input
                type="checkbox"
                checked={settings.auto_sync}
                onChange={(e) => saveSettings({ auto_sync: e.target.checked })}
                className="h-5 w-5 accent-[#f5b942]"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                {pendingSyncCount ? `${pendingSyncCount} Zeitblöcke noch nicht im Kalender` : 'Alles synchronisiert'}
              </span>
              <Button
                disabled={busy || !pendingSyncCount}
                onClick={async () => {
                  setBusy(true)
                  await syncPending()
                  setBusy(false)
                }}
              >
                {busy ? 'Trage ein…' : 'Jetzt eintragen'}
              </Button>
            </div>
          </>
        )}
        {err && <p className="text-sm text-bad">{err}</p>}
      </Card>

      <SectionTitle>Konto</SectionTitle>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm">{email}</span>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </Button>
        </div>
        <PasswordForm email={email} />
      </Card>

      <SectionTitle>Auf dem iPhone installieren</SectionTitle>
      <Card className="text-sm text-muted">
        In Safari öffnen, auf <b className="text-white">Teilen</b> tippen und{' '}
        <b className="text-white">Zum Home-Bildschirm</b> wählen. MainQuest läuft dann wie eine normale App im Vollbild.
      </Card>
    </div>
  )
}

function PasswordForm({ email }: { email: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) {
      setState('error')
      setMsg('Mindestens 8 Zeichen.')
      return
    }
    if (pw !== pw2) {
      setState('error')
      setMsg('Die Passwörter stimmen nicht überein.')
      return
    }
    setState('saving')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setState('error')
      setMsg(error.message)
    } else {
      setState('saved')
      setPw('')
      setPw2('')
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
      <span className="text-muted">Passwort festlegen oder ändern</span>
      {/* verstecktes Feld, damit Passwort-Manager den Account zuordnen */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Neues Passwort"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className={inputCls}
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Wiederholen"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        className={inputCls}
      />
      <Button disabled={state === 'saving' || !pw}>{state === 'saving' ? 'Speichere…' : 'Passwort speichern'}</Button>
      {state === 'saved' && <p className="text-good">Gespeichert. Du kannst dich jetzt mit Passwort anmelden.</p>}
      {state === 'error' && <p className="text-bad">{msg}</p>}
    </form>
  )
}
