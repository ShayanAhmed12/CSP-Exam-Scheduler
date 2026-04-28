import React from 'react'

/**
 * AlgorithmPanel
 * --------------
 * Shows the algorithm pipeline from the proposal:
 *   1. MRV variable ordering
 *   2. LCV value ordering
 *   3. Assignment
 *   4. Forward Checking
 *   5. Backtracking
 *
 * The `activePhase` prop (derived from current step kind) highlights
 * which phase is currently executing.
 */

const PHASES = [
  {
    id: 'mrv',
    icon: '①',
    title: 'MRV Heuristic',
    subtitle: 'Variable Ordering',
    desc: 'Select the unassigned exam with the fewest remaining (slot, room) options. Fail fast on the hardest variables.',
    color: '#00e5ff',
    // FIX: MRV fires just before a value is tried — both MRV and LCV are
    // active during the 'try' phase, so highlight together.
    kinds: ['try'],
  },
  {
    id: 'lcv',
    icon: '②',
    title: 'LCV Heuristic',
    subtitle: 'Value Ordering',
    desc: 'Try the (slot, room) that eliminates the fewest options from other exams. Keep doors open.',
    color: '#ffd600',
    kinds: ['try'],
  },
  {
    id: 'assign',
    icon: '③',
    title: 'Assignment',
    subtitle: 'Constraint Check',
    desc: 'Assign exam → (slot, room) if no room conflict, teacher conflict, or student clash exists.',
    color: '#00ff87',
    kinds: ['assign'],
  },
  {
    id: 'fc',
    icon: '④',
    title: 'Forward Checking',
    subtitle: 'Domain Pruning',
    desc: 'Immediately remove impossible values from future domains. If any domain empties, backtrack.',
    color: '#9ca3af',
    kinds: ['prune'],
  },
  {
    id: 'bt',
    icon: '⑤',
    title: 'Backtracking',
    subtitle: 'Dead-End Recovery',
    desc: 'Undo last assignment and restore pruned domains. Try the next value in LCV order.',
    color: '#ff4f5e',
    kinds: ['backtrack'],
  },
]

export default function AlgorithmPanel({ currentStepKind }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs font-mono text-muted uppercase tracking-wider mb-3 glow-line">
        Algorithm Pipeline
      </div>

      <div className="flex flex-col gap-2">
        {PHASES.map(phase => {
          const isActive = phase.kinds.includes(currentStepKind)
          return (
            <div
              key={phase.id}
              className={`
                flex gap-3 p-3 rounded-lg border transition-all duration-300
                ${isActive
                  ? 'border-opacity-100 scale-[1.01]'
                  : 'border-border opacity-50'
                }
              `}
              style={{
                borderColor: isActive ? phase.color : undefined,
                background:  isActive ? `${phase.color}10` : 'transparent',
              }}
            >
              {/* Step number badge */}
              <span
                className="text-lg leading-none flex-shrink-0 font-mono font-bold mt-0.5"
                style={{ color: isActive ? phase.color : '#4a5a7a' }}
              >
                {phase.icon}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: isActive ? phase.color : '#9ca3af' }}
                  >
                    {phase.title}
                  </span>
                  <span className="text-xs text-muted font-mono">· {phase.subtitle}</span>
                  {isActive && (
                    <span
                      className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full animate-pulse"
                      style={{ background: `${phase.color}20`, color: phase.color }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted/80 leading-relaxed">{phase.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Constraint types legend */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2">Constraints</div>
        <div className="flex flex-col gap-1 text-xs font-mono text-muted/70">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red/70 flex-shrink-0" />
            No two exams share a <span className="text-text/80 ml-1">room</span> at the same time
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow/70 flex-shrink-0" />
            No <span className="text-text/80 mx-1">teacher</span> invigilates two exams at once
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent/70 flex-shrink-0" />
            No <span className="text-text/80 mx-1">student</span> sits two exams simultaneously
          </div>
        </div>
      </div>
    </div>
  )
}