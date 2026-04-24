import React, { useState, useEffect } from 'react'
import { fetchDefaultData } from '../api'

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-mono uppercase tracking-widest text-muted/90">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)}
      placeholder={placeholder}
      className="bg-bg/80 border border-border/80 rounded-md px-3 py-2 text-sm font-mono text-text
                 placeholder:text-muted/40 focus:outline-none focus:border-accent/70
                 focus:ring-2 focus:ring-accent/20 transition-all"
    />
  </div>
)

const TagInput = ({ label, tags, onChange }) => {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim().toUpperCase()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted/90">{label}</label>
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => (e.key==='Enter'||e.key===',') && (e.preventDefault(), add())}
          placeholder="S01… press Enter"
          className="flex-1 bg-bg/80 border border-border/80 rounded-md px-3 py-1.5 text-sm font-mono text-text
                     placeholder:text-muted/40 focus:outline-none focus:border-accent/70 transition-all" />
        <button onClick={add}
          className="px-3 py-1.5 text-xs font-mono rounded-md border border-border/80 text-muted hover:border-accent/70 hover:text-accent transition-all">
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 bg-surface2/85 border border-border/80 text-xs font-mono px-2 py-0.5 rounded-full text-muted">
              {t}
              <button onClick={() => onChange(tags.filter(x => x !== t))}
                className="hover:text-danger ml-0.5 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const Card = ({ children, onRemove }) => (
  <div className="group relative bg-surface2/55 border border-border/80 rounded-xl p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
    {children}
    <button onClick={onRemove}
      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center
                 text-muted/60 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all text-base">
      ×
    </button>
  </div>
)

const SectionHead = ({ step, title, onAdd, addLabel }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-accent/20 border border-accent/50 text-accent text-[10px] font-semibold flex items-center justify-center flex-shrink-0">{step}</span>
      <h3 className="font-serif text-sm font-semibold text-text/95">{title}</h3>
    </div>
    {onAdd && (
      <button onClick={onAdd}
        className="text-xs font-mono px-2.5 py-1 rounded-md border border-border/80 text-muted hover:border-accent/70 hover:text-accent transition-all">
        {addLabel || '+ Add'}
      </button>
    )}
  </div>
)

