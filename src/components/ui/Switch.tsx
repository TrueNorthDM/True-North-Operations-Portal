'use client'

/**
 * An on/off switch. `label` names the setting, never its state: the state is
 * aria-checked, so a screen reader says it once (audit, 9 October 2026).
 */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`shrink-0 w-10 h-[22px] rounded-full transition-colors disabled:cursor-default disabled:opacity-50 ${on ? 'bg-tn-teal' : 'bg-slate-300'}`}
    >
      <span className={`block w-[18px] h-[18px] rounded-full bg-white transition-transform ${on ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
