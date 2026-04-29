import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'default' | 'gold' | 'silver' | 'bronze' | 'success' | 'warning' | 'danger' | 'teal' | 'ember'
  className?: string
  children: React.ReactNode
}

const variants = {
  default: 'bg-[rgba(107,95,86,0.1)] text-mid',
  gold:    'bg-[rgba(200,164,90,0.15)] text-[#9A7A30]',
  silver:  'bg-[rgba(107,95,86,0.12)] text-mid',
  bronze:  'bg-[rgba(179,107,58,0.15)] text-[#8B5E30]',
  success: 'bg-[rgba(42,157,92,0.1)] text-[#2A9D5C]',
  warning: 'bg-[rgba(212,135,26,0.1)] text-[#D4871A]',
  danger:  'bg-[rgba(192,57,43,0.1)] text-[#C0392B]',
  teal:    'bg-[rgba(26,122,154,0.1)] text-teal',
  ember:   'bg-[rgba(232,93,38,0.1)] text-ember',
}

export default function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', variants[variant], className)}>
      {children}
    </span>
  )
}
