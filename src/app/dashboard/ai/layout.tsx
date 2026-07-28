import Topbar from '@/components/layout/Topbar'
import Badge from '@/components/ui/Badge'
import { isAiConfigured } from '@/lib/ai'
import AiNav from './AiNav'

/**
 * Shell for the AI Command Center: one Topbar, one tab bar, and every module
 * renders beneath them. The section grows by adding a page and a tab entry —
 * nothing existing needs restructuring.
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  const configured = isAiConfigured()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="AI Command Center"
        subtitle="Your assistant across every channel"
        actions={
          <Badge variant={configured ? 'success' : 'warning'}>
            {configured ? 'Active' : 'Not configured'}
          </Badge>
        }
      />
      <AiNav />
      {children}
    </div>
  )
}
