import React, { useState } from 'react'
import InputPanel    from './components/InputPanel'
import LiveScheduler from './components/LiveScheduler'
import { solveSchedule } from './api'

export default function App() {
  const [steps,    setSteps]    = useState([])
  const [solution, setSolution] = useState(null)
  const [stats,    setStats]    = useState(null)
  const [comparison, setComparison] = useState(null)
  const [solving,  setSolving]  = useState(false)
  const [error,    setError]    = useState(null)
  const [examList, setExamList] = useState([])

  const handleSolve = async (payload) => {
    setSolving(true)
    setError(null)
    setSolution(null)
    setStats(null)
    setComparison(null)
    setSteps([])
    setExamList(payload.exams)

    try {
      const result = await solveSchedule(payload)
      setSteps(result.steps    || [])
      setSolution(result.solution || null)
      setStats(result.stats    || null)
      setComparison(result.comparison || null)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Unknown error')
    } finally {
      setSolving(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-bg text-text">
      <div className="relative h-full p-3 md:p-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden no-print">
          <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-success/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-danger/10 blur-3xl" />
        </div>

        <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto,auto,1fr] gap-3">
          {/* ── TOP BAR ─────────────────────────────────────── */}
          <header className="rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 shadow-[0_20px_55px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-sm font-serif font-bold">AI</span>
                </div>
                <div>
                  <h1 className="font-serif text-lg font-semibold leading-tight">Exam Scheduler Control Room</h1>
                  <p className="text-xs text-muted font-mono">Dark Workspace · Live Solver Playback · Print-ready Timetable</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full border border-border bg-surface2/70 text-[11px] font-mono text-muted">
                  CS 2005 · FAST University
                </span>
                {solving && (
                  <span className="px-2.5 py-1 rounded-full border border-try/40 bg-try/10 text-[11px] font-mono text-try flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-try animate-pulse inline-block" />
                    Solving
                  </span>
                )}
                {solution && !solving && (
                  <span className="px-2.5 py-1 rounded-full border border-success/40 bg-success/10 text-[11px] font-mono text-success flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Ready
                  </span>
                )}
                {solution && (
                  <button
                    onClick={() => window.print()}
                    className="no-print text-xs font-mono px-3 py-1.5 rounded-lg border border-border text-muted hover:border-accent/70 hover:text-accent transition-all"
                  >
                    ⎙ Print / PDF
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* ── ERROR ───────────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
              <span className="font-semibold">Error:</span> {error}
              <button onClick={() => setError(null)} className="ml-auto text-danger/70 hover:text-danger text-lg leading-none">×</button>
            </div>
          )}

          {/* ── WORKSPACE ───────────────────────────────────── */}
          <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
            <aside className="min-h-0 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur flex flex-col overflow-hidden">
              <div className="px-4 md:px-5 pt-4 pb-3 border-b border-border/80">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="section-label">Planner Inputs</span>
                </div>
                <p className="text-xs text-muted">Courses, invigilators, rooms, slots, then run the solver.</p>
              </div>
              <div className="flex-1 min-h-0 px-4 md:px-5 pt-3 pb-4">
                <InputPanel onSolve={handleSolve} solving={solving} />
              </div>
            </aside>

            <main className="min-h-0 min-w-0 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur flex flex-col overflow-hidden">
              <div className="px-4 md:px-5 pt-4 pb-3 border-b border-border/80 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="section-label">Live Timetable Workspace</span>
                  </div>
                  <p className="text-xs text-muted">
                    {steps.length > 0
                      ? 'Track each placement in real-time, scrub the run, and inspect search behavior.'
                      : 'Run the scheduler to generate a timetable and inspect every solve step.'}
                  </p>
                </div>

                {stats && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-full border border-success/40 bg-success/10 text-success">
                      {stats.assignments} placed
                    </span>
                    <span className="px-2.5 py-1 rounded-full border border-danger/40 bg-danger/10 text-danger">
                      {stats.backtracks} backtracks
                    </span>
                    <span className="px-2.5 py-1 rounded-full border border-border bg-surface2/70 text-muted">
                      {stats.prunes} pruned
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 pt-4 pb-5">
                <LiveScheduler steps={steps} stats={stats} examList={examList} comparison={comparison} />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
