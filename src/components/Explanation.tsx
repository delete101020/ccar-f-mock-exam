import { BookOpen, CheckCircle2, ChevronDown, XCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { LETTERS, type Letter, type Question } from '../data'
import RichText from './RichText'

/** Rewrites original option letters in explanation headings to the displayed letters. */
function remapper(order: Letter[]) {
  const display = (orig: string) => LETTERS[order.indexOf(orig as Letter)] ?? orig
  return (text: string) =>
    text.replace(/^([A-D])(?= (sai|đúng))/, (m) => display(m)).replace(/Why ([A-D]) is correct/, (_, l) => `Why ${display(l)} is correct`)
}

function Section({ title, icon, tone, children }: { title: string; icon: ReactNode; tone: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-slate-800"
      >
        <span className={tone}>{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">{children}</div>}
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
      {items.map((p, i) => (
        <li key={i}>
          <RichText text={p} />
        </li>
      ))}
    </ul>
  )
}

export default function Explanation({ question, order }: { question: Question; order: Letter[] }) {
  const remap = remapper(order)
  const { technical_reason: tr, distractor_analysis: da, references: ref } = question
  const distractors = order.filter((l) => da.options[l]).map((l) => da.options[l]!)

  return (
    <div className="space-y-3">
      <Section title={remap(tr.section_title)} icon={<CheckCircle2 className="size-4" />} tone="text-emerald-600">
        {tr.intro && (
          <p>
            <RichText text={tr.intro} />
          </p>
        )}
        {tr.key_facts && <Bullets items={tr.key_facts} />}
        {tr.explanation && (
          <p>
            <RichText text={tr.explanation} />
          </p>
        )}
        {tr.architecture_verdict && (
          <p className="font-medium text-slate-800">
            <RichText text={tr.architecture_verdict} />
          </p>
        )}
        <Bullets items={tr.points} />
      </Section>

      <Section title={da.section_title} icon={<XCircle className="size-4" />} tone="text-rose-500">
        {distractors.map((d, i) => (
          <div key={i} className="rounded-lg bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">
              <RichText text={remap(d.title)} />
            </p>
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {d.trap}
            </span>
            <p className="mt-2">
              <RichText text={d.explanation} />
            </p>
          </div>
        ))}
      </Section>

      <Section title={ref.section_title} icon={<BookOpen className="size-4" />} tone="text-blue-600">
        <p className="font-medium text-slate-800">
          <RichText text={ref.source} />
        </p>
        <Bullets items={ref.points} />
      </Section>
    </div>
  )
}
