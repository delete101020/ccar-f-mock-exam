import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Lightbulb,
  LayoutGrid,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../App'
import Explanation from '../components/Explanation'
import RichText from '../components/RichText'
import { LETTERS, QUESTION_MAP, type Letter, type Question } from '../data'
import {
  findFinished,
  finishSession,
  formatDuration,
  recordAnswers,
  saveSession,
  useFlags,
  useSessions,
  type Session,
} from '../store'

type Props = { slot: string; reviewId?: undefined; initialIndex?: undefined } | { slot?: undefined; reviewId: string; initialIndex: number }

export default function Quiz(props: Props) {
  const [sessions] = useSessions()
  const initial = useMemo(
    () => (props.reviewId ? findFinished(props.reviewId) : sessions[props.slot!]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  if (!initial) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-600">Không tìm thấy phiên ôn tập này.</p>
        <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white" onClick={() => navigate({ name: 'home' })}>
          Về trang chủ
        </button>
      </div>
    )
  }
  return <QuizView initial={initial} review={!!props.reviewId} initialIndex={props.initialIndex} />
}

function QuizView({ initial, review, initialIndex }: { initial: Session; review: boolean; initialIndex?: number }) {
  const [session, setSession] = useState<Session>(() =>
    review ? { ...initial, current: Math.min(initialIndex ?? 0, initial.questionIds.length - 1) } : initial,
  )
  const [flags, setFlags] = useFlags()
  const [mapOpen, setMapOpen] = useState(() => window.innerWidth >= 768)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [, tick] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)
  const activeSince = useRef(Date.now())
  const finished = useRef(false)

  const total = session.questionIds.length
  const qid = session.questionIds[session.current]
  const question = QUESTION_MAP.get(qid)!
  const order = session.optionOrder[qid] ?? LETTERS
  const selected = session.answers[qid]
  const practice = session.mode === 'practice'
  const revealed = review || (practice && !!session.checked[qid])
  const flagged = flags.includes(qid)
  const answeredCount = Object.keys(session.answers).length

  const update = (patch: Partial<Session> | ((s: Session) => Partial<Session>)) =>
    setSession((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

  // Persist on every change (not in review mode).
  const latest = useRef(session)
  latest.current = session
  useEffect(() => {
    if (!review && !finished.current) saveSession(session)
  }, [session, review])

  // Timer: accumulate active seconds.
  useEffect(() => {
    if (review) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    const takeDelta = () => {
      const now = Date.now()
      const delta = (now - activeSince.current) / 1000
      activeSince.current = now
      return delta
    }
    const flush = () => {
      if (finished.current) return
      const delta = takeDelta()
      setSession((s) => ({ ...s, elapsed: s.elapsed + delta }))
    }
    const onVis = () => (document.hidden ? flush() : (activeSince.current = Date.now()))
    document.addEventListener('visibilitychange', onVis)
    const saver = setInterval(flush, 15000)
    return () => {
      clearInterval(id)
      clearInterval(saver)
      document.removeEventListener('visibilitychange', onVis)
      // Unmounting: state updates won't land, so save directly.
      if (!finished.current) saveSession({ ...latest.current, elapsed: latest.current.elapsed + takeDelta() })
    }
  }, [review])
  const elapsed = session.elapsed + (review || document.hidden ? 0 : (Date.now() - activeSince.current) / 1000)
  // Exam mode counts down against a wall-clock deadline, like the real exam.
  const deadline = !review && !practice ? session.deadline : undefined
  const remaining = deadline ? Math.max(0, (deadline - Date.now()) / 1000) : undefined
  const lowTime = remaining !== undefined && remaining < 300

  const goTo = (i: number) => {
    if (i < 0 || i >= total) return
    update({ current: i })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const choose = (l: Letter) => {
    if (revealed) return
    update((s) => ({ answers: { ...s.answers, [qid]: l } }))
  }

  const check = () => {
    if (!selected || revealed) return
    recordAnswers([{ id: qid, correct: selected === question.correct }])
    update((s) => ({ checked: { ...s.checked, [qid]: true } }))
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const toggleFlag = () => setFlags((f) => (f.includes(qid) ? f.filter((x) => x !== qid) : [...f, qid]))

  const submit = (timedOut = false) => {
    if (finished.current) return
    finished.current = true
    const now = Date.now()
    const elapsed = deadline ? (Math.min(now, deadline) - session.startedAt) / 1000 : session.elapsed + (now - activeSince.current) / 1000
    const done = finishSession({ ...session, elapsed, timedOut })
    activeSince.current = now
    navigate({ name: 'result', id: done.id })
  }

  // Time's up: auto-submit.
  useEffect(() => {
    if (remaining === 0) submit(true)
  })

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey || confirmSubmit) return
      const k = e.key.toLowerCase()
      const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : ['a', 'b', 'c', 'd'].indexOf(k)
      if (idx >= 0 && idx < order.length) choose(order[idx])
      else if (k === 'enter') {
        if (practice && !revealed && selected) check()
        else goTo(session.current + 1)
      } else if (k === 'arrowright') goTo(session.current + 1)
      else if (k === 'arrowleft') goTo(session.current - 1)
      else if (k === 'f') toggleFlag()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isLast = session.current === total - 1

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(review ? { name: 'result', id: session.id } : { name: 'home' })}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60"
        >
          <ArrowLeft className="size-4" /> {review ? 'Kết quả' : 'Trang chủ'}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
          {session.title}
          <span
            className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${
              review ? 'bg-slate-200 text-slate-700' : practice ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'
            }`}
          >
            {review ? 'Xem lại' : practice ? 'Luyện tập' : 'Thi thử'}
          </span>
        </h1>
        {!review && (
          <>
            {remaining !== undefined ? (
              <span
                title="Thời gian còn lại"
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
                  lowTime ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-violet-50 text-violet-800'
                }`}
              >
                <Timer className="size-4" /> {formatDuration(remaining)}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-slate-600">
                <Clock className="size-4" /> {formatDuration(elapsed)}
              </span>
            )}
            <button
              onClick={() => setConfirmSubmit(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {practice ? 'Kết thúc' : 'Nộp bài'}
            </button>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        <Lightbulb className="size-4 shrink-0" />
        {review
          ? 'Đang xem lại bài đã làm. Đáp án và giải thích hiển thị cho mọi câu.'
          : practice
            ? 'Chọn đáp án, sau đó kiểm tra ngay. Câu trả lời được lưu khi bạn làm bài.'
            : deadline
              ? `Thi có giới hạn ${Math.round((deadline - session.startedAt) / 60000)} phút, đồng hồ vẫn chạy khi bạn rời trang. Hết giờ bài sẽ tự nộp. Kết quả hiển thị sau khi nộp.`
              : 'Chọn đáp án cho từng câu, có thể đổi đáp án trước khi nộp. Kết quả hiển thị sau khi nộp bài.'}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Question map */}
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white md:sticky md:top-4 md:w-64 md:shrink-0">
          <button
            onClick={() => setMapOpen((o) => !o)}
            className="flex w-full items-center gap-2 bg-blue-900 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white"
          >
            <LayoutGrid className="size-4" />
            <span className="flex-1 text-left">Bản đồ câu hỏi</span>
            <span className="font-semibold normal-case">
              {session.current + 1}/{total}
            </span>
            <ChevronDown className={`size-4 transition-transform ${mapOpen ? 'rotate-180' : ''}`} />
          </button>
          {mapOpen && (
            <div className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">Tiến độ</span>
                <span className="text-lg font-bold text-blue-900">
                  {answeredCount}/{total}
                </span>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
              </div>
              <div className="thin-scroll grid max-h-[22rem] grid-cols-5 gap-1.5 overflow-y-auto pr-1">
                {session.questionIds.map((id, i) => (
                  <MapCell
                    key={id}
                    n={i + 1}
                    current={i === session.current}
                    flagged={flags.includes(id)}
                    status={cellStatus(session, id, review)}
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-600">
                <Legend className="border-blue-600 bg-blue-600" label="Hiện tại" />
                <Legend className="border-blue-300 bg-blue-50" label="Đã trả lời" />
                <Legend className="border-emerald-400 bg-emerald-50" label="Đúng" />
                <Legend className="border-rose-400 bg-rose-50" label="Sai" />
                <Legend className="border-amber-400 bg-amber-50" label="Đánh dấu" />
                <Legend className="border-slate-300 bg-white" label="Chưa làm" />
              </div>
            </div>
          )}
        </aside>

        {/* Question card */}
        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  Câu {session.current + 1} / {total}
                  <span className="ml-2 font-normal text-slate-400">· P{question.part}.{question.index}</span>
                </p>
                <p className="mt-1 truncate text-xs font-medium text-blue-700" title={question.subdomain}>
                  {question.domain}
                  <span className="font-normal text-slate-400"> · {question.domainShort}</span>
                </p>
              </div>
              <button
                onClick={toggleFlag}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  flagged ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className={`size-3.5 ${flagged ? 'fill-amber-400 text-amber-500' : ''}`} />
                {flagged ? 'Đã đánh dấu' : 'Đánh dấu câu hỏi'}
              </button>
            </div>

            <p className="whitespace-pre-line text-[17px] leading-relaxed font-medium text-slate-900">
              <RichText text={question.question} />
            </p>

            <div className="mt-6 space-y-3">
              {order.map((orig, i) => (
                <OptionRow
                  key={orig}
                  label={LETTERS[i]}
                  text={question.options[orig]}
                  selected={selected === orig}
                  revealed={revealed}
                  isCorrect={orig === question.correct}
                  disabled={revealed}
                  onClick={() => choose(orig)}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {practice && !review && !revealed && (
                <button
                  onClick={check}
                  disabled={!selected}
                  className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {selected ? 'Kiểm tra' : 'Chọn 1 đáp án'} <ArrowRight className="size-4" />
                </button>
              )}
              <a
                href={askAiUrl(question, order, selected, revealed)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/50 py-1.5 pr-3 pl-1.5 text-sm font-bold text-blue-900 hover:bg-blue-50"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white">
                  <Sparkles className="size-4" />
                </span>
                Ask AI
                <ExternalLink className="size-3.5 text-blue-400" />
              </a>
              <span className="ml-auto hidden text-xs text-blue-700/80 sm:inline">
                {practice || review ? 'Kết quả của bạn hiển thị ngay lập tức.' : 'Phím tắt: 1–4 chọn · ←/→ chuyển câu · F đánh dấu'}
              </span>
            </div>

            {revealed && (
              <div ref={resultRef} className="mt-6 scroll-mt-4 space-y-3">
                <ResultBanner question={question} order={order} selected={selected} />
                <Explanation question={question} order={order} />
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => goTo(session.current - 1)}
              disabled={session.current === 0}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Trước
            </button>
            <span className="text-sm font-semibold text-slate-600">
              {session.current + 1} / {total}
            </span>
            {isLast && !review ? (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="rounded-lg bg-violet-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
              >
                {practice ? 'Kết thúc' : 'Nộp bài'}
              </button>
            ) : (
              <button
                onClick={() => goTo(session.current + 1)}
                disabled={isLast}
                className="rounded-lg bg-violet-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Sau
              </button>
            )}
          </div>
        </main>
      </div>

      {confirmSubmit && (
        <ConfirmDialog
          title={practice ? 'Kết thúc phiên luyện tập?' : 'Nộp bài?'}
          body={
            (total - answeredCount > 0
              ? `Bạn còn ${total - answeredCount} câu chưa trả lời. Các câu này sẽ được tính là bỏ qua.`
              : 'Bạn đã trả lời tất cả các câu.') +
            (remaining !== undefined ? ` Thời gian còn lại: ${formatDuration(remaining)}.` : '')
          }
          confirmLabel={practice ? 'Kết thúc & xem tổng kết' : 'Nộp bài'}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={() => submit()}
        />
      )}
    </div>
  )
}

type CellStatus = 'unanswered' | 'answered' | 'correct' | 'wrong'

function cellStatus(s: Session, id: string, review: boolean): CellStatus {
  const a = s.answers[id]
  if (!a) return 'unanswered'
  if (review || (s.mode === 'practice' && s.checked[id])) return a === QUESTION_MAP.get(id)?.correct ? 'correct' : 'wrong'
  return 'answered'
}

function MapCell({ n, current, flagged, status, onClick }: { n: number; current: boolean; flagged: boolean; status: CellStatus; onClick: () => void }) {
  const tone = current
    ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/30'
    : status === 'correct'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
      : status === 'wrong'
        ? 'border-rose-400 bg-rose-50 text-rose-700'
        : status === 'answered'
          ? 'border-blue-300 bg-blue-50 text-blue-800'
          : flagged
            ? 'border-amber-400 bg-amber-50 text-amber-800'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
  return (
    <button onClick={onClick} className={`relative aspect-square rounded-lg border text-xs font-semibold transition ${tone}`}>
      {n}
      {flagged && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-white" />}
    </button>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2.5 shrink-0 rounded-sm border ${className}`} />
      {label}
    </span>
  )
}

function OptionRow(p: { label: string; text: string; selected: boolean; revealed: boolean; isCorrect: boolean; disabled: boolean; onClick: () => void }) {
  let tone = 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
  let icon = null
  if (p.revealed && p.isCorrect) {
    tone = 'border-emerald-400 bg-emerald-50'
    icon = <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
  } else if (p.revealed && p.selected) {
    tone = 'border-rose-400 bg-rose-50'
    icon = <XCircle className="size-5 shrink-0 text-rose-500" />
  } else if (p.selected) tone = 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
  else if (p.revealed) tone = 'border-slate-200 opacity-70'

  return (
    <button
      onClick={p.onClick}
      disabled={p.disabled}
      className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition disabled:cursor-default ${tone}`}
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
          p.selected ? 'border-blue-600' : 'border-slate-400'
        } ${p.revealed && p.isCorrect ? 'border-emerald-600' : ''} ${p.revealed && p.selected && !p.isCorrect ? 'border-rose-500' : ''}`}
      >
        {p.selected && (
          <span className={`size-2.5 rounded-full ${p.revealed ? (p.isCorrect ? 'bg-emerald-600' : 'bg-rose-500') : 'bg-blue-600'}`} />
        )}
      </span>
      <span className="text-sm font-bold text-slate-400">{p.label}</span>
      <span className="flex-1 text-sm leading-relaxed text-slate-700">
        <RichText text={p.text} />
      </span>
      {icon}
    </button>
  )
}

function ResultBanner({ question, order, selected }: { question: Question; order: Letter[]; selected?: Letter }) {
  const correctLabel = LETTERS[order.indexOf(question.correct)]
  if (!selected)
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
        Bạn đã bỏ qua câu này. Đáp án đúng: <span className="text-emerald-700">{correctLabel}</span>
      </div>
    )
  const ok = selected === question.correct
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      {ok ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
      {ok ? 'Chính xác!' : `Chưa đúng — bạn chọn ${LETTERS[order.indexOf(selected)]}, đáp án đúng là ${correctLabel}.`}
    </div>
  )
}

function ConfirmDialog(p: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={p.onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900">{p.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{p.body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={p.onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Tiếp tục làm
          </button>
          <button onClick={p.onConfirm} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">
            {p.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function askAiUrl(q: Question, order: Letter[], selected: Letter | undefined, revealed: boolean) {
  const opts = order.map((orig, i) => `${LETTERS[i]}. ${q.options[orig]}`).join('\n')
  const lines = [
    'Mình đang ôn thi Claude Certified Architect – Foundations (CCA-F). Hãy giải thích câu hỏi sau bằng tiếng Việt, phân tích từng phương án:',
    '',
    q.question,
    '',
    opts,
  ]
  if (selected) lines.push('', `Mình đã chọn: ${LETTERS[order.indexOf(selected)]}.`)
  if (revealed) lines.push(`Đáp án đúng: ${LETTERS[order.indexOf(q.correct)]}.`)
  return `https://claude.ai/new?q=${encodeURIComponent(lines.join('\n'))}`
}
