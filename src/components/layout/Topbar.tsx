'use client'
interface TopbarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <div className="h-16 bg-white border-b border-[#E8E0D4] flex items-center px-7 gap-4 flex-shrink-0">
      <div className="flex-1">
        <h1 className="font-display text-[22px] font-semibold text-ink leading-none">{title}</h1>
        {subtitle && <p className="text-[11px] text-mid mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      <button className="relative w-9 h-9 rounded-lg border border-[#E8E0D4] flex items-center justify-center text-mid hover:bg-paper transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-ember rounded-full border border-white"/>
      </button>
    </div>
  )
}
