export type Letter = 'A' | 'B' | 'C' | 'D'
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D']

interface RawQuestion {
  id: string
  /** One of the official exam domains (EXAM_DOMAINS[].name). */
  domain: string
  /** Original fine-grained topic area. */
  subdomain: string
  topic: string
  question: string
  options: Record<Letter, string>
  correct_answer: string
  technical_reason: {
    section_title: string
    intro: string
    key_facts?: string[]
    explanation?: string
    architecture_verdict?: string
    points: string[]
  }
  distractor_analysis: {
    section_title: string
    options: Partial<Record<Letter, { title: string; trap: string; explanation: string }>>
  }
  references: { section_title: string; source: string; points: string[] }
}

export interface Question extends RawQuestion {
  part: number
  index: number
  correct: Letter
  /** Short subdomain label, without the Vietnamese parenthetical. */
  domainShort: string
  /** Official exam domain key, from `domain`. */
  examDomain: ExamDomainKey
  /** Coarse category, used for the per-topic breakdown. */
  category: string
}

/** Official CCA-F exam domains and their weights. */
export const EXAM_DOMAINS = [
  { key: 'agentic', name: 'Agentic Architecture & Orchestration', weight: 27 },
  { key: 'code', name: 'Claude Code Configuration & Workflows', weight: 20 },
  { key: 'prompt', name: 'Prompt Engineering & Structured Output', weight: 20 },
  { key: 'tools', name: 'Tool Design & MCP Integration', weight: 18 },
  { key: 'context', name: 'Context Management & Reliability', weight: 15 },
] as const
export type ExamDomainKey = (typeof EXAM_DOMAINS)[number]['key']
export const EXAM_QUESTION_COUNT = 60

function examDomainOf(q: RawQuestion): ExamDomainKey {
  const d = EXAM_DOMAINS.find((d) => d.name === q.domain)
  if (!d) throw new Error(`${q.id}: unknown domain "${q.domain}"`)
  return d.key
}

const modules = import.meta.glob<RawQuestion>('../questions/*.json', { eager: true, import: 'default' })

export const QUESTIONS: Question[] = Object.values(modules)
  .map((q) => {
    const m = q.id.match(/p(\d+)_(\d+)$/)
    const domainShort = q.subdomain.replace(/\s*\(.*$/, '').trim()
    return {
      ...q,
      part: m ? Number(m[1]) : 0,
      index: m ? Number(m[2]) : 0,
      correct: q.correct_answer.trim()[0] as Letter,
      domainShort,
      examDomain: examDomainOf(q),
      category: domainShort.split(/\s*&\s*/)[0].trim(),
    }
  })
  .sort((a, b) => a.part - b.part || a.index - b.index)

export const QUESTION_MAP = new Map(QUESTIONS.map((q) => [q.id, q]))

export const PARTS = [...new Set(QUESTIONS.map((q) => q.part))].map((part) => ({
  part,
  ids: QUESTIONS.filter((q) => q.part === part).map((q) => q.id),
}))
