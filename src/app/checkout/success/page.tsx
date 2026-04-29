import { Suspense } from 'react'
import CheckoutSuccessClient from './CheckoutSuccessClient'

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-ember/20 border-t-ember animate-spin" />
      </div>
    }>
      <CheckoutSuccessClient />
    </Suspense>
  )
}
