import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Card, inputCls } from '../components/ui'

type Mode = 'password' | 'link'

export function Login() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  function switchMode(m: Mode) {
    setMode(m)
    setState('idle')
    setMsg('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setState('error')
        setMsg(
          error.message === 'Invalid login credentials'
            ? 'E-Mail oder Passwort falsch. Noch kein Passwort? Melde dich per Login-Link an und leg es unter Einstellungen fest.'
            : error.message,
        )
      }
      // Bei Erfolg übernimmt onAuthStateChange in App.tsx
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setState('error')
      setMsg(
        error.message === 'email rate limit exceeded'
          ? 'Zu viele Login-Mails in kurzer Zeit. Warte etwa eine Stunde oder melde dich mit Passwort an.'
          : error.message,
      )
    } else setState('sent')
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold">MainQuest</h1>
          <p className="mt-1 text-sm text-muted">Quests. Fokus. Fortschritt.</p>
        </div>
        <Card>
          {state === 'sent' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Check dein Postfach: Wir haben dir einen Login-Link an <b>{email}</b> geschickt.
              </p>
              <Button variant="ghost" onClick={() => switchMode('link')}>
                Zurück
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="mb-1 grid grid-cols-2 gap-1 rounded-xl bg-panel-2 p-1 text-sm">
                {(['password', 'link'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-lg py-1.5 transition ${mode === m ? 'bg-line text-white' : 'text-muted hover:text-white'}`}
                  >
                    {m === 'password' ? 'Passwort' : 'Login-Link'}
                  </button>
                ))}
              </div>

              <label className="text-sm text-muted">E-Mail</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="du@beispiel.de"
              />

              {mode === 'password' && (
                <>
                  <label className="text-sm text-muted">Passwort</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                </>
              )}

              <Button variant="primary" disabled={state === 'sending'}>
                {state === 'sending'
                  ? mode === 'password'
                    ? 'Melde an…'
                    : 'Sende…'
                  : mode === 'password'
                    ? 'Anmelden'
                    : 'Login-Link schicken'}
              </Button>
              {state === 'error' && <p className="text-sm text-bad">{msg}</p>}
              {mode === 'password' && state !== 'error' && (
                <p className="text-xs text-muted">Passwort vergessen? Nutze den Login-Link und setz es in den Einstellungen neu.</p>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
