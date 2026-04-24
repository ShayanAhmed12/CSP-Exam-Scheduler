import React, { useState } from 'react'

/**
 * ExportButton
 * -----------
 * Triggers window.print() which uses the @media print rules in print.css
 * to render a clean, dark-stripped timetable suitable for PDF-save or printing.
 */
export default function ExportButton({ disabled }) {
  const [clicked, setClicked] = useState(false)

  const handlePrint = () => {
    setClicked(true)
    setTimeout(() => {
      window.print()
      setClicked(false)
    }, 150)
  }

  return (
    <button
      onClick={handlePrint}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-xs
        transition-all duration-200
        ${disabled
          ? 'border-border text-muted opacity-40 cursor-not-allowed'
          : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-95'
        }
        ${clicked ? 'bg-accent/20' : ''}
      `}
    >
      <span className="text-sm">⎙</span>
      Export / Print PDF
    </button>
  )
}
