'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-[0.12em] text-mid">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-paper border border-[#E8E0D4] rounded-lg px-3.5 py-2.5 text-sm text-ink font-sans',
            'placeholder:text-mid/60 outline-none',
            'focus:border-ember focus:ring-2 focus:ring-ember/10 transition-all',
            error && 'border-[#C0392B] focus:border-[#C0392B] focus:ring-[#C0392B]/10',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-[11px] text-mid">{hint}</p>}
        {error && <p className="text-[11px] text-[#C0392B]">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export default Input
