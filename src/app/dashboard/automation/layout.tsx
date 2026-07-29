import Topbar from '@/components/layout/Topbar'
import AutomationNav from './AutomationNav'

/**
 * Shell for the Automation Center. Mirrors the Intelligence layout so the two
 * pillars feel like one product rather than two applications.
 */
export default function AutomationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Automation"
        subtitle="Workflows that run your business while you work in it"
      />
      <AutomationNav />
      {children}
    </div>
  )
}
