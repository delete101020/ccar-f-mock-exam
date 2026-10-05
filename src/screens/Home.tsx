import { Bookmark, BookOpen, Dices, GraduationCap, History, Layers, RotateCcw, Target, Timer, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { navigate } from '../App'
import { EXAM_DOMAINS, EXAM_QUESTION_COUNT, PARTS, QUESTIONS } from '../data'
import {
  createSession,
  discardSession,
  examQuota,
  examSeconds,
  formatDuration,
  PASS_PCT,
  resetAllProgress,
  scoreOf,
  sourceIds,
  useFlags,
  useHistory,
  useSessions,
  useSettings,
  useStats,
  type Mode,
  type Session,
  type SourceKind,
} from '../store'

interface Source {
  key: string
  kind: SourceKind
  part?: number
  title: string
  subtitle: string
  icon: ReactNode
  count: number
}

export default function Home() {
  const [settings, setSettings] = useSettings()
  const [sessions] = useSessions()
  const [history] = useHistory()
  const [stats] = useStats()
  const [flags] = useFlags()
  const [mode, setMode] = useState<Mode>('practice')
  const [confirmReset, setConfirmReset] = useState(false)

  const attempted = QUESTIONS.filter((q) => stats[q.id]).length
  const masteredCount = QUESTIONS.filter((q) => stats[q.id]?.lastCorrect).length
  const wrongCount = QUESTIONS.filter((q) => stats[q.id] && !stats[q.id].lastCorrect).length
  const totalAttempts = Object.values(stats).reduce((n, s) => n + s.attempts, 0)
  const totalCorrect = Object.values(stats).reduce((n, s) => n + s.correct, 0)

  const parts: Source[] = PARTS.map((p) => ({
    key: `p${p.part}`,
    kind: 'part',
    part: p.part,
    title: `Đề ${p.part}`,
    subtitle: `Bộ câu hỏi P${p.part}`,
    icon: <BookOpen className="size-5" />,
    count: p.ids.length,
  }))
  const extras: Source[] = [
    { key: 'all', kind: 'all', title: 'Toàn bộ câu hỏi', subtitle: 'Tất cả các đề', icon: <Layers className="size-5" />, count: QUESTIONS.length },
    {
      key: 'random',
      kind: 'random',
      title: `Ngẫu nhiên ${settings.randomCount} câu`,
      subtitle: 'Trộn từ mọi đề',
      icon: <Dices className="size-5" />,
      count: Math.min(settings.randomCount, QUESTIONS.length),
    },
    { key: 'wrong', kind: 'wrong', title: 'Câu làm sai', subtitle: 'Lần gần nhất trả lời sai', icon: <XCircle className="size-5" />, count: wrongCount },
    { key: 'flagged', kind: 'flagged', title: 'Câu đã đánh dấu', subtitle: 'Bookmark của bạn', icon: <Bookmark className="size-5" />, count: flags.length },
  ]

  const start = (src: Source) => {
    const slot = `${src.key}-${mode}`
    if (!sessions[slot]) {
      const ids = sourceIds(src.kind, src.part)
      if (!ids.length) return
      createSession({ slot, title: src.title, mode, ids })
    }
    navigate({ name: 'quiz', slot })
  }

  const partProgress = (ids: string[]) => ({
    done: ids.filter((id) => stats[id]).length,
    correct: ids.filter((id) => stats[id]?.lastCorrect).length,
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-violet-800 p-6 text-white md:p-10">
        <div className="absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-2 text-sm font-semibold text-blue-100">
          <GraduationCap className="size-5" /> Claude Certified Architect – Foundations
        </div>
        <h1 className="relative mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">CCA-F Mock Exam</h1>
        <p className="relative mt-2 max-w-xl text-sm text-blue-100">
          Ôn tập {QUESTIONS.length} câu hỏi tình huống kèm giải thích chi tiết. Tiến độ được lưu tự động trên trình duyệt.
        </p>
        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Đã làm" value={`${attempted}/${QUESTIONS.length}`} />
          <Stat label="Đã nắm (đúng gần nhất)" value={String(masteredCount)} />
          <Stat label="Tỉ lệ đúng" value={totalAttempts ? `${Math.round((totalCorrect / totalAttempts) * 100)}%` : '—'} />
          <Stat label="Cần ôn lại" value={String(wrongCount)} />
        </div>
      </header>

      {/* Mode & settings */}
      <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ['practice', 'Luyện tập', 'Không giới hạn giờ · xem đáp án ngay'],
              ['exam', 'Thi thử', 'Bấm giờ 2 phút/câu · nộp mới biết kết quả'],
            ] as const
          ).map(([m, label, hint]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-left transition ${mode === m ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-[11px] text-slate-500">{hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Toggle
            label="Trộn câu hỏi"
            checked={settings.shuffleQuestions}
            onChange={(v) => setSettings((s) => ({ ...s, shuffleQuestions: v }))}
          />
          <Toggle
            label="Trộn đáp án"
            checked={settings.shuffleOptions}
            onChange={(v) => setSettings((s) => ({ ...s, shuffleOptions: v }))}
          />
          <label className="flex items-center gap-2 font-medium text-slate-700">
            Số câu ngẫu nhiên
            <select
              value={settings.randomCount}
              onChange={(e) => setSettings((s) => ({ ...s, randomCount: Number(e.target.value) }))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {[10, 20, 30, 60, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <RealExamCard session={sessions['real-exam']} />

      {/* Parts */}
      <h2 className="mt-8 mb-3 text-lg font-bold text-slate-900">Đề ôn tập</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((src) => {
          const prog = partProgress(PARTS.find((p) => p.part === src.part)!.ids)
          return <SourceCard key={src.key} src={src} mode={mode} session={sessions[`${src.key}-${mode}`]} progress={prog} onStart={() => start(src)} />
        })}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold text-slate-900">Ôn tập theo nhóm</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {extras.map((src) => (
          <SourceCard key={src.key} src={src} mode={mode} session={sessions[`${src.key}-${mode}`]} onStart={() => start(src)} compact />
        ))}
      </div>

      {/* History */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <History className="size-5 text-slate-400" /> Lịch sử làm bài
        </h2>
        <button
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="size-3.5" /> Xoá toàn bộ tiến độ
        </button>
      </div>
      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Chưa có bài nào hoàn thành. Chọn một đề ở trên để bắt đầu.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {history.map((h) => {
            const sc = scoreOf(h)
            const pass = sc.pct >= PASS_PCT
            return (
              <button
                key={h.id}
                onClick={() => navigate({ name: 'result', id: h.id })}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${
                    pass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {sc.pct}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">
                    {h.title} <span className="font-medium text-slate-400">· {h.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</span>
                  </span>
                  <span className="block text-xs text-slate-500">
                    {sc.correct}/{sc.total} đúng · {formatDuration(h.elapsed)} · {new Date(h.finishedAt ?? h.startedAt).toLocaleString('vi-VN')}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setConfirmReset(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Xoá toàn bộ tiến độ?</h2>
            <p className="mt-2 text-sm text-slate-600">Lịch sử, thống kê, câu đánh dấu và các phiên đang làm sẽ bị xoá. Không thể hoàn tác.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmReset(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Huỷ
              </button>
              <button
                onClick={() => {
                  resetAllProgress()
                  setConfirmReset(false)
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-blue-100">{label}</div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
      {label}
    </label>
  )
}

const REAL_EXAM_MINUTES = examSeconds(EXAM_QUESTION_COUNT) / 60

function RealExamCard({ session }: { session?: Session }) {
  const quota = examQuota()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!session?.deadline) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [session?.deadline])
  const remaining = session?.deadline ? Math.max(0, (session.deadline - Date.now()) / 1000) : 0
  const start = () => {
    if (!session) createSession({ slot: 'real-exam', title: `Thi thật · ${EXAM_QUESTION_COUNT} câu`, mode: 'exam', ids: sourceIds('real') })
    navigate({ name: 'quiz', slot: 'real-exam' })
  }
  return (
    <section className="mt-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-700">
            <Timer className="size-4" /> Mô phỏng đề thi thật
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">
            {EXAM_QUESTION_COUNT} câu · {REAL_EXAM_MINUTES} phút · ngưỡng {PASS_PCT}%
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Câu hỏi bốc ngẫu nhiên từ mọi đề theo tỷ lệ domain của Claude. Đồng hồ vẫn chạy khi rời trang, hết giờ tự nộp bài.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAM_DOMAINS.map((d) => (
              <span key={d.key} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                {d.name} <span className="font-bold text-violet-700">{quota[d.key]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={start}
            className="flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800"
          >
            <Target className="size-4" />
            {session ? `Tiếp tục · còn ${formatDuration(remaining)}` : 'Bắt đầu thi'}
          </button>
          {session && (
            <button
              onClick={() => discardSession(session.slot)}
              title="Bỏ bài thi đang làm"
              className="rounded-lg border border-slate-200 bg-white p-3 text-slate-500 hover:text-rose-600"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function SourceCard({
  src,
  mode,
  session,
  progress,
  onStart,
  compact,
}: {
  src: Source
  mode: Mode
  session?: { questionIds: string[]; answers: Record<string, unknown>; slot: string }
  progress?: { done: number; correct: number }
  onStart: () => void
  compact?: boolean
}) {
  const empty = src.count === 0 && !session
  const answered = session ? Object.keys(session.answers).length : 0
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition ${empty ? 'opacity-60' : 'hover:shadow-md'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{src.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900">{src.title}</h3>
          <p className="text-xs text-slate-500">
            {src.subtitle} · {src.count} câu
            {mode === 'exam' && src.count > 0 && ` · ${Math.round(examSeconds(src.count) / 60)} phút`}
          </p>
        </div>
      </div>

      {progress && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Đã làm {progress.done}/{src.count}</span>
            <span className="font-semibold text-emerald-700">{progress.correct} đúng</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-emerald-500" style={{ width: `${(progress.correct / src.count) * 100}%` }} />
            <div className="bg-rose-400" style={{ width: `${((progress.done - progress.correct) / src.count) * 100}%` }} />
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2 ${compact ? 'mt-4' : 'mt-5'}`}>
        <button
          onClick={onStart}
          disabled={empty}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
            mode === 'practice' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-violet-700 hover:bg-violet-800'
          }`}
        >
          <Target className="size-4" />
          {session ? `Tiếp tục (${answered}/${session.questionIds.length})` : mode === 'practice' ? 'Luyện tập' : 'Thi thử'}
        </button>
        {session && (
          <button
            onClick={() => discardSession(session.slot)}
            title="Bỏ phiên đang làm"
            className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
