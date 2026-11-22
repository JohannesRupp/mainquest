import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Card, inputCls } from '../components/ui'

export function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setState('error')
      setMsg(error.message)
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
            <p className="text-sm">
              Check dein Postfach: Wir haben dir einen Login-Link an <b>{email}</b> geschickt.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
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
              <Button variant="primary" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sende…' : 'Login-Link schicken'}
              </Button>
              {state === 'error' && <p className="text-sm text-bad">{msg}</p>}
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
