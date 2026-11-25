import { useState, type FormEvent } from 'react'
import type { InsertAt } from '../lib/types'
import { useLocalState } from '../lib/useLocalState'
import { QuestPicker } from './QuestPicker'
import { Icon } from './ui'
import { useIsMobile } from '../lib/useMediaQuery'

/** Gestrichelte Eingabe "Task hinzufügen…" mit Umschalter Oben/Unten */
export function AddTaskInput({
  placeholder,
  onAdd,
  compact,
  questId,
  onQuestChange,
}: {
  placeholder: string
  onAdd: (title: string, at: InsertAt) => void
  compact?: boolean
  questId?: string | null
  onQuestChange?: (id: string | null) => void
}) {
  const [title, setTitle] = useState('')
  const mobile = useIsMobile()
  const dot = compact || mobile
  const [at, setAt] = useLocalState<InsertAt>('mainquest.insertAt', 'bottom')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onAdd(t, at)
    setTitle('')
  }

  return (
    <form
      onSubmit={submit}
      className={`flex items-center gap-1.5 rounded-xl border border-dashed border-white/[0.14] bg-white/[0.015] transition focus-within:border-white/30 ${compact ? 'py-1 pl-3 pr-1' : 'py-1.5 pl-4 pr-1.5'}`}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="send"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-white outline-none placeholder:text-white/30"
      />
      {onQuestChange && (
        <div className={dot ? '' : 'max-w-[12rem]'}>
          <QuestPicker value={questId ?? null} onChange={onQuestChange} variant={dot ? 'dot' : 'chip'} align="right" />
        </div>
      )}
      <div className="hidden shrink-0 rounded-lg border border-white/[0.08] bg-black/30 p-0.5 text-[13px] md:flex">
        {(['top', 'bottom'] as const).map((v) => {
          const I = v === 'top' ? Icon.toTop : Icon.toBottom
          return (
            <button
              key={v}
              type="button"
              onClick={() => setAt(v)}
              title={v === 'top' ? 'Neue Tasks oben einfügen' : 'Neue Tasks unten einfügen'}
              className={`flex items-center gap-1 rounded-md transition ${compact ? 'p-1.5' : 'px-2 py-1'} ${at === v ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white'}`}
            >
              <I className="h-3.5 w-3.5" />
              {!compact && (v === 'top' ? 'Oben' : 'Unten')}
            </button>
          )
        })}
      </div>
      <button
        type="submit"
        disabled={!title.trim()}
        title="Task hinzufügen"
        aria-label="Task hinzufügen"
        className={`grid shrink-0 place-items-center rounded-lg bg-accent text-accent-ink transition disabled:bg-white/[0.06] disabled:text-white/30 ${compact ? 'h-9 w-9' : 'h-10 w-10'} ${title.trim() ? '' : 'md:hidden'}`}
      >
        <Icon.plus className="h-4 w-4" />
      </button>
    </form>
  )
}
