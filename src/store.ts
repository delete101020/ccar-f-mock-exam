import { useCallback, useEffect, useState } from 'react'
import { EXAM_DOMAINS, EXAM_QUESTION_COUNT, LETTERS, PARTS, QUESTION_MAP, QUESTIONS, type Letter } from './data'

export type Mode = 'practice' | 'exam'
export type SourceKind = 'part' | 'all' | 'random' | 'wrong' | 'flagged' | 'real'

export interface Session {
  id: string
  /** Slot key: one resumable session per slot (e.g. "p1:practice"). */
  slot: string
  title: string
  mode: Mode
  questionIds: string[]
  /** Display order of original option letters per question. */
  optionOrder: Record<string, Letter[]>
  answers: Record<string, Letter>
  /** Practice mode: questions whose answer has been checked (locked). */
  checked: Record<string, boolean>
  current: number
  startedAt: number
  finishedAt?: number
  /** Accumulated active time in seconds. */
  elapsed: number
  /** Exam mode: wall-clock deadline (ms). Time keeps running while away. */
  deadline?: number
  /** Exam was auto-submitted because time ran out. */
  timedOut?: boolean
}

export interface QuestionStat {
  attempts: number
  correct: number
  lastCorrect: boolean
}

export interface Settings {
  shuffleQuestions: boolean
  shuffleOptions: boolean
  randomCount: number
}

const KEY = {
  sessions: 'ccaf.sessions', // active sessions by slot
  history: 'ccaf.history', // finished sessions, newest first
  stats: 'ccaf.stats',
  flags: 'ccaf.flags',
  settings: 'ccaf.settings',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: progress just won't persist */
  }
  window.dispatchEvent(new CustomEvent('ccaf-storage', { detail: key }))
}

/** Subscribe a component to one storage key. */
function useStored<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  useEffect(() => {
    const sync = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read(key, fallback))
    }
    window.addEventListener('ccaf-storage', sync)
    return () => window.removeEventListener('ccaf-storage', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(read(key, fallback)) : v
      write(key, next)
      setValue(next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, set]
}

export const DEFAULT_SETTINGS: Settings = { shuffleQuestions: false, shuffleOptions: false, randomCount: 60 }

export const useSettings = () => useStored<Settings>(KEY.settings, DEFAULT_SETTINGS)
export const useSessions = () => useStored<Record<string, Session>>(KEY.sessions, {})
export const useHistory = () => useStored<Session[]>(KEY.history, [])
export const useStats = () => useStored<Record<string, QuestionStat>>(KEY.stats, {})
export const useFlags = () => useStored<string[]>(KEY.flags, [])

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sourceIds(kind: SourceKind, part?: number): string[] {
  switch (kind) {
    case 'part':
      return PARTS.find((p) => p.part === part)?.ids ?? []
    case 'all':
      return QUESTIONS.map((q) => q.id)
    case 'random': {
      const n = read(KEY.settings, DEFAULT_SETTINGS).randomCount
      return shuffle(QUESTIONS.map((q) => q.id)).slice(0, n)
    }
    case 'wrong': {
      const stats = read<Record<string, QuestionStat>>(KEY.stats, {})
      return QUESTIONS.filter((q) => stats[q.id] && !stats[q.id].lastCorrect).map((q) => q.id)
    }
    case 'real':
      return shuffle(realExamIds())
    case 'flagged': {
      const flags = new Set(read<string[]>(KEY.flags, []))
      return QUESTIONS.filter((q) => flags.has(q.id)).map((q) => q.id)
    }
  }
}

/** Per-domain question counts for a full exam (largest-remainder rounding of the weights). */
export function examQuota(total = EXAM_QUESTION_COUNT): Record<string, number> {
  const raw = EXAM_DOMAINS.map((d) => ({ key: d.key, exact: (total * d.weight) / 100 }))
  const quota = Object.fromEntries(raw.map((r) => [r.key, Math.floor(r.exact)]))
  let left = total - Object.values(quota).reduce((a, b) => a + b, 0)
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left-- <= 0) break
    quota[r.key]++
  }
  return quota
}

