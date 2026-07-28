import Topbar from '@/components/layout/Topbar'
import IntelligenceNav from './IntelligenceNav'

/**
 * Shell for the Business Intelligence Center. One Topbar, one tab bar; every
 * module renders beneath. The section grows by adding a page and a tab entry.
 */
export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Growth Intelligence"
        subtitle="What your guest data is telling you"
      />
      <IntelligenceNav />
      {children}
    </div>
  )
}
