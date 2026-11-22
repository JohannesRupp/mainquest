import { useStore } from '../lib/store'
import { Icon, IconButton, popoverCls, usePopover } from './ui'

/** Quest auswählen: als Chip (Karte/Eingabe) oder als kleiner Farbpunkt (schmale Spalten) */
export function QuestPicker({
  value,
  onChange,
  variant = 'chip',
  align = 'left',
}: {
  value: string | null
  onChange: (id: string | null) => void
  variant?: 'chip' | 'dot'
  align?: 'left' | 'right'
}) {
  const { quests } = useStore()
  const pop = usePopover()
  const quest = quests.find((q) => q.id === value)
  const active = quests.filter((q) => q.status === 'active' || q.id === value)

  const pick = (id: string | null) => {
    onChange(id)
    pop.setOpen(false)
  }

  return (
    <div ref={pop.ref} className="relative min-w-0">
      {variant === 'chip' ? (
        <button
          type="button"
          onClick={() => pop.setOpen(!pop.open)}
          className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[13px] transition hover:border-white/25 hover:text-white ${quest ? 'border-white/[0.08] bg-white/[0.02] text-white/60' : 'border-dashed border-white/[0.14] text-white/35'}`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quest?.color ?? 'rgba(255,255,255,0.25)' }} />
          <span className="truncate">{quest ? quest.title : 'Quest hinzufügen'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => pop.setOpen(!pop.open)}
          title={quest ? quest.title : 'Ohne Quest'}
          className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-panel-2"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${quest ? '' : 'border border-dashed border-white/40'}`}
            style={quest ? { background: quest.color } : undefined}
          />
        </button>
      )}

      {pop.open && (
        <div className={`${popoverCls} ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <Option label="Ohne Quest" selected={!value} onClick={() => pick(null)} />
          {active.map((q) => (
            <Option key={q.id} label={q.title} color={q.color} selected={q.id === value} onClick={() => pick(q.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Option({ label, color, selected, onClick }: { label: string; color?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-white/80 hover:bg-panel-2 hover:text-white"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${color ? '' : 'border border-dashed border-white/40'}`}
        style={color ? { background: color } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
      {selected && <Icon.check className="h-3.5 w-3.5 text-accent" />}
    </button>
  )
}

/** Filter-Button mit Mehrfachauswahl von Quests (leer = alle) */
export function QuestFilter({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { quests } = useStore()
  const pop = usePopover()
  const active = quests.filter((q) => q.status === 'active')
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div ref={pop.ref} className="relative">
      <IconButton active={value.length > 0} onClick={() => pop.setOpen(!pop.open)} title="Nach Quest filtern">
        <Icon.filter className="h-4 w-4" />
      </IconButton>
      {pop.open && (
        <div className={`${popoverCls} right-0`}>
          <div className="flex items-center justify-between px-2.5 py-1.5 text-xs uppercase tracking-wider text-muted">
            <span>Quests</span>
            {value.length > 0 && (
              <button onClick={() => onChange([])} className="normal-case tracking-normal text-accent">
                Alle zeigen
              </button>
            )}
          </div>
          {active.length === 0 && <p className="px-2.5 py-1.5 text-sm text-muted">Keine aktiven Quests</p>}
          {active.map((q) => (
            <Option key={q.id} label={q.title} color={q.color} selected={value.includes(q.id)} onClick={() => toggle(q.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
