'use client'

// Deck-style pill buttons. Red is reserved for the away team, so "danger" is solid black.
export default function BrutalistButton({ children, onClick, className = '', variant = 'primary', disabled = false, type = 'button', title }) {
  const base = 'rounded-full px-4 py-2 font-mono font-bold uppercase text-xs tracking-wider transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2 border-2'
  const variants = {
    primary: 'bg-[#0B0D0B] text-white border-[#0B0D0B] hover:bg-[#6BDB58] hover:text-[#0B0D0B] hover:border-[#6BDB58]',
    secondary: 'bg-white text-[#0B0D0B] border-[#D6DBD3] hover:border-[#6BDB58] hover:bg-[#EFFAEC]',
    danger: 'bg-[#0B0D0B] text-white border-[#0B0D0B] hover:bg-white hover:text-[#0B0D0B]',
    accent: 'bg-[#6BDB58] text-[#0B0D0B] border-[#6BDB58] hover:bg-[#0B0D0B] hover:text-white hover:border-[#0B0D0B]'
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}
