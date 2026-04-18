'use client'

export default function BrutalistCard({ children, className = '', color = 'bg-white' }) {
  return (
    <div className={`border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none ${color} ${className}`}>
      {children}
    </div>
  )
}