/** Draws a full exam: questions sampled per domain by official weight; shortfalls topped up from the rest. */
function realExamIds(): string[] {
  const quota = examQuota()
  const picked: string[] = []
  for (const d of EXAM_DOMAINS) {
    const pool = shuffle(QUESTIONS.filter((q) => q.examDomain === d.key).map((q) => q.id))
    picked.push(...pool.slice(0, quota[d.key]))
  }
  const taken = new Set(picked)
  const rest = shuffle(QUESTIONS.filter((q) => !taken.has(q.id)).map((q) => q.id))
  return [...picked, ...rest].slice(0, Math.min(EXAM_QUESTION_COUNT, QUESTIONS.length))
}

export function createSession(opts: { slot: string; title: string; mode: Mode; ids: string[] }): Session {
  const settings = read(KEY.settings, DEFAULT_SETTINGS)
  const ids = settings.shuffleQuestions ? shuffle(opts.ids) : opts.ids
  const session: Session = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    slot: opts.slot,
    title: opts.title,
    mode: opts.mode,
    questionIds: ids,
    optionOrder: Object.fromEntries(ids.map((id) => [id, settings.shuffleOptions ? shuffle(LETTERS) : LETTERS])),
    answers: {},
    checked: {},
    current: 0,
    startedAt: Date.now(),
    elapsed: 0,
    deadline: opts.mode === 'exam' ? Date.now() + examSeconds(ids.length) * 1000 : undefined,
  }
  const sessions = read<Record<string, Session>>(KEY.sessions, {})
  write(KEY.sessions, { ...sessions, [session.slot]: session })
  return session
}

export function saveSession(session: Session) {
  const sessions = read<Record<string, Session>>(KEY.sessions, {})
  write(KEY.sessions, { ...sessions, [session.slot]: session })
}

export function discardSession(slot: string) {
  const { [slot]: _, ...rest } = read<Record<string, Session>>(KEY.sessions, {})
  write(KEY.sessions, rest)
}

/** Record answers in per-question stats (used by practice-mode checks and exam submit). */
export function recordAnswers(entries: { id: string; correct: boolean }[]) {
  const stats = read<Record<string, QuestionStat>>(KEY.stats, {})
  for (const { id, correct } of entries) {
    const s = stats[id] ?? { attempts: 0, correct: 0, lastCorrect: false }
    stats[id] = { attempts: s.attempts + 1, correct: s.correct + (correct ? 1 : 0), lastCorrect: correct }
  }
  write(KEY.stats, stats)
}

export function finishSession(session: Session): Session {
  const done = { ...session, finishedAt: Date.now() }
  if (session.mode === 'exam') {
    recordAnswers(
      session.questionIds
        .filter((id) => session.answers[id])
        .map((id) => ({ id, correct: session.answers[id] === QUESTION_MAP.get(id)?.correct })),
    )
  }
  discardSession(session.slot)
  const history = read<Session[]>(KEY.history, [])
  write(KEY.history, [done, ...history].slice(0, 30))
  return done
}

export function findFinished(id: string): Session | undefined {
  return read<Session[]>(KEY.history, []).find((s) => s.id === id)
}

export function scoreOf(session: Session) {
  let correct = 0
  let wrong = 0
  for (const id of session.questionIds) {
    const a = session.answers[id]
    if (!a) continue
    if (a === QUESTION_MAP.get(id)?.correct) correct++
    else wrong++
  }
  const total = session.questionIds.length
  return { correct, wrong, skipped: total - correct - wrong, total, pct: total ? Math.round((correct / total) * 100) : 0 }
}

export function resetAllProgress() {
  Object.values(KEY)
    .filter((k) => k !== KEY.settings)
    .forEach((k) => {
      localStorage.removeItem(k)
      window.dispatchEvent(new CustomEvent('ccaf-storage', { detail: k }))
    })
}

export const PASS_PCT = 72

/** Real exam: 60 questions in 120 minutes → 2 minutes per question. */
export const EXAM_SECONDS_PER_QUESTION = 120
export const examSeconds = (count: number) => count * EXAM_SECONDS_PER_QUESTION

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
