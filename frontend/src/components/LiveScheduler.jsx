import React, { useState, useEffect, useRef, useMemo } from 'react'
import AlgorithmPanel from './AlgorithmPanel'

/*
  LiveScheduler
  =============
  This IS both the visualizer and the final timetable in one.

  How it works:
  - We receive the full `steps` array from the CSP solver backend
  - `currentStep` index is advanced by the playback timer
  - At each step we derive `liveAssignment` by replaying all steps 0..currentStep:
      · 'assign'    → add exam to grid cell
      · 'backtrack' → remove exam from grid cell
  - The last event's cell gets a CSS animation:
      · assign    → green scale-in bounce
      · backtrack → red flash + disappear
      · try       → amber pulsing outline on the target cell
  - This way the user literally SEES the timetable being built and un-built
*/

// ── Stable warm color palette for up to 12 exams ─────────────────────────────
const EXAM_PALETTE = [
  { bg:'#162640', border:'#4aa2ff', text:'#c7e3ff', dot:'#84beff' },
  { bg:'#113433', border:'#4ad6b4', text:'#b9f4e4', dot:'#72eccc' },
  { bg:'#32274a', border:'#ba94ff', text:'#e2d3ff', dot:'#d0b9ff' },
  { bg:'#3a2f1c', border:'#f5bf4e', text:'#f9e7b7', dot:'#ffd985' },
  { bg:'#3d1f39', border:'#ff8ec2', text:'#ffd1ea', dot:'#ffadd5' },
  { bg:'#1c3540', border:'#64d9ff', text:'#c4efff', dot:'#91e6ff' },
  { bg:'#401f2f', border:'#ff7a85', text:'#ffc3ca', dot:'#ffa5b0' },
  { bg:'#28361f', border:'#9ede6f', text:'#daf9c3', dot:'#b9ef91' },
]

// FIX: canonical weekday order for deterministic column layout.
const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function sortDays(days) {
  return days.slice().sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a)
    const bi = DAY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

// ── Derive live assignment state by replaying steps 0..upTo ───────────────────
function deriveLiveState(steps, upTo) {
  const assignment = {}   // course → { slot, room, day, period }
  let lastEvent = null

  for (let i = 0; i <= upTo && i < steps.length; i++) {
    const s = steps[i]
    if (s.kind === 'assign') {
      assignment[s.exam] = {
        slot:   s.value.slot,
        room:   s.value.room,
        day:    s.value.slot.split(' ')[0],
        period: s.value.slot.split(' ').slice(1).join(' '),
      }
      lastEvent = { kind: 'assign', exam: s.exam, ...s.value }
    } else if (s.kind === 'backtrack') {
      delete assignment[s.exam]
      lastEvent = { kind: 'backtrack', exam: s.exam, ...s.value }
    } else if (s.kind === 'try') {
      lastEvent = { kind: 'try', exam: s.exam, ...s.value }
    } else if (s.kind === 'prune') {
      lastEvent = { kind: 'prune', exam: s.exam }
    } else if (s.kind === 'solution') {
      lastEvent = { kind: 'solution' }
    }
  }
  return { assignment, lastEvent }
}

// ── Single timetable cell ─────────────────────────────────────────────────────
function Cell({ items, isTrying, tryExam, tryRoom, colorMap }) {
  if (isTrying && items.length === 0) {
    return (
      <td className="p-2 border border-border align-top min-w-[130px] h-20">
        <div className="cell-trying rounded-lg border-2 h-full flex items-center justify-center"
             style={{ borderColor: 'var(--try)' }}>
          <span className="text-xs font-mono text-try opacity-80">
            {tryExam?.length > 12 ? tryExam.slice(0,11)+'…' : tryExam}
            <br/>
            <span className="opacity-60">{tryRoom}</span>
          </span>
        </div>
      </td>
    )
  }

  return (
    <td className="p-2 border border-border align-top min-w-[130px] h-20">
      {items.map(({ course, room, animClass, color }) => (
        <div
          key={course}
          className={`rounded-lg border px-2.5 py-2 mb-1 last:mb-0 ${animClass}`}
          style={{ background: color.bg, borderColor: color.border }}
        >
          <div className="font-semibold text-xs leading-tight" style={{ color: color.text }}>
            {course}
          </div>
          <div className="text-[10px] font-mono mt-0.5 flex items-center gap-1" style={{ color: color.dot }}>
            <span>⬛</span>{room}
          </div>
        </div>
      ))}
    </td>
  )
}

