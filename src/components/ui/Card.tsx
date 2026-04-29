import { cn } from '@/lib/utils'

interface CardProps { className?: string; children: React.ReactNode }
interface CardHeaderProps { className?: string; children: React.ReactNode }
interface CardBodyProps { className?: string; children: React.ReactNode }
interface CardFooterProps { className?: string; children: React.ReactNode }

export function Card({ className, children }: CardProps) {
  return <div className={cn('bg-white border border-[#E8E0D4] rounded-xl overflow-hidden', className)}>{children}</div>
}
export function CardHeader({ className, children }: CardHeaderProps) {
  return <div className={cn('px-5 py-4 border-b border-[#E8E0D4] flex items-center justify-between', className)}>{children}</div>
}
export function CardBody({ className, children }: CardBodyProps) {
  return <div className={cn('p-5', className)}>{children}</div>
}
export function CardFooter({ className, children }: CardFooterProps) {
  return <div className={cn('px-5 py-3 border-t border-[#E8E0D4] bg-cream', className)}>{children}</div>
}
