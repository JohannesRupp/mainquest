import { useCallback, useState } from 'react'

/** useState, das im localStorage des Browsers gespeichert wird */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* Speicher nicht verfügbar */
      }
    },
    [key],
  )
  return [value, set] as const
}
