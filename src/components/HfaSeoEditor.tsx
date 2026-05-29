'use client'

/**
 * HfaSeoEditor — HFA-only SEO metadata block on the page detail.
 *
 * Edits four fields together because they're a single editorial decision:
 *   - Cluster (e.g. Faith, Health)
 *   - Primary keyphrase
 *   - Tracked (in rank-tracker? boolean)
 *   - Secondary keyphrases (chips, add/remove)
 *
 * View mode shows whatever is set; edit mode replaces the whole block with
 * inputs. Mirrors PageDetail's view/edit pattern so the workflow feels the
 * same across sections.
 */

import { useState, useTransition } from 'react'
import { saveHfaPageSeo } from '@/app/actions'

interface Props {
  pageId: string
  initialCluster: string | null
  initialPrimaryKeyword: string | null
  initialTracked: boolean
  initialSecondaryKeyphrases: string[]
}

export function HfaSeoEditor({
  pageId,
  initialCluster,
  initialPrimaryKeyword,
  initialTracked,
  initialSecondaryKeyphrases,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [cluster, setCluster] = useState(initialCluster ?? '')
  const [primary, setPrimary] = useState(initialPrimaryKeyword ?? '')
  const [tracked, setTracked] = useState(initialTracked)
  const [secondary, setSecondary] = useState<string[]>(initialSecondaryKeyphrases ?? [])
  const [draft, setDraft] = useState('')
  const [saving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<'saved' | null>(null)

  function addSecondary() {
    const v = draft.trim()
    if (!v) return
    if (secondary.includes(v)) {
      setDraft('')
      return
    }
    setSecondary([...secondary, v])
    setDraft('')
  }

  function removeSecondary(v: string) {
    setSecondary(secondary.filter(s => s !== v))
  }

  function handleSave() {
    setError(null)
    startSave(async () => {
      const res = await saveHfaPageSeo({
        pageId,
        cluster: cluster.trim() || null,
        primaryKeyword: primary.trim() || null,
        tracked,
        secondaryKeyphrases: secondary,
      })
      if (!res.ok) {
        setError(res.error ?? 'Could not save SEO metadata.')
        return
      }
      setFlash('saved')
      setIsEditing(false)
      setTimeout(() => setFlash(null), 2000)
    })
  }

  function handleCancel() {
    setCluster(initialCluster ?? '')
    setPrimary(initialPrimaryKeyword ?? '')
    setTracked(initialTracked)
    setSecondary(initialSecondaryKeyphrases ?? [])
    setDraft('')
    setError(null)
    setIsEditing(false)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">SEO metadata</h3>
          <p className="text-xs text-slate-500 mt-0.5">Cluster, target keyphrases, rank-tracking flag.</p>
        </div>
        <div className="flex items-center gap-3">
          {flash === 'saved' && <span className="text-xs text-emerald-700">Saved ✓</span>}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors bg-hfa-primary hover:bg-hfa-primary-hover"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors bg-hfa-primary hover:bg-hfa-primary-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {!isEditing ? (
        // ── VIEW MODE ──────────────────────────────────────────────────
        <div className="space-y-3">
          <FieldRow label="Cluster" value={initialCluster || <Empty />} />
          <FieldRow label="Primary keyphrase" value={initialPrimaryKeyword || <Empty />} />
          <FieldRow
            label="Tracked"
            value={
              initialTracked ? (
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Yes
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  No
                </span>
              )
            }
          />
          <FieldRow
            label="Secondary keyphrases"
            value={
              initialSecondaryKeyphrases && initialSecondaryKeyphrases.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {initialSecondaryKeyphrases.map(s => (
                    <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <Empty />
              )
            }
          />
        </div>
      ) : (
        // ── EDIT MODE ──────────────────────────────────────────────────
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Cluster
            </label>
            <input
              type="text"
              value={cluster}
              onChange={e => setCluster(e.target.value)}
              placeholder="e.g. Faith, Health, Family"
              className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hfa-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Primary keyphrase
            </label>
            <input
              type="text"
              value={primary}
              onChange={e => setPrimary(e.target.value)}
              placeholder="e.g. how to study the Bible"
              className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hfa-primary/30"
            />
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={tracked}
                onChange={e => setTracked(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-hfa-primary focus:ring-hfa-primary/30"
              />
              <span className="font-medium">Tracked</span>
              <span className="text-slate-500 text-xs">(part of rank-tracker set)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Secondary keyphrases
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {secondary.length === 0 && (
                <span className="text-xs text-slate-400 italic">No secondary keyphrases yet.</span>
              )}
              {secondary.map(s => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSecondary(s)}
                    aria-label={`Remove ${s}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSecondary()
                  }
                }}
                placeholder="Add a keyphrase and press Enter"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hfa-primary/30"
              />
              <button
                type="button"
                onClick={addSecondary}
                disabled={!draft.trim()}
                className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-44 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 pt-1">
        {label}
      </div>
      <div className="text-sm text-slate-800 min-w-0 flex-1">{value}</div>
    </div>
  )
}

function Empty() {
  return <span className="text-slate-400 italic text-sm">Not set</span>
}
