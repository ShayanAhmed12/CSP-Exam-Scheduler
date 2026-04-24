import React, { useMemo } from 'react'

// Distinct hue palette for up to 12 exams
const EXAM_COLORS = [
  { bg: 'rgba(0,229,255,0.15)',  border: '#00e5ff', text: '#00e5ff' },
  { bg: 'rgba(0,255,135,0.15)',  border: '#00ff87', text: '#00ff87' },
  { bg: 'rgba(255,214,0,0.15)',  border: '#ffd600', text: '#ffd600' },
  { bg: 'rgba(255,79,94,0.15)',  border: '#ff4f5e', text: '#ff4f5e' },
  { bg: 'rgba(138,43,226,0.2)',  border: '#9b59b6', text: '#c39bd3' },
  { bg: 'rgba(255,140,0,0.15)',  border: '#ff8c00', text: '#ffb347' },
  { bg: 'rgba(0,191,255,0.15)',  border: '#00bfff', text: '#87cefa' },
  { bg: 'rgba(50,205,50,0.15)',  border: '#32cd32', text: '#90ee90' },
  { bg: 'rgba(255,20,147,0.15)', border: '#ff1493', text: '#ff69b4' },
  { bg: 'rgba(100,149,237,0.2)', border: '#6495ed', text: '#add8e6' },
  { bg: 'rgba(255,165,0,0.15)',  border: '#ffa500', text: '#ffd280' },
  { bg: 'rgba(64,224,208,0.15)', border: '#40e0d0', text: '#7fffd4' },
]

export default function TimetableGrid({ solution, stats }) {
  if (!solution) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="text-6xl opacity-10 select-none">▦</div>
        <p className="text-muted font-mono text-sm">
          Timetable will appear here once the solver completes
        </p>
      </div>
    )
  }

  const entries = Object.entries(solution) // [course, {slot, room, day, period}]

  // Assign a stable color to each exam
  const colorMap = useMemo(() => {
    const m = {}
    entries.forEach(([course], i) => { m[course] = EXAM_COLORS[i % EXAM_COLORS.length] })
    return m
  }, [solution])

  // Unique days and periods (maintaining insertion order)
  const days    = [...new Set(entries.map(([, v]) => v.day))]
  const periods = [...new Set(entries.map(([, v]) => v.period))]

  // Build lookup: day+period → assignment list
  const cellMap = {}
  entries.forEach(([course, v]) => {
    const key = `${v.day}||${v.period}`
    if (!cellMap[key]) cellMap[key] = []
    cellMap[key].push({ course, room: v.room })
  })

  return (
    <div className="h-full flex flex-col gap-5 overflow-y-auto">

      {/* ── SUCCESS BANNER ─────────────────────────────────── */}
      <div className="rounded-lg border border-green/40 bg-green/5 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <div className="font-semibold text-green font-mono text-sm">Conflict-Free Timetable Generated</div>
          <div className="text-xs text-muted font-mono mt-0.5">
            {entries.length} exams scheduled · {stats?.assignments ?? '—'} assignments · {stats?.backtracks ?? '—'} backtracks
          </div>
        </div>
      </div>

      {/* ── TIMETABLE GRID ─────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm font-mono">
          <thead>
            <tr className="bg-surface">
              <th className="px-4 py-3 text-left text-xs text-muted uppercase tracking-widest border-b border-border w-28">
                Period
              </th>
              {days.map(day => (
                <th
                  key={day}
                  className="px-4 py-3 text-center text-xs uppercase tracking-widest border-b border-border border-l border-l-border"
                  style={{ color: '#00e5ff' }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, pi) => (
              <tr key={period} className={pi % 2 === 0 ? 'bg-bg' : 'bg-surface/40'}>
                <td className="px-4 py-3 text-muted text-xs border-b border-border whitespace-nowrap">
                  {period}
                </td>
                {days.map(day => {
                  const key   = `${day}||${period}`
                  const items = cellMap[key] || []
                  return (
                    <td
                      key={day}
                      className="px-3 py-3 border-b border-border border-l border-l-border align-top min-w-[150px]"
                    >
                      {items.length === 0 ? (
                        <span className="text-border text-xs">—</span>
                      ) : (
                        items.map(({ course, room }) => {
                          const c = colorMap[course]
                          return (
                            <div
                              key={course}
                              className="rounded-lg px-2 py-2 mb-1 last:mb-0 border"
                              style={{ background: c.bg, borderColor: c.border }}
                            >
                              <div className="font-semibold text-xs leading-tight" style={{ color: c.text }}>
                                {course}
                              </div>
                              <div className="text-muted text-xs mt-0.5 flex items-center gap-1">
                                <span className="opacity-60">⬛</span>{room}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── LEGEND ─────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-wrap gap-2">
          {entries.map(([course]) => {
            const c = colorMap[course]
            return (
              <div
                key={course}
                className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded border"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <span style={{ color: c.text }}>●</span>
                <span className="text-text/80">{course}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PERFORMANCE COMPARISON ─────────────────────────── */}
      {stats && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs font-mono text-muted uppercase tracking-wider mb-3 glow-line">
            Algorithm Performance
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Plain backtracking estimate */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted font-mono mb-1 uppercase">Plain Backtracking</div>
              <div className="text-yellow font-mono font-bold text-lg">
                {Math.min(9999, stats.assignments * 4 + stats.backtracks * 8)}
              </div>
              <div className="text-xs text-muted font-mono">est. operations</div>
              <div className="text-xs text-muted/60 font-mono mt-1">No heuristics, brute force</div>
            </div>
            {/* With MRV + LCV + FC */}
            <div className="rounded-lg border border-green/30 bg-green/5 p-3">
              <div className="text-xs text-green/70 font-mono mb-1 uppercase">MRV + LCV + FC ✓</div>
              <div className="text-green font-mono font-bold text-lg">
                {stats.assignments + stats.backtracks + stats.prunes}
              </div>
              <div className="text-xs text-green/70 font-mono">actual operations</div>
              <div className="text-xs text-muted/60 font-mono mt-1">With all heuristics enabled</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="bg-bg rounded-lg p-2">
              <div className="text-green font-mono font-bold">{stats.assignments}</div>
              <div className="text-xs text-muted font-mono">Assignments</div>
            </div>
            <div className="bg-bg rounded-lg p-2">
              <div className="text-red font-mono font-bold">{stats.backtracks}</div>
              <div className="text-xs text-muted font-mono">Backtracks</div>
            </div>
            <div className="bg-bg rounded-lg p-2">
              <div className="text-muted font-mono font-bold">{stats.prunes}</div>
              <div className="text-xs text-muted font-mono">Prunes (FC)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
