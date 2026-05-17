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
import { registerSubscriptionAction } from './actions'
import { KNOWN_IDENTITY_EVENTS } from './_events'

export function RegisterSubscriptionDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [allEvents, setAllEvents] = useState(true)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="solid" arrow>
          Register subscription
        </Button>
      </DialogTrigger>
      <DialogContent eyebrow="/ Dialog · Register webhook">
        <DialogHeader>
          <DialogTitle>Register a webhook subscription</DialogTitle>
          <DialogDescription>
            Genkan POSTs signed envelopes to this URL. The shared HMAC
            secret is generated for you — pin it on the next page.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            const fd = new FormData(e.currentTarget)
            startTransition(async () => {
              const res = await registerSubscriptionAction(fd)
              if (res.ok) {
                setOpen(false)
                router.push(`/admin/webhooks/${res.id}`)
                router.refresh()
              } else {
                setError(res.error)
              }
            })
          }}
        >
          <div style={{ display: 'grid', gap: 20 }}>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <FieldInput
                id="name"
                name="name"
                type="text"
                placeholder="menu"
              />
              <FieldHint>Free-form label shown in the list.</FieldHint>
            </Field>
            <Field error={Boolean(error)}>
              <FieldLabel htmlFor="url">URL</FieldLabel>
              <FieldInput
                id="url"
                name="url"
                type="url"
                placeholder="https://menu.iedora.com/api/identity/webhook"
                required
              />
              <FieldHint>Absolute https URL.</FieldHint>
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
                      <input type="checkbox" name="event" value={evt} />
                      {evt}
                    </label>
                  ))}
                </div>
              ) : null}
              {error ? (
                <FieldHint role="alert">{error}</FieldHint>
              ) : (
                <FieldHint>
                  Leave “All events” checked to receive every event.
                </FieldHint>
              )}
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="accent" arrow disabled={pending}>
              {pending ? 'Registering…' : 'Register'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
