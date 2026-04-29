import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  change?: string
  changeUp?: boolean
  accent?: 'ember' | 'gold' | 'teal' | 'success'
  className?: string
}

const accents = {
  ember:   'border-t-ember',
  gold:    'border-t-gold',
  teal:    'border-t-teal',
  success: 'border-t-[#2A9D5C]',
}

export default function KpiCard({ label, value, change, changeUp, accent = 'ember', className }: KpiCardProps) {
  return (
    <div className={cn('bg-white border border-[#E8E0D4] border-t-2 rounded-xl p-5 hover:shadow-card-hover transition-shadow', accents[accent], className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mid mb-2">{label}</div>
      <div className="font-data text-3xl font-bold text-ink leading-none">{value}</div>
      {change && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs', changeUp ? 'text-[#2A9D5C]' : 'text-[#C0392B]')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {changeUp
              ? <polyline points="18,15 12,9 6,15"/>
              : <polyline points="6,9 12,15 18,9"/>}
          </svg>
          {change}
        </div>
      )}
    </div>
  )
}
