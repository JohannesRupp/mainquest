// Google Calendar + Google Tasks über Google Identity Services (reiner Browser-Flow, kein Backend nötig)

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/tasks',
].join(' ')
// v2: neuer Schlüssel, weil alte Tokens noch keine Tasks-Berechtigung haben
const STORAGE_KEY = 'mainquest.gtoken.v2'
/** Event, sobald ein neues Token da ist (Store startet dann ausstehende Syncs) */
export const TOKEN_EVENT = 'mainquest:gtoken'
const CONNECTED_KEY = 'mainquest.gconnected'

export const googleConfigured = Boolean(CLIENT_ID)

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  callback: (r: TokenResponse) => void
  requestAccessToken: (o?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string }) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
let client: TokenClient | null = null
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null

export function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google-Skript konnte nicht geladen werden'))
    document.head.appendChild(s)
  })
  return gisPromise
}

function getClient(): TokenClient {
  if (client) return client
  if (!window.google || !CLIENT_ID) throw new Error('Google nicht konfiguriert')
  client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (r) => {
      if (r.error || !r.access_token) {
        pending?.reject(new Error(r.error ?? 'Kein Token erhalten'))
      } else {
        const expires = Date.now() + ((r.expires_in ?? 3600) - 60) * 1000
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: r.access_token, expires }))
        localStorage.setItem(CONNECTED_KEY, '1')
        pending?.resolve(r.access_token)
        window.dispatchEvent(new Event(TOKEN_EVENT))
      }
      pending = null
    },
    error_callback: (e) => {
      pending?.reject(new Error(e.type === 'popup_closed' ? 'Google-Fenster geschlossen' : e.type))
      pending = null
    },
  })
  return client
}

/** Gültiges Token aus dem Speicher, ohne Popup */
export function cachedToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number }
    return Date.now() < expires ? token : null
  } catch {
    return null
  }
}

export const isGoogleConnected = () => localStorage.getItem(CONNECTED_KEY) === '1'

/**
 * Liefert ein gültiges Access Token. Muss möglichst direkt aus einem Klick heraus
 * aufgerufen werden, damit Safari das Google-Popup nicht blockiert.
 */
export function getToken(forceConsent = false): Promise<string> {
  const cached = !forceConsent && cachedToken()
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    try {
      const c = getClient()
      pending = { resolve, reject }
      c.requestAccessToken({ prompt: forceConsent ? 'consent' : '' })
    } catch (e) {
      reject(e as Error)
    }
  })
}

export function disconnectGoogle() {
  const t = cachedToken()
  if (t) window.google?.accounts.oauth2.revoke(t)
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(CONNECTED_KEY)
}

async function gfetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(token, `https://www.googleapis.com/calendar/v3${path}`, 'Google Kalender', init)
}

async function apiFetch<T>(token: string, url: string, label: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY)
    throw new Error('Google-Sitzung abgelaufen, bitte erneut verbinden')
  }
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/.test(body))
      throw new GoogleError(`${label}: API ist im Google-Cloud-Projekt noch nicht aktiviert.`, res.status)
    if (res.status === 403 && /insufficient/i.test(body)) {
      localStorage.removeItem(STORAGE_KEY)
      throw new GoogleError(`${label}: Berechtigung fehlt. Bitte Google in den Einstellungen neu verbinden.`, res.status)
    }
    throw new GoogleError(`${label} Fehler ${res.status}: ${body}`, res.status)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export class GoogleError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface CalendarInfo {
  id: string
  summary: string
  primary?: boolean
  accessRole: string
}

export async function listCalendars(token: string): Promise<CalendarInfo[]> {
  const r = await gfetch<{ items: CalendarInfo[] }>(token, '/users/me/calendarList?minAccessRole=writer')
  return r.items
}

export async function createEvent(
  token: string,
  calendarId: string,
  ev: { summary: string; description: string; start: string; end: string; entryId: string },
): Promise<string> {
  const r = await gfetch<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: ev.start },
      end: { dateTime: ev.end },
      transparency: 'transparent',
      extendedProperties: { private: { mainquestEntry: ev.entryId } },
    }),
  })
  return r.id
}

export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  await gfetch(token, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: 'DELETE' })
}

// ---------- Google Tasks (Liste „Meine Aufgaben“) ----------

const TASKS = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

export interface GTaskInput {
  title: string
  /** YYYY-MM-DD */
  day: string
  done: boolean
}

const gtaskBody = (t: GTaskInput) => ({
  title: t.title,
  // Google Tasks speichert nur das Datum, die Uhrzeit wird ignoriert
  due: `${t.day}T00:00:00.000Z`,
  status: t.done ? 'completed' : 'needsAction',
  ...(t.done ? {} : { completed: null }),
})

export async function createGTask(token: string, t: GTaskInput): Promise<string> {
  const r = await apiFetch<{ id: string }>(token, TASKS, 'Google Tasks', {
    method: 'POST',
    body: JSON.stringify({ ...gtaskBody(t), notes: 'Aus MainQuest' }),
  })
  return r.id
}

export async function updateGTask(token: string, id: string, t: GTaskInput) {
  await apiFetch(token, `${TASKS}/${encodeURIComponent(id)}`, 'Google Tasks', {
    method: 'PATCH',
    body: JSON.stringify(gtaskBody(t)),
  })
}

export async function deleteGTask(token: string, id: string) {
  await apiFetch(token, `${TASKS}/${encodeURIComponent(id)}`, 'Google Tasks', { method: 'DELETE' })
}
