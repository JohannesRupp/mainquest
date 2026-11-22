import { useRef, useState, type DragEvent } from 'react'

export const DRAG_TYPE = 'application/x-mainquest-task'

/** Drop-Ziel für eine Task-Liste: ermittelt, vor welcher Karte abgelegt wird */
export function useDropList(onDrop: (taskId: string, beforeId: string | null) => void) {
  const ref = useRef<HTMLDivElement>(null)
  // undefined = nichts darüber, null = ans Ende, sonst ID der Karte, vor der eingefügt wird
  const [before, setBefore] = useState<string | null | undefined>(undefined)

  const handlers = {
    onDragOver(e: DragEvent) {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      let b: string | null = null
      for (const el of ref.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? []) {
        const r = el.getBoundingClientRect()
        if (e.clientY < r.top + r.height / 2) {
          b = el.dataset.taskId ?? null
          break
        }
      }
      if (b !== before) setBefore(b)
    },
    onDragLeave(e: DragEvent) {
      if (!ref.current?.contains(e.relatedTarget as Node)) setBefore(undefined)
    },
    onDrop(e: DragEvent) {
      const id = e.dataTransfer.getData(DRAG_TYPE)
      e.preventDefault()
      const b = before ?? null
      setBefore(undefined)
      if (id) onDrop(id, b)
    },
  }
  return { ref, before, handlers }
}

export function DropLine() {
  return <div className="h-0.5 rounded-full bg-accent shadow-[0_0_8px] shadow-accent/60" />
}
