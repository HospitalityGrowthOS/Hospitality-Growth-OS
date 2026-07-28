import { redirect } from 'next/navigation'

/**
 * The intelligence module moved to /dashboard/intelligence. Redirecting keeps
 * bookmarks and any links elsewhere in the product working.
 */
export default function AnalyticsRedirect() {
  redirect('/dashboard/intelligence')
}
