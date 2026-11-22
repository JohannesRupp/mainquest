import type { Task } from './types'

/** Offene Tasks in ihrer Reihenfolge, erledigte darunter */
export const openFirst = (list: Task[]) => [...list.filter((t) => !t.done), ...list.filter((t) => t.done)]
