'use client'

// FilterBar: "filter by anything". A Filter button (same language as the
// Columns control) opens a small builder: pick a column, a condition, and a
// value. Each added condition shows as a removable chip (same pill language as
// the team filters it replaces). Generic over the row type via GridColumn<T>.

import { useRef, useState } from 'react'
import type { FilterCond, GridColumn, Operator } from './types'
import { chipText, isValuelessOp, operatorsFor } from './utils'
import { Select } from '@/components/ui/Select'

const inputCls = 'w-full text-[13px] text-tn-ink bg-white border border-slate-200 rounded-[9px] px-2.5 py-2 focus:outline-none focus:border-tn-teal'
const labelCls = 'font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.07em] uppercase text-muted mb-1 block'

export function FilterBar<T>({ columns, conds, onChange }: {
  columns: GridColumn<T>[]
  conds: FilterCond[]
  onChange: (next: FilterCond[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [colId, setColId] = useState('')
  const [op, setOp] = useState<Operator | ''>('')
  const [value, setValue] = useState('')
  const keySeq = useRef(0)
  const byId = new Map(columns.map(c => [c.id, c]))

  const draftCol = colId ? byId.get(colId) : undefined
  const ops = draftCol ? operatorsFor(draftCol.type) : []
  const needsValue = op !== '' && !isValuelessOp(op)
  const canAdd = !!draftCol && op !== '' && (!needsValue || value.trim() !== '')

  function pickColumn(id: string) {
    setColId(id)
    const col = byId.get(id)
    setOp(col ? operatorsFor(col.type)[0].op : '')
    setValue('')
  }

  function add() {
    if (!draftCol || op === '') return
    onChange([...conds, { key: `f${keySeq.current++}`, col: colId, op, value: needsValue ? value : '' }])
    setColId(''); setOp(''); setValue(''); setOpen(false)
  }

  function remove(key: string) {
    onChange(conds.filter(c => c.key !== key))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* active condition chips */}
      {conds.map(c => {
        const col = byId.get(c.col)
        if (!col) return null
        return (
          <span key={c.key} className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12px] text-tn-teal bg-tn-teal-soft border border-tn-teal/25 rounded-full pl-3 pr-1.5 py-[5px]">
            {chipText(col, c)}
            <button type="button" onClick={() => remove(c.key)} aria-label="Remove filter" className="inline-flex w-[18px] h-[18px] items-center justify-center rounded-full text-tn-teal/70 hover:text-tn-teal hover:bg-tn-teal/15 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </span>
        )
      })}

      {conds.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="font-(family-name:--font-display) font-extrabold text-[12px] text-muted hover:text-tn-ink transition-colors px-1.5">
          Clear
        </button>
      )}

      {/* Filter button + builder popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[12.5px] rounded-full px-3.5 py-[7px] border transition-all ${
            open || conds.length > 0 ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground hover:border-tn-teal hover:text-tn-teal'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
          Filter
          {conds.length > 0 && <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-tn-teal bg-white/70 rounded-full px-[7px] py-px">{conds.length}</span>}
        </button>

        {open && (
          <>
            <div onClick={() => setOpen(false)} className="fixed inset-0 z-30" />
            <div className="absolute top-[calc(100%+8px)] right-0 z-[31] w-[290px] bg-white border border-slate-200 rounded-[13px] shadow-[0_24px_60px_-22px_rgba(1,35,88,.5)] p-3.5">
              <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.07em] uppercase text-muted mb-2.5">Add filter</div>

              <label className={labelCls}>Column</label>
              <div className="mb-3">
                <Select
                  fullWidth
                  value={colId}
                  onChange={pickColumn}
                  options={columns.map(c => ({ value: c.id, label: c.label }))}
                  placeholder="Choose a column…"
                  ariaLabel="Filter column"
                  className={`${inputCls} cursor-pointer`}
                />
              </div>

              {draftCol && (
                <>
                  <label className={labelCls}>Condition</label>
                  <div className="mb-3">
                    <Select
                      fullWidth
                      value={op}
                      onChange={v => setOp(v as Operator)}
                      options={ops.map(o => ({ value: o.op, label: o.label }))}
                      ariaLabel="Filter condition"
                      className={`${inputCls} cursor-pointer`}
                    />
                  </div>

                  {needsValue && (
                    <>
                      <label className={labelCls}>Value</label>
                      {draftCol.type === 'enum' && draftCol.options ? (
                        <div className="mb-3.5">
                          <Select
                            fullWidth
                            value={value}
                            onChange={setValue}
                            options={draftCol.options}
                            placeholder="Choose…"
                            ariaLabel="Filter value"
                            className={`${inputCls} cursor-pointer`}
                          />
                        </div>
                      ) : (
                        <input
                          type={draftCol.type === 'number' ? 'number' : draftCol.type === 'date' ? 'date' : 'text'}
                          value={value}
                          onChange={e => setValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && canAdd) add() }}
                          placeholder={draftCol.type === 'number' ? '0' : 'Type a value…'}
                          className={`${inputCls} mb-3.5`}
                          autoFocus
                        />
                      )}
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="w-full font-(family-name:--font-display) font-extrabold text-[13px] bg-tn-primary rounded-[10px] px-4 py-2.5 shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 disabled:bg-slate-100 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <span className={canAdd ? 'text-[#ffffff]' : 'text-slate-400'}>Add filter</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
