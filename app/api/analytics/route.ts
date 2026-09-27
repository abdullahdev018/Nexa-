import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { clearSource } from '@/lib/analytics/service'
import { apiError } from '@/lib/utils/api'

/**
 * Clears imported or demo data (`?source=IMPORTED|DEMO`). Allowed on any plan,
 * so a workspace that downgrades can still remove what it put in.
 */
export async function DELETE(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)

  const source = new URL(request.url).searchParams.get('source')
  if (source !== 'IMPORTED' && source !== 'DEMO') {
    return apiError('Choose which data to clear: imported or demo.', 422)
  }
  const removed = await clearSource(context.workspace.id, source)
  return NextResponse.json({ removed })
}
