'use server'

import { revalidatePath } from 'next/cache'
import { requireIedoraAdmin } from '../../guards'
import { drizzleAdminOrgsGateway } from './adapters/drizzle'
import {
  removeMember as removeMemberUseCase,
  updateMemberRole as updateMemberRoleUseCase,
  cancelInvitation as cancelInvitationUseCase,
} from './use-cases/member-ops'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function removeMemberAction(input: {
  organizationId: string
  memberIdOrEmail: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = drizzleAdminOrgsGateway()
  await removeMemberUseCase(gateway, input)
  revalidatePath(`/core/admin/organizations/${input.organizationId}`)
  return { ok: true }
}

export async function updateMemberRoleAction(input: {
  organizationId: string
  memberId: string
  role: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = drizzleAdminOrgsGateway()
  await updateMemberRoleUseCase(gateway, input)
  revalidatePath(`/core/admin/organizations/${input.organizationId}`)
  return { ok: true }
}

export async function cancelInvitationAction(input: {
  organizationId: string
  invitationId: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = drizzleAdminOrgsGateway()
  await cancelInvitationUseCase(gateway, { invitationId: input.invitationId })
  revalidatePath(`/core/admin/organizations/${input.organizationId}`)
  return { ok: true }
}
