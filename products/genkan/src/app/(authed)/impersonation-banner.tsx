import { stopImpersonatingAction } from './impersonation-actions'

/**
 * Form-action shim — `<form action>` requires a `(FormData) => Promise<void>`,
 * but `stopImpersonatingAction` returns `{ ok: false, error }` on failure
 * so it stays testable as a normal server action. Throwing here surfaces
 * the failure via Next's error boundary, which is what we want: an audit
 * write failure must not silently let the admin think they returned.
 */
async function submitStopImpersonating() {
  'use server'
  const result = await stopImpersonatingAction()
  if (result && !result.ok) throw new Error(result.error)
}

/**
 * Cinnabar strip pinned above the meta strip whenever the active session
 * was opened via `auth.api.impersonateUser`. The "Return" button submits
 * a server action that stops the impersonation, records the audit row,
 * and redirects the admin back to /admin/users.
 *
 * The form intentionally has no client JS — submission goes through
 * Next's server-action POST and the action's own redirect() handles UX.
 */
export function ImpersonationBanner({ email }: { email: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--cinnabar)',
        color: 'var(--paper)',
        padding: '10px var(--margin)',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <span>Impersonating · {email}</span>
      <form action={submitStopImpersonating} style={{ margin: 0 }}>
        <button
          type="submit"
          style={{
            background: 'transparent',
            border: '1px solid var(--paper)',
            color: 'var(--paper)',
            padding: '4px 10px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            letterSpacing: 'inherit',
            textTransform: 'inherit',
            cursor: 'pointer',
          }}
        >
          Return to admin
        </button>
      </form>
    </div>
  )
}
