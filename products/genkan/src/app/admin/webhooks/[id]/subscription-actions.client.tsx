'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldHint,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'
import {
  deleteSubscriptionAction,
  sendTestEventAction,
  updateSubscriptionAction,
} from '../actions'
import { KNOWN_IDENTITY_EVENTS } from '../_events'

export function SecretReveal({ secret }: { secret: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const masked = '•'.repeat(Math.min(28, secret.length))

  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 12,
        alignItems: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 12,
      }}
    >
      <span style={{ color: revealed ? 'var(--ink)' : 'var(--ink-55)' }}>
        {revealed ? secret : masked}
      </span>
      <Button variant="ghost" onClick={() => setRevealed((v) => !v)}>
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(secret).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            })
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </span>
  )
}

export function SubscriptionForm({
  id,
  initialName,
  initialUrl,
  initialEnabled,
  initialEvents,
}: {
  id: string
  initialName: string
  initialUrl: string
  initialEnabled: boolean
  initialEvents: string[] | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [allEvents, setAllEvents] = useState(initialEvents === null)
  const initialEventSet = new Set(initialEvents ?? [])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        setOk(false)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const res = await updateSubscriptionAction(id, fd)
          if (res.ok) setOk(true)
          else setError(res.error)
        })
      }}
      style={{ display: 'grid', gap: 20, maxWidth: 720 }}
    >
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <FieldInput
          id="name"
          name="name"
          type="text"
          defaultValue={initialName}
        />
      </Field>
      <Field error={Boolean(error)}>
        <FieldLabel htmlFor="url">URL</FieldLabel>
        <FieldInput
          id="url"
          name="url"
          type="url"
          defaultValue={initialUrl}
          required
        />
      </Field>
      <Field>
        <FieldLabel>Status</FieldLabel>
        <label
          style={{
            display: 'inline-flex',
            gap: 8,
            alignItems: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            marginTop: 6,
          }}
        >
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
          />
          Enabled
        </label>
      </Field>
      <Field>
        <FieldLabel>Events</FieldLabel>
        <label
          style={{
            display: 'inline-flex',
            gap: 8,
            alignItems: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            marginTop: 6,
          }}
        >
          <input
            type="checkbox"
            name="events_all"
            checked={allEvents}
            onChange={(e) => setAllEvents(e.target.checked)}
          />
          All events
        </label>
        {!allEvents ? (
          <div
            role="group"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 18px',
              marginTop: 10,
            }}
          >
            {KNOWN_IDENTITY_EVENTS.map((evt) => (
              <label
                key={evt}
                style={{
                  display: 'inline-flex',
                  gap: 8,
                  alignItems: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  name="event"
                  value={evt}
                  defaultChecked={initialEventSet.has(evt)}
                />
                {evt}
              </label>
            ))}
          </div>
        ) : null}
        {error ? (
          <FieldHint role="alert">{error}</FieldHint>
        ) : ok ? (
          <FieldHint>Saved.</FieldHint>
        ) : null}
      </Field>
      <div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

export function SendTestEventButton() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          startTransition(async () => {
            const res = await sendTestEventAction()
            setMsg(res.ok ? 'Sent.' : res.error)
            setTimeout(() => setMsg(null), 2400)
          })
        }}
      >
        {pending ? 'Sending…' : 'Send test event'}
      </Button>
      {msg ? (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-55)',
          }}
        >
          {msg}
        </span>
      ) : null}
    </span>
  )
}

export function DeleteSubscriptionDialog({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="accent">Delete</Button>
      </DialogTrigger>
      <DialogContent eyebrow="/ Dialog · Delete subscription">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            The subscription is removed and no further events go to that URL.
            The secret is gone — re-registration mints a new one.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            role="alert"
            style={{
              color: 'var(--cinnabar)',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
            }}
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="accent"
            disabled={pending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const res = await deleteSubscriptionAction(id)
                if (res && 'ok' in res && res.ok === false) {
                  setError(res.error)
                } else {
                  router.push('/admin/webhooks')
                  router.refresh()
                }
              })
            }}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
