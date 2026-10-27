/**
 * The System manual's shared pieces: the eyebrow over a section, its heading,
 * the lede paragraph, the card look and the small heading inside a section.
 * Used by SystemManual (The portal tab) and its North Time and Home sections
 * (NorthTimeManual), so every section reads the same.
 */

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal mb-2">{children}</div>
)
export const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink mb-3">{children}</h2>
)
export const Lede = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] leading-[1.7] text-foreground mb-4">{children}</p>
)
export const SubHeading = ({ children, first = false }: { children: React.ReactNode; first?: boolean }) => (
  <h3 className={`font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink ${first ? 'mt-2' : 'mt-6'} mb-3`}>{children}</h3>
)
export const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

/**
 * A line of manual text with the names people see on screen in bold:
 * "Press **Clock in**." Only `**` is read; everything else is plain text.
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split('**')
  return <>{parts.map((p, i) => (i % 2 === 1 ? <b key={i} className="font-bold text-tn-ink">{p}</b> : p))}</>
}
