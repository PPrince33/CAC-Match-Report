'use client'

// Deck-style panel: rounded, light grey, no hard shadow. `color` still lets callers pick a surface.
export default function BrutalistCard({ children, className = '', color = 'bg-[#F0F2EE]' }) {
  const surface = color === 'bg-white' || color === 'bg-[#FFFFFF]' ? 'bg-[#F0F2EE]' : color
  return (
    <div className={`rounded-[20px] p-5 ${surface} ${className}`}>
      {children}
    </div>
  )
}