// ── Playback controls bar ─────────────────────────────────────────────────────
function Controls({ currentStep, total, playing, speed, onToggle, onScrub, onSpeed, onFirst, onLast }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Scrubber */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted w-8 text-right">{currentStep + 1}</span>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={currentStep}
          onChange={e => { onScrub(Number(e.target.value)) }}
          className="flex-1 accent-accent h-1.5 rounded-full cursor-pointer" />
        <span className="text-xs font-mono text-muted w-8">{total}</span>
      </div>

      {/* Buttons row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {[
            { label:'⏮', fn: onFirst },
            { label:'‹',  fn: () => onScrub(Math.max(0, currentStep - 1)) },
            { label: playing ? '⏸' : '▶', fn: onToggle, accent: true },
            { label:'›',  fn: () => onScrub(Math.min(total - 1, currentStep + 1)) },
            { label:'⏭', fn: onLast },
          ].map(({ label, fn, accent }) => (
            <button key={label} onClick={fn}
              className={`w-9 h-9 rounded-lg text-sm font-mono transition-all active:scale-90 ${
                accent
                  ? 'bg-accent text-white hover:bg-accent/90 shadow-sm'
                  : 'bg-surface border border-border text-muted hover:border-accent/50 hover:text-accent'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted">Speed</span>
          <input type="range" min={50} max={1500} step={50} value={1550 - speed}
            onChange={e => onSpeed(1550 - Number(e.target.value))}
            className="w-20 accent-accent h-1.5 cursor-pointer" />
          <span className="text-xs font-mono text-muted w-12">
            {speed < 200 ? 'Fast' : speed < 600 ? 'Normal' : 'Slow'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Action banner ─────────────────────────────────────────────────────────────
const ACTION_CFG = {
  try:       { label:'Trying',     icon:'?', bg:'#2e2716', border:'#f5bf4e', text:'#f9e7b7' },
  assign:    { label:'Assigned',   icon:'✓', bg:'#122b28', border:'#34d399', text:'#b7f8de' },
  backtrack: { label:'Backtrack',  icon:'↺', bg:'#341b2b', border:'#ff7a85', text:'#ffc2ca' },
  prune:     { label:'Pruned',     icon:'✂', bg:'#202c44', border:'#8da4cf', text:'#c5d6f7' },
  solution:  { label:'Complete!',  icon:'★', bg:'#122b28', border:'#34d399', text:'#b7f8de' },
  fail:      { label:'No Solution',icon:'✗', bg:'#341b2b', border:'#ff7a85', text:'#ffc2ca' },
}

function ActionBanner({ step }) {
  if (!step) return null
  const cfg = ACTION_CFG[step.kind] || ACTION_CFG.try
  return (
    <div className="rounded-xl border px-4 py-3 flex items-center gap-3 transition-all duration-300"
         style={{ background: cfg.bg, borderColor: cfg.border }}>
      <span className="text-xl font-serif font-semibold" style={{ color: cfg.border }}>{cfg.icon}</span>
      <div>
        <div className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: cfg.border }}>
          {cfg.label}
        </div>
        <div className="text-sm mt-0.5" style={{ color: cfg.text }}>{step.detail}</div>
      </div>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ assignments, backtracks, prunes, stepNum, total }) {
  const items = [
    { label:'Exams placed', value: assignments, color:'#34d399' },
    { label:'Backtracks',   value: backtracks,  color:'#ff7a85' },
    { label:'FC prunes',    value: prunes,      color:'#8da4cf' },
  ]
  return (
    <div className="flex gap-4">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-lg font-serif font-semibold" style={{ color }}>{value}</span>
          <span className="text-xs text-muted font-mono">{label}</span>
        </div>
      ))}
      <div className="ml-auto text-xs font-mono text-muted self-center">
        Step {stepNum} / {total}
      </div>
    </div>
  )
}

function ComparisonPanel({ comparison }) {
  if (!comparison) return null

  const plain     = comparison.plain_backtracking || {}
  const optimized = comparison.optimized || {}
  const reduction = comparison.reduction_percent
  const ratio     = comparison.improvement_ratio

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-3">Performance Comparison</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-bg/70 px-3 py-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">Plain Backtracking</div>
          <div className="text-xl font-serif font-semibold text-text">{plain.operations ?? '—'}</div>
          <div className="text-xs font-mono text-muted">
            Status: {plain.status || 'unknown'}
            {plain.cutoff ? ' (cutoff)' : ''}
          </div>
        </div>
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Optimized Search</div>
          <div className="text-xl font-serif font-semibold text-success">{optimized.operations ?? '—'}</div>
          <div className="text-xs font-mono text-accent/80">Status: {optimized.status || 'unknown'}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono">
        <span className="text-muted">
          Reduction: <span className="text-success font-semibold">{reduction == null ? '—' : `${reduction}%`}</span>
        </span>
        <span className="text-muted">
          Speedup: <span className="text-success font-semibold">{ratio == null ? '—' : `${ratio}x`}</span>
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveScheduler({ steps, stats, examList, comparison }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [playing,     setPlaying]     = useState(false)
  const [speed,       setSpeed]       = useState(400)
  const timerRef = useRef(null)

  const total = steps.length

  // Kick off auto-play when new steps arrive
  useEffect(() => {
    setCurrentStep(0)
    setPlaying(true)
  }, [steps])

  // Auto-advance timer
  useEffect(() => {
    if (!playing) return
    timerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= total - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(timerRef.current)
  }, [playing, speed, total])

  // ── Derive state at current step ──────────────────────────────────────────
  const { assignment, lastEvent } = useMemo(
    () => deriveLiveState(steps, currentStep),
    [steps, currentStep]
  )

  const currentStepData = steps[currentStep]

  // ── Build grid dimensions from all steps ─────────────────────────────────
  const { days, periods, colorMap } = useMemo(() => {
    const daySet    = new Set()
    const periodSet = new Set()
    const dayOrder  = []
    const perOrder  = []

    // Walk all assign steps to collect all slots
    steps.forEach(s => {
      if (s.kind === 'assign' && s.value) {
        const [day, ...rest] = s.value.slot.split(' ')
        const period = rest.join(' ')
        if (!daySet.has(day))       { daySet.add(day);       dayOrder.push(day)    }
        if (!periodSet.has(period)) { periodSet.add(period); perOrder.push(period) }
      }
    })

    // FIX: sort days into canonical Mon→Tue→Wed… order instead of insertion order.
    const sortedDays = sortDays(dayOrder)

    // Build color map from examList
    const cm = {}
    ;(examList || []).forEach((e, i) => {
      cm[e.course] = EXAM_PALETTE[i % EXAM_PALETTE.length]
    })

    return { days: sortedDays, periods: perOrder, colorMap: cm }
  }, [steps, examList])

  // ── Build cellMap from current liveAssignment ─────────────────────────────
  const cellMap = useMemo(() => {
    const map = {}
    Object.entries(assignment).forEach(([course, v]) => {
      const key = `${v.day}||${v.period}`
      if (!map[key]) map[key] = []
      const isLastAssign = lastEvent?.kind === 'assign' && lastEvent.exam === course
      const animClass = isLastAssign ? 'cell-assign' : ''
      map[key].push({ course, room: v.room, animClass, color: colorMap[course] || EXAM_PALETTE[0] })
    })
    return map
  }, [assignment, lastEvent, colorMap])

  // ── Running stats ─────────────────────────────────────────────────────────
  const runStats = useMemo(() => {
    let assignments = 0, backtracks = 0, prunes = 0
    for (let i = 0; i <= currentStep && i < steps.length; i++) {
      const k = steps[i].kind
      if (k === 'assign')    assignments++
      if (k === 'backtrack') backtracks++
      if (k === 'prune')     prunes++
    }
    return { assignments, backtracks, prunes }
  }, [steps, currentStep])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!total) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-2xl">
        📅
      </div>
      <div>
        <p className="font-serif text-lg text-text font-semibold">No schedule yet</p>
        <p className="text-sm text-muted mt-1">
          Fill in your courses, rooms, and time slots on the left, then hit
          <span className="text-accent font-semibold"> ▶ Generate Timetable</span>.
        </p>
        <p className="text-sm text-muted mt-2">
          You'll watch the AI build your timetable cell by cell in real time.
        </p>
      </div>
    </div>
  )

  // ── Which cell is being "tried" right now ─────────────────────────────────
  const tryKey = (lastEvent?.kind === 'try' && lastEvent.slot)
    ? `${lastEvent.slot.split(' ')[0]}||${lastEvent.slot.split(' ').slice(1).join(' ')}`
    : null
  const tryExam = lastEvent?.kind === 'try' ? lastEvent.exam : null
  const tryRoom = lastEvent?.kind === 'try' ? lastEvent.room : null

  return (
    <div className="flex flex-col min-h-full gap-4">

      {/* ── What's happening right now ────────────────── */}
      <ActionBanner step={currentStepData} />

      {/* ── Algorithm pipeline — highlights active phase ─ */}
      <AlgorithmPanel currentStepKind={currentStepData?.kind} />

      {/* ── THE LIVE TIMETABLE GRID ───────────────────── */}
      <div className="min-h-[340px] max-h-[65vh] overflow-auto rounded-xl border border-border shadow-sm bg-surface">
        {days.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm font-mono animate-pulse">
            Waiting for first assignment…
          </div>
        ) : (
          <table className="min-w-[720px] w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface2/95 backdrop-blur">
                <th className="px-4 py-3 text-left text-xs font-mono text-muted uppercase tracking-widest border-b border-r border-border w-32">
                  Time
                </th>
                {days.map(day => (
                  <th key={day}
                    className="px-4 py-3 text-center text-xs font-serif font-semibold text-text border-b border-r border-border last:border-r-0">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period, pi) => (
                <tr key={period} className={pi % 2 === 0 ? 'bg-surface' : 'bg-bg'}>
                  <td className="px-4 py-3 text-xs font-mono text-muted border-r border-border border-b whitespace-nowrap align-middle">
                    {period}
                  </td>
                  {days.map(day => {
                    const key   = `${day}||${period}`
                    const items = cellMap[key] || []
                    const isTrying = tryKey === key && items.length === 0
                    return (
                      <Cell key={day}
                        items={items}
                        isTrying={isTrying}
                        tryExam={tryExam}
                        tryRoom={tryRoom}
                        colorMap={colorMap}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3">
        <StatsRow
          assignments={runStats.assignments}
          backtracks={runStats.backtracks}
          prunes={runStats.prunes}
          stepNum={currentStep + 1}
          total={total}
        />
      </div>

      {/* ── Plain vs optimized comparison ────────────── */}
      <ComparisonPanel comparison={comparison} />

      {/* ── Playback controls ─────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3">
        <Controls
          currentStep={currentStep}
          total={total}
          playing={playing}
          speed={speed}
          onToggle={() => setPlaying(p => !p)}
          onScrub={v => { setPlaying(false); setCurrentStep(v) }}
          onSpeed={setSpeed}
          onFirst={() => { setPlaying(false); setCurrentStep(0) }}
          onLast={() => { setPlaying(false); setCurrentStep(total - 1) }}
        />
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {[
          { color:'#2a6e4f', label:'Assigned' },
          { color:'#b83232', label:'Backtrack — undone' },
          { color:'#a07820', label:'Currently trying' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs font-mono text-muted">
            <span className="w-3 h-3 rounded-sm border-2 flex-shrink-0" style={{ borderColor: color, background: color+'22' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}