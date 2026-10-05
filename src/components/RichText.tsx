import { Fragment } from 'react'

/** Renders `code` and **bold** spans; everything else as plain text. */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
          return (
            <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-700">
              {p.slice(1, -1)}
            </code>
          )
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {p.slice(2, -2)}
            </strong>
          )
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}
