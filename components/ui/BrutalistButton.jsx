'use client'

export default function BrutalistButton({ children, onClick, className = '', variant = 'primary', disabled = false, type = 'button', title }) {
  const base = 'border-2 border-black px-4 py-2 font-bold uppercase tracking-tight transition-all duration-75 rounded-none disabled:opacity-50 flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    secondary: 'bg-white text-black hover:bg-[#FFD166] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none',
    danger: 'bg-[#D90429] text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    accent: 'bg-[#06D6A0] text-black hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}
