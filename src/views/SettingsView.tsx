import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import {
  disconnectGoogle,
  getToken,
  googleConfigured,
  isGoogleConnected,
  listCalendars,
  type CalendarInfo,
} from '../lib/google'
import { Button, Card, Icon, SectionTitle, inputCls } from '../components/ui'

export function SettingsView({ email }: { email: string }) {
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
    if (!connected) return
    const raw = localStorage.getItem('mainquest.gtoken')
    if (raw && JSON.parse(raw).expires > Date.now()) loadCalendars(JSON.parse(raw).token)
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
      <h1 className="mb-5 text-2xl font-bold">Einstellungen</h1>

      <SectionTitle>Google Kalender</SectionTitle>
      <Card className="flex flex-col gap-4">
        {!googleConfigured ? (
          <p className="text-sm text-muted">
            Keine Google Client ID gesetzt. Trage <code>VITE_GOOGLE_CLIENT_ID</code> ein (siehe README).
          </p>
        ) : !connected ? (
          <>
            <p className="text-sm text-muted">
              Verbinde deinen Google Kalender: Sobald du einen Task abhakst, wird jeder getrackte Zeitblock als Termin
              eingetragen.
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
