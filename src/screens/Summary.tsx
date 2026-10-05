import { ArrowLeft, CheckCircle2, Clock, Eye, MinusCircle, RotateCcw, Trophy, XCircle } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { navigate } from '../App'
import { EXAM_DOMAINS, QUESTION_MAP } from '../data'
import { createSession, discardSession, findFinished, formatDuration, PASS_PCT, scoreOf, sourceIds, type Mode, type Session } from '../store'

type Filter = 'all' | 'correct' | 'wrong' | 'skipped'

export default function Summary({ id }: { id: string }) {
  const session = useMemo(() => findFinished(id), [id])
  const [filter, setFilter] = useState<Filter>('all')
  const [showAllCategories, setShowAllCategories] = useState(false)

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-600">Không tìm thấy kết quả này.</p>
        <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white" onClick={() => navigate({ name: 'home' })}>
          Về trang chủ
        </button>
      </div>
    )
  }

  const sc = scoreOf(session)
  const pass = sc.pct >= PASS_PCT
  const statusOf = (qid: string): Exclude<Filter, 'all'> => {
    const a = session.answers[qid]
    return !a ? 'skipped' : a === QUESTION_MAP.get(qid)?.correct ? 'correct' : 'wrong'
  }
  const rows = session.questionIds.map((qid, i) => ({ qid, i, q: QUESTION_MAP.get(qid)!, status: statusOf(qid) }))
  const visible = rows.filter((r) => filter === 'all' || r.status === filter)
  const missed = rows.filter((r) => r.status !== 'correct').map((r) => r.qid)

  // Official exam domains: every question counts (skipped = not correct), like the real exam.
  const byDomain = EXAM_DOMAINS.map((d) => {
    const inDomain = rows.filter((r) => r.q.examDomain === d.key)
    return { ...d, total: inDomain.length, correct: inDomain.filter((r) => r.status === 'correct').length }
  }).filter((d) => d.total > 0)

  const byCategory = Object.values(
    rows
      .filter((r) => r.status !== 'skipped')
      .reduce<Record<string, { name: string; total: number; correct: number }>>((acc, r) => {
        const c = (acc[r.q.category] ??= { name: r.q.category, total: 0, correct: 0 })
        c.total++
        if (r.status === 'correct') c.correct++
        return acc
      }, {}),
  ).sort((a, b) => b.total - a.total)
  const shownCategories = showAllCategories ? byCategory : byCategory.slice(0, 8)

  const retry = (ids: string[], title: string, slot: string, mode: Mode) => {
    discardSession(slot)
    createSession({ slot, title, mode, ids })
    navigate({ name: 'quiz', slot })
  }
  const isReal = session.slot === 'real-exam'

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'home' })}
        className="mb-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60"
      >
        <ArrowLeft className="size-4" /> Trang chủ
      </button>

      {/* Score */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <ScoreRing pct={sc.pct} pass={pass} />
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-semibold text-slate-500">
              {session.title} · {session.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}
            </p>
            <h1 className="mt-1 flex items-center justify-center gap-2 text-2xl font-extrabold text-slate-900 md:justify-start">
              {pass && <Trophy className="size-6 text-amber-500" />}
              {pass ? 'Đạt! Làm tốt lắm' : 'Chưa đạt — ôn thêm nhé'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ngưỡng tham khảo {PASS_PCT}% · Hoàn thành {new Date(session.finishedAt ?? session.startedAt).toLocaleString('vi-VN')}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={<CheckCircle2 className="size-4 text-emerald-600" />} label="Đúng" value={sc.correct} />
              <Metric icon={<XCircle className="size-4 text-rose-500" />} label="Sai" value={sc.wrong} />
              <Metric icon={<MinusCircle className="size-4 text-slate-400" />} label="Bỏ qua" value={sc.skipped} />
              <Metric
                icon={<Clock className="size-4 text-blue-600" />}
                label={session.timedOut ? 'Hết giờ' : 'Thời gian'}
                value={formatDuration(session.elapsed)}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-slate-100 pt-6 md:justify-start">
          <button
            onClick={() => navigate({ name: 'review', id: session.id, q: 0 })}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
          >
            <Eye className="size-4" /> Xem lại bài làm
          </button>
          {missed.length > 0 && (
            <button
              onClick={() => retry(missed, `Làm lại câu sai · ${session.title}`, 'retry-practice', 'practice')}
              className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
            >
              <RotateCcw className="size-4" /> Làm lại {missed.length} câu sai / bỏ qua
            </button>
          )}
          <button
            onClick={() => retry(isReal ? sourceIds('real') : session.questionIds, session.title, session.slot, session.mode)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isReal ? 'Thi đề mới' : 'Làm lại cả đề'}
          </button>
        </div>
      </section>

      {/* Official domain breakdown */}
      {byDomain.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 font-bold text-slate-900">
            Kết quả theo domain thi <span className="text-xs font-medium text-slate-400">(tỷ lệ trong đề thật)</span>
          </h2>
          <div className="space-y-3">
            {byDomain.map((d) => {
              const pct = Math.round((d.correct / d.total) * 100)
              const ok = pct >= PASS_PCT
              return (
                <div key={d.key}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-700">
                      {d.name} <span className="text-xs text-slate-400">· {d.weight}%</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {d.correct}/{d.total} · <span className={ok ? 'text-emerald-700' : 'text-rose-600'}>{pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Category breakdown */}
      {byCategory.length > 0 && (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 font-bold text-slate-900">
          Chi tiết theo chủ đề <span className="text-xs font-medium text-slate-400">(câu đã trả lời)</span>
        </h2>
        <div className="space-y-3">
          {shownCategories.map((c) => {
            const pct = Math.round((c.correct / c.total) * 100)
            return (
              <div key={c.name}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-700">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {c.correct}/{c.total} · <span className={pct >= PASS_PCT ? 'text-emerald-700' : 'text-rose-600'}>{pct}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${pct >= PASS_PCT ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        {byCategory.length > 8 && (
          <button
            onClick={() => setShowAllCategories((v) => !v)}
            className="mt-4 text-sm font-semibold text-blue-700 hover:underline"
          >
            {showAllCategories ? 'Thu gọn' : `Xem thêm ${byCategory.length - 8} chủ đề`}
          </button>
        )}
      </section>
      )}

      {/* Question list */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">Chi tiết từng câu</h2>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            {(
              [
                ['all', `Tất cả (${sc.total})`],
                ['correct', `Đúng (${sc.correct})`],
                ['wrong', `Sai (${sc.wrong})`],
                ['skipped', `Bỏ qua (${sc.skipped})`],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {visible.map((r) => (
            <li key={r.qid}>
              <button
                onClick={() => navigate({ name: 'review', id: session.id, q: r.i })}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <StatusIcon status={r.status} />
                <span className="w-8 shrink-0 text-sm font-bold text-slate-400">{r.i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-slate-700">{r.q.question.split('\n')[0]}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{r.q.domainShort}</span>
                </span>
                <AnswerTag session={session} qid={r.qid} />
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Không có câu nào.</li>}
        </ul>
      </section>
    </div>
  )
}

function ScoreRing({ pct, pass }: { pct: number; pass: boolean }) {
  const r = 54
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-slate-100" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={`transition-all duration-700 ${pass ? 'stroke-emerald-500' : 'stroke-rose-500'}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-extrabold text-slate-900">{pct}%</div>
          <div className={`text-xs font-bold uppercase ${pass ? 'text-emerald-600' : 'text-rose-500'}`}>{pass ? 'Đạt' : 'Chưa đạt'}</div>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-xl font-extrabold text-slate-900 tabular-nums">{value}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: 'correct' | 'wrong' | 'skipped' }) {
  if (status === 'correct') return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
  if (status === 'wrong') return <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" />
  return <MinusCircle className="mt-0.5 size-5 shrink-0 text-slate-300" />
}

function AnswerTag({ session, qid }: { session: Session; qid: string }) {
  const q = QUESTION_MAP.get(qid)!
  const order = session.optionOrder[qid]
  const label = (l: string) => 'ABCD'[order.indexOf(l as never)]
  const a = session.answers[qid]
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums">
      {a && a !== q.correct && <span className="mr-1 text-rose-500 line-through">{label(a)}</span>}
      <span className="text-emerald-600">{label(q.correct)}</span>
    </span>
  )
}
