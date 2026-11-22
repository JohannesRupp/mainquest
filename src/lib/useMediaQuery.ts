import { useSyncExternalStore } from 'react'

/** true, solange die Media Query zutrifft (z.B. '(max-width: 767px)') */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Handy-Layout (unter Tailwinds md-Breakpoint) */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
