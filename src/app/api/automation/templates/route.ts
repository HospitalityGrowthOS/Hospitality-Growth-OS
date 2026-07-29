import { NextRequest, NextResponse } from 'next/server'
import { getCurrentVenue } from '@/lib/venue'
import { TEMPLATES, getTemplate, createWorkflow } from '@/lib/automation'

export async function GET() {
  return NextResponse.json({
    templates: TEMPLATES.map(({ key, name, description, category, note }) =>
      ({ key, name, description, category, note })),
  })
}

/** Installs a template as a draft workflow. Nothing is activated. */
export async function POST(req: NextRequest) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { key } = await req.json()
    const template = getTemplate(key)
    if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 404 })

    const result = await createWorkflow(venue.id, template.build())
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })
    return NextResponse.json({ workflow: result.data }, { status: 201 })
  } catch (err) {
    console.error('[automation/templates] POST failed:', err)
    return NextResponse.json({ error: 'Could not install template' }, { status: 500 })
  }
}
