import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser, type SessionUser } from './session'
import { createWorkspaceForUser, defaultWorkspaceName } from '@/lib/workspace/provision'
import type { PlanId } from '@/lib/billing/plans'

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface ActiveWorkspace {
  id: string
  name: string
  slug: string
  plan: PlanId
}

export interface WorkspaceContext {
  user: SessionUser
  workspace: ActiveWorkspace
  role: WorkspaceRole
}

/**
 * Resolves which workspace the signed-in person is acting in.
 *
 * This is the only place a workspace id enters a request. Every query that
 * touches tenant data scopes on `context.workspace.id`, never on an id taken
 * from the URL or body — which is what makes changing an id in a request
 * incapable of reaching another tenant.
 *
 * Wrapped in `cache` so one render shares a single lookup.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, slug: true, plan: true } },
    },
  })

  if (memberships.length === 0) {
    // Self-heal rather than 500. An account can only reach this state through
    // a partial signup or a deleted workspace, and the repair is the same
    // thing signup does.
    const workspace = await createWorkspaceForUser(prisma, {
      userId: user.id,
      name: defaultWorkspaceName(user.name, user.email),
    })
    return { user, workspace, role: 'OWNER' }
  }

  const preferred =
    memberships.find((m) => m.workspace.id === user.lastWorkspaceId) ?? memberships[0]

  return {
    user,
    workspace: preferred.workspace,
    role: preferred.role,
  }
})

/** For server components behind the app shell. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext()
  if (!context) redirect('/login')
  return context
}

/** Only an owner or admin may change billing, members or workspace settings. */
export function canAdminister(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/**
 * Switches which workspace opens next time. Verifies membership first, so a
 * posted id cannot move someone into a workspace they do not belong to.
 */
export async function setActiveWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  })
  if (!membership) return false

  await prisma.user.update({ where: { id: userId }, data: { lastWorkspaceId: workspaceId } })
  return true
}
