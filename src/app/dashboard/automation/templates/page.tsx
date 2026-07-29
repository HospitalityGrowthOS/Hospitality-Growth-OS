export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { templatesByCategory, listWorkflows } from '@/lib/automation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import InstallButton from './InstallButton'

export default async function TemplatesPage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-mid">No venue is linked to your account yet.</p></div>
  }

  const installed = new Set((await listWorkflows(venue.id)).map(w => w.templateKey).filter(Boolean))
  const groups = templatesByCategory()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="font-display text-[18px] font-semibold text-ink">Templates</h1>
        <p className="text-[13px] text-mid mt-0.5">
          Each one installs as a draft you can edit. Nothing starts messaging guests until you switch it on.
        </p>
      </div>

      {groups.map(({ category, templates }) => (
        <Card key={category}>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">{category}</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {templates.map(t => (
              <div key={t.key} className="flex items-start justify-between gap-4 p-3.5 rounded-lg border border-border bg-paper/40">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{t.name}</p>
                  <p className="text-[12px] text-mid mt-0.5 leading-relaxed">{t.description}</p>
                  {t.note && <p className="text-[11px] text-gold mt-1.5">{t.note}</p>}
                </div>
                <InstallButton templateKey={t.key} alreadyInstalled={installed.has(t.key)} />
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
