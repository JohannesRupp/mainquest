import { useEffect, useState } from 'react'

/** Aktuelle Zeit, die sich im angegebenen Intervall aktualisiert (nur wenn aktiv) */
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return now
}
