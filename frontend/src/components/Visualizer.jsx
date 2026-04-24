import React, { useState, useEffect, useRef, useCallback } from 'react'
import AlgorithmPanel from './AlgorithmPanel'

// ── Step color/icon config ────────────────────────────────────────────────────
const KIND_CONFIG = {
  try      : { color: '#ffd600', bg: 'rgba(255,214,0,0.08)',   icon: '⟳', label: 'TRYING'    },
  assign   : { color: '#00ff87', bg: 'rgba(0,255,135,0.08)',   icon: '✓', label: 'ASSIGNED'  },
  prune    : { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', icon: '✂', label: 'PRUNED'    },
  backtrack: { color: '#ff4f5e', bg: 'rgba(255,79,94,0.1)',    icon: '↺', label: 'BACKTRACK' },
  solution : { color: '#00ff87', bg: 'rgba(0,255,135,0.12)',   icon: '★', label: 'SOLUTION'  },
  fail     : { color: '#ff4f5e', bg: 'rgba(255,79,94,0.12)',   icon: '✗', label: 'FAILED'    },
}

// ── Domain bar for one exam ───────────────────────────────────────────────────
const DomainBar = ({ course, size, maxSize, isActive }) => {
  const pct = maxSize > 0 ? (size / maxSize) * 100 : 0
  const color = size === 0 ? '#ff4f5e' : isActive ? '#00e5ff' : '#00ff87'

  return (
    <div className="flex items-center gap-2 text-xs font-mono mb-1">
      <span className="w-28 truncate text-right text-muted" title={course}>
        {course.length > 14 ? course.slice(0, 13) + '…' : course}
      </span>
      <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
        />
      </div>
      <span style={{ color }} className="w-6 text-right">{size}</span>
    </div>
  )
}

// ── Stats badge ───────────────────────────────────────────────────────────────
const Stat = ({ label, value, color }) => (
  <div className="flex flex-col items-center">
    <span className="font-mono font-bold text-xl" style={{ color }}>{value}</span>
    <span className="text-xs text-muted font-mono uppercase tracking-wider">{label}</span>
  </div>
)

// ── Step log item ─────────────────────────────────────────────────────────────
const StepItem = ({ step, isCurrent }) => {
  const cfg = KIND_CONFIG[step.kind] || KIND_CONFIG.try
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border-l-2 text-xs font-mono transition-all duration-200 ${
        isCurrent ? 'scale-[1.01]' : ''
      }`}
      style={{ borderColor: cfg.color, background: isCurrent ? cfg.bg : 'transparent', color: '#9ca3af' }}
    >
      <span style={{ color: cfg.color }} className="mt-0.5 text-base leading-none flex-shrink-0">{cfg.icon}</span>
      <div className="min-w-0">
        <span style={{ color: cfg.color }} className="font-semibold mr-1">[{cfg.label}]</span>
        <span className="text-text/80">{step.exam}</span>
        {step.value && (
          <span className="text-muted ml-1">
            → {step.value.slot} / {step.value.room}
          </span>
        )}
      </div>
    </div>
  )
}


// ── Main Visualizer ───────────────────────────────────────────────────────────
export default function Visualizer({ steps, stats, solution }) {
  const [currentStep, setCurrentStep]   = useState(0)
  const [playing,     setPlaying]       = useState(false)
  const [speed,       setSpeed]         = useState(300)   // ms per step
  const logRef    = useRef(null)
  const timerRef  = useRef(null)

  const totalSteps = steps.length

  // Auto-play
  useEffect(() => {
    if (!playing) return
    timerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= totalSteps - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(timerRef.current)
  }, [playing, speed, totalSteps])

  // Scroll log to current step
  useEffect(() => {
    if (logRef.current) {
      const items = logRef.current.querySelectorAll('[data-step]')
      if (items[currentStep]) items[currentStep].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentStep])

  // Start fresh when new steps arrive
  useEffect(() => {
    setCurrentStep(0)
    setPlaying(true)
  }, [steps])

  const step    = steps[currentStep]
  const cfg     = step ? (KIND_CONFIG[step.kind] || KIND_CONFIG.try) : null

  // Running stats up to current step
  const runningStats = { assignments: 0, backtracks: 0, prunes: 0 }
  for (let i = 0; i <= currentStep; i++) {
    const s = steps[i]
    if (!s) break
    if (s.kind === 'assign')    runningStats.assignments++
    if (s.kind === 'backtrack') runningStats.backtracks++
    if (s.kind === 'prune')     runningStats.prunes++
  }

  // Domain data from current step
  const domains = step?.domains || {}
  const examNames = Object.keys(domains)
  const maxDomain = Math.max(...Object.values(domains), 1)

  if (!totalSteps) return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="text-5xl opacity-20">◌</div>
      <p className="text-muted font-mono text-sm">Press <span className="text-accent">▶ Run CSP Solver</span> to begin</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Current action banner ─────────────────────────── */}
      {step && cfg && (
        <div
          className="rounded-lg px-4 py-3 border font-mono text-sm transition-all duration-300"
          style={{ borderColor: cfg.color, background: cfg.bg }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ color: cfg.color }}>{cfg.icon}</span>
            <div>
              <div className="font-bold uppercase tracking-wider text-xs mb-0.5" style={{ color: cfg.color }}>
                {cfg.label}
              </div>
              <div className="text-text/90">{step.detail}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live stats ────────────────────────────────────── */}
      <div className="flex justify-around bg-surface border border-border rounded-lg py-3">
        <Stat label="Assigned"   value={runningStats.assignments} color="#00ff87" />
        <Stat label="Backtracks" value={runningStats.backtracks}  color="#ff4f5e" />
        <Stat label="Pruned"     value={runningStats.prunes}      color="#6b7280" />
        <Stat label="Step"       value={`${currentStep + 1}/${totalSteps}`} color="#00e5ff" />
      </div>

      {/* ── Domain sizes bar chart ────────────────────────── */}
      {examNames.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2">
            Domain Sizes (remaining options per exam)
          </div>
          {examNames.map(name => (
            <DomainBar
              key={name}
              course={name}
              size={domains[name]}
              maxSize={maxDomain}
              isActive={step?.exam === name}
            />
          ))}
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
        {/* Scrubber */}
        <input
          type="range"
          min={0} max={totalSteps - 1}
          value={currentStep}
          onChange={e => { setPlaying(false); setCurrentStep(Number(e.target.value)) }}
          className="w-full accent-accent cursor-pointer"
        />

        {/* Buttons + speed */}
        <div className="flex items-center gap-2 justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => { setPlaying(false); setCurrentStep(0) }}
              className="px-3 py-1.5 border border-border rounded font-mono text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors"
            >⏮</button>
            <button
              onClick={() => { setPlaying(false); setCurrentStep(p => Math.max(0, p - 1)) }}
              className="px-3 py-1.5 border border-border rounded font-mono text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors"
            >‹</button>
            <button
              onClick={() => setPlaying(p => !p)}
              className="px-4 py-1.5 rounded font-mono text-xs font-semibold transition-colors"
              style={{ background: playing ? '#ff4f5e22' : '#00e5ff22', color: playing ? '#ff4f5e' : '#00e5ff', border: `1px solid ${playing ? '#ff4f5e44' : '#00e5ff44'}` }}
            >{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button
              onClick={() => { setPlaying(false); setCurrentStep(p => Math.min(totalSteps - 1, p + 1)) }}
              className="px-3 py-1.5 border border-border rounded font-mono text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors"
            >›</button>
            <button
              onClick={() => { setPlaying(false); setCurrentStep(totalSteps - 1) }}
              className="px-3 py-1.5 border border-border rounded font-mono text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors"
            >⏭</button>
          </div>

          {/* Speed slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">Speed</span>
            <input
              type="range" min={50} max={1500} step={50}
              value={1550 - speed}   // invert: right = faster
              onChange={e => setSpeed(1550 - Number(e.target.value))}
              className="w-24 accent-accent"
            />
            <span className="text-xs font-mono text-accent w-14">{speed < 200 ? 'Fast' : speed < 700 ? 'Normal' : 'Slow'}</span>
          </div>
        </div>
      </div>

      {/* ── Algorithm pipeline legend ──────────────────────── */}
      <AlgorithmPanel currentStepKind={step?.kind} />

      {/* ── Step log ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-border text-xs font-mono text-muted uppercase tracking-wider">
          Step Log
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {steps.map((s, i) => (
            <div key={i} data-step={i}>
              <StepItem step={s} isCurrent={i === currentStep} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
