'use server'

import { revalidatePath } from 'next/cache'
import { requireIedoraAdmin } from '../../guards'
import { betterAuthAdminSessionsGateway } from './adapters/better-auth'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function revokeSessionAction(input: {
  sessionToken: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = betterAuthAdminSessionsGateway()
  await gateway.revokeSession({ sessionToken: input.sessionToken })
  revalidatePath('/core/admin/sessions')
  return { ok: true }
}
