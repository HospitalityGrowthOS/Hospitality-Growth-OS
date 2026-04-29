import Link from 'next/link'

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">↩️</div>
        <h1 className="font-display text-3xl font-bold text-ink mb-3">
          No worries
        </h1>
        <p className="text-mid mb-8">
          You cancelled the checkout. Your current plan hasn't changed.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/pricing"
            className="bg-ember text-white font-semibold py-3 px-6 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            View Plans
          </Link>
          <Link
            href="/dashboard"
            className="bg-white border border-[#E8E0D4] text-ink font-semibold py-3 px-6 rounded-xl text-sm hover:bg-paper transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