export default function InputPanel({ onSolve, solving }) {
  const [exams,   setExams]   = useState([])
  const [rooms,   setRooms]   = useState([])
  const [slots,   setSlots]   = useState([])
  const [minGap,  setMinGap]  = useState(1)
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDefaultData()
      .then(d => {
        setExams(d.exams.map(e => ({ ...e, students: e.students || [] })))
        setRooms(d.rooms)
        setSlots(d.time_slots)
        setMinGap(typeof d.min_gap === 'number' ? d.min_gap : 1)
      })
      .catch(() => {
        setExams([
          { course:'Artificial Intelligence', teacher:'Dr. Ahmed', students:['S01','S02','S03'] },
          { course:'Software Engineering',    teacher:'Dr. Khan',  students:['S01','S04','S05'] },
          { course:'Database Systems',        teacher:'Dr. Ali',   students:['S02','S04','S06'] },
        ])
        setRooms([{ name:'Hall-A', capacity:60 }, { name:'Hall-B', capacity:60 }])
        setSlots([
          { day:'Monday',  period:'09:00-11:00' },
          { day:'Monday',  period:'12:00-14:00' },
          { day:'Tuesday', period:'09:00-11:00' },
        ])
        setMinGap(1)
      })
      .finally(() => setLoading(false))
  }, [])

  const upd = (setter, i, field, val) =>
    setter(prev => prev.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-muted text-sm font-mono animate-pulse">
      Loading dataset…
    </div>
  )

  const handleSubmit = () => {
    const cleanExams = exams
      .map(e => {
        const students = Array.from(new Set((e.students || []).map(s => String(s).trim().toUpperCase()).filter(Boolean)))
        return {
          course: String(e.course || '').trim(),
          teacher: String(e.teacher || '').trim(),
          students,
        }
      })
      .filter(e => e.course && e.teacher)

    const cleanRooms = rooms
      .map(r => ({
        name: String(r.name || '').trim(),
        capacity: Number(r.capacity) || 0,
      }))
      .filter(r => r.name)

    const cleanSlots = slots
      .map(s => ({
        day: String(s.day || '').trim(),
        period: String(s.period || '').trim(),
      }))
      .filter(s => s.day && s.period)

    const errors = []

    if (cleanExams.length === 0) errors.push('Add at least one valid exam (course + teacher).')
    if (cleanRooms.length === 0) errors.push('Add at least one valid room.')
    if (cleanSlots.length === 0) errors.push('Add at least one valid time slot.')

    if (!Number.isInteger(minGap) || minGap < 0) {
      errors.push('Minimum gap must be a non-negative integer.')
    }

    if (cleanRooms.some(r => r.capacity <= 0)) {
      errors.push('Every room must have a positive capacity.')
    }

    const seenCourses = new Set()
    cleanExams.forEach(e => {
      const key = e.course.toLowerCase()
      if (seenCourses.has(key)) {
        errors.push(`Duplicate course found: ${e.course}`)
      }
      seenCourses.add(key)
    })

    const maxCapacity = cleanRooms.length > 0 ? Math.max(...cleanRooms.map(r => r.capacity)) : 0
    const oversizedExam = cleanExams.find(e => e.students.length > maxCapacity)
    if (oversizedExam) {
      errors.push(
        `Exam "${oversizedExam.course}" has ${oversizedExam.students.length} students, which exceeds every room capacity.`
      )
    }

    if (errors.length > 0) {
      setLocalError(errors[0])
      return
    }

    setLocalError('')
    onSolve({
      exams: cleanExams,
      rooms: cleanRooms,
      time_slots: cleanSlots,
      min_gap: minGap,
    })
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1 pb-4">
        <div>
        <SectionHead step="1" title="Courses & Instructors"
          onAdd={() => setExams(p => [...p, { course:'', teacher:'', students:[] }])} addLabel="+ Exam" />
        <div className="space-y-3">
          {exams.map((e, i) => (
            <Card key={i} onRemove={() => setExams(p => p.filter((_,j)=>j!==i))}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Field label="Course Name" value={e.course}
                  onChange={v => upd(setExams,i,'course',v)} placeholder="Artificial Intelligence" />
                <Field label="Instructor" value={e.teacher}
                  onChange={v => upd(setExams,i,'teacher',v)} placeholder="Dr. Ahmed" />
              </div>
              <TagInput label="Student IDs" tags={e.students} onChange={v => upd(setExams,i,'students',v)} />
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHead step="2" title="Examination Rooms"
          onAdd={() => setRooms(p => [...p, { name:'', capacity:50 }])} addLabel="+ Room" />
        <div className="space-y-3">
          {rooms.map((r, i) => (
            <Card key={i} onRemove={() => setRooms(p => p.filter((_,j)=>j!==i))}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Room Name" value={r.name} onChange={v => upd(setRooms,i,'name',v)} placeholder="Hall-A" />
                <Field label="Capacity" value={r.capacity} type="number" onChange={v => upd(setRooms,i,'capacity',v)} placeholder="60" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHead step="3" title="Time Slots"
          onAdd={() => setSlots(p => [...p, { day:'Monday', period:'09:00-11:00' }])} addLabel="+ Slot" />
        <div className="space-y-3">
          {slots.map((s, i) => (
            <Card key={i} onRemove={() => setSlots(p => p.filter((_,j)=>j!==i))}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Day" value={s.day} onChange={v => upd(setSlots,i,'day',v)} placeholder="Monday" />
                <Field label="Period" value={s.period} onChange={v => upd(setSlots,i,'period',v)} placeholder="09:00-11:00" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHead step="4" title="Solver Settings" />
        <div className="bg-surface2/55 border border-border/80 rounded-xl p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3">
            <Field
              label="Minimum Gap (in slots)"
              value={minGap}
              type="number"
              onChange={v => setMinGap(Math.max(0, Number(v) || 0))}
              placeholder="1"
            />
            <p className="text-xs text-muted font-mono">
              Applies between exams that share students or the same teacher.
            </p>
          </div>
        </div>
      </div>

      </div>

      <div className="pt-3 mt-2 border-t border-border/80 bg-surface/95 backdrop-blur-sm">
        {localError && (
          <div className="mb-3 px-3 py-2 rounded-lg border border-danger/40 bg-danger/10 text-danger text-xs font-mono">
            {localError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={solving}
          className="w-full py-3.5 rounded-xl font-sans font-semibold text-sm tracking-wide
                     bg-accent text-[#03121d] hover:bg-accent/90 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-[0_12px_26px_rgba(47,199,255,0.30)]"
        >
          {solving ? '⟳  Running CSP Solver…' : '▶  Generate Timetable'}
        </button>
      </div>
    </div>
  )
}
