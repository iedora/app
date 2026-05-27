'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SidebarLinks,
  SidebarLink,
  SidebarSectionLabel,
} from '@iedora/design-system'

export type ActiveSidebarItem =
  | {
      href: string
      label: React.ReactNode
      testId?: string
      /** When `true` (default), an active item matches the current path
       *  OR any descendant; when `false`, only an exact match wins. */
      matchPrefix?: boolean
    }
  | {
      kind: 'section'
      label: React.ReactNode
      testId?: string
    }

/**
 * Tiny client island that resolves the active sidebar item against
 * `usePathname()` and renders the cinnabar rail on it. Keeps the
 * server layout free of the `usePathname` boundary and lets `<Link>`s
 * stay prefetchable.
 */
export function ActiveSidebarLinks({
  items,
  ariaLabel,
}: {
  items: ReadonlyArray<ActiveSidebarItem>
  ariaLabel: string
}) {
  const pathname = usePathname() ?? ''
  return (
    <SidebarLinks aria-label={ariaLabel}>
      {items.map((item, i) => {
        if ('kind' in item) {
          return (
            <SidebarSectionLabel key={`section-${i}`} data-test-id={item.testId}>
              {item.label}
            </SidebarSectionLabel>
          )
        }
        const match = item.matchPrefix === false
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <SidebarLink
            key={item.href}
            asChild
            active={match}
            data-test-id={item.testId}
          >
            <Link href={item.href}>{item.label}</Link>
          </SidebarLink>
        )
      })}
    </SidebarLinks>
  )
}
