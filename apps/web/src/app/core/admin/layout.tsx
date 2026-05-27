import { requireIedoraAdmin } from '@iedora/product-core'
import { AdminShell } from '@iedora/product-core/shared/ui/admin-shell'

/**
 * Admin chrome — runs at /core/admin/*. The session guard fires here
 * so unauth callers bounce before any nested page renders any chrome.
 * Per the menu's hard rule against gating in layouts, the per-page
 * guards still run (defence-in-depth + Next 16 caches layouts).
 */
export default async function CoreAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireIedoraAdmin()
  return <AdminShell userEmail={session.user.email}>{children}</AdminShell>
}
