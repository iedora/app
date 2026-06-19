import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Check,
  ConciergeBell,
  ImageIcon,
  Languages,
  Pencil,
  Play,
  QrCode,
  Star,
} from "lucide-react";
import { Button } from "@iedora/design-system";
import { signInUrl, signUpUrl } from "@iedora/product-menu/shared/auth-urls";

/**
 * iedora menu marketing landing — a faithful build of the Pencil landing
 * (`iedora.pen` → component `dZ0S8`). Source of truth is Pencil; this file
 * mirrors it section for section. Copy is EN for now (i18n to follow).
 */

const SIGN_IN_HREF = signInUrl();
const SIGN_UP_HREF = signUpUrl();

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1695094411862-0e047fbddcb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjMzNzF8&ixlib=rb-4.1.0&q=80&w=1080";
const SHOWCASE_IMAGE =
  "https://images.unsplash.com/photo-1744969982170-026d6f817281?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjM1NzR8&ixlib=rb-4.1.0&q=80&w=1080";
const AVATAR_IMAGE =
  "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODE4MjM2MzZ8&ixlib=rb-4.1.0&q=80&w=1080";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Stories", href: "#stories" },
];

// Canvas order from the Pencil features grid (row 1, then row 2).
const FEATURES = [
  { Icon: QrCode, title: "Scan and open", body: "Guests scan a code or tap a link and your menu opens right away. They never have to install an app." },
  { Icon: ImageIcon, title: "A photo on every dish", body: "Add a photo, a short description, and the price to each dish." },
  { Icon: Languages, title: "More languages", body: "Show your menu in other languages, so more of your guests can read it." },
  { Icon: Pencil, title: "Change it in seconds", body: "Update a price or mark a dish as sold out from your phone. The change shows up straight away." },
  { Icon: BarChart3, title: "See what's popular", body: "See which dishes people look at most, and move your favourites to the top." },
  { Icon: ConciergeBell, title: "Order and pay", body: "Let guests order and pay from the table. The order goes straight to your kitchen." },
];

const STEPS = [
  { n: "1", title: "Add your menu", body: "Add your dishes, photos, and prices. Or send us your current menu and we'll set it up with you." },
  { n: "2", title: "Put up your code", body: "We give you a QR code and a short web link. Put them on your tables, your door, or your receipts." },
  { n: "3", title: "Go live", body: "Guests start scanning straight away. Change a price or add a special whenever you like, and everyone sees it at once." },
];

const SHOWCASE_BULLETS = [
  "You never pay to reprint",
  "Update prices and specials live",
  "Menus in multiple languages, ready to go",
  "Works on any phone, no app needed",
];

const PRICING = {
  free: {
    tier: "Free",
    price: "€0",
    sub: "forever",
    desc: "For getting started",
    feats: ["1,000 views per month", "One restaurant"],
    cta: "Get started",
  },
  pro: {
    tier: "Pro",
    price: "€12",
    sub: "/year",
    desc: "€1 a month, billed yearly",
    feats: ["Unlimited views", "Unlimited restaurants", "Analytics included"],
    cta: "Get Pro",
    badge: "Best value",
  },
};

const FOOTER = [
  { heading: "Product", links: ["Features", "Pricing", "Order & pay", "Analytics"] },
  { heading: "Company", links: ["About", "Stories", "Careers", "Contact"] },
  { heading: "Resources", links: ["Help center", "Guides", "Status", "Developer API"] },
];

/** Brand glyphs (lucide dropped its brand icons), 20px, currentColor. */
const SOCIALS: { name: string; path: React.ReactNode }[] = [
  {
    name: "Instagram",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
      </>
    ),
  },
  {
    name: "X",
    path: <path d="M3 3l7.5 9.2L3.3 21H6l5.7-6.7L17 21h4l-7.9-9.7L20.5 3H18l-5.3 6.2L8 3H3z" fill="currentColor" />,
  },
  {
    name: "LinkedIn",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "YouTube",
    path: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 9l5 3-5 3z" fill="currentColor" />
      </>
    ),
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cinnabar-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--cinnabar)]">
      {children}
    </span>
  );
}

/** EN / PT segmented pill — mirrors the Pencil Lang Switch (visual only for now). */
function LangSwitch() {
  return (
    <div className="hidden items-center gap-0.5 rounded-full bg-[var(--paper-2)] p-[3px] sm:inline-flex">
      <span className="rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-white">EN</span>
      <span className="rounded-full px-2.5 py-1 text-[13px] font-bold text-muted-foreground">PT</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
          <Link href="/menu" className="flex items-center gap-2 no-underline">
            <span className="grid size-8 place-items-center rounded-lg bg-primary font-[family-name:var(--display)] text-[18px] font-extrabold text-white">i</span>
            <span className="font-[family-name:var(--display)] text-[21px] font-extrabold tracking-[-0.02em] text-foreground">iedora</span>
          </Link>
          <ul className="ml-auto hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[15px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-3 md:ml-6">
            <LangSwitch />
            <Link href={SIGN_IN_HREF} className="text-[15px] font-semibold text-foreground no-underline hover:text-primary">Sign in</Link>
            <Button as="a" href={SIGN_UP_HREF} variant="primary" size="sm">Get started</Button>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-7 px-6 py-16 text-center md:py-20">
          <Eyebrow>Digital menus for restaurants</Eyebrow>
          <h1 className="max-w-4xl text-[40px] leading-[1.05] md:text-[60px]">Your menu online. Live in minutes.</h1>
          <p className="max-w-2xl text-[18px] leading-[1.55] text-muted-foreground">
            iedora turns your menu into a digital one your guests open by scanning a code.
            Update it anytime, with nothing to print.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Button as="a" href={SIGN_UP_HREF} variant="primary" size="lg">Get started free</Button>
            <Button as="a" href="#how" variant="secondary" size="lg">
              <Play size={16} fill="currentColor" strokeWidth={0} /> Watch demo
            </Button>
          </div>
          <div className="relative mt-6 h-[320px] w-full overflow-hidden rounded-[28px] sm:h-[440px] md:h-[560px]">
            <Image
              src={HERO_IMAGE}
              alt="Guests at a restaurant table viewing a digital menu"
              fill
              priority
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="object-cover"
            />
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <SectionHead eyebrow="Everything in one place" title="Everything you need, made simple" sub="Your guests get a clean, simple experience and you stay in control." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-7">
                <span className="grid size-11 place-items-center rounded-xl bg-[var(--cinnabar-soft)] text-primary">
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3 className="text-[17px]">{title}</h3>
                <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section id="how" className="bg-muted py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHead eyebrow="Up and running today" title="Live in three steps" />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ n, title, body }) => (
                <div key={n} className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-primary font-[family-name:var(--display)] text-[16px] font-bold text-white">{n}</span>
                  <h3 className="mt-1 text-[18px]">{title}</h3>
                  <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase (image left, text right) ─────────────── */}
        <section id="stories" className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24">
          <div className="relative h-[320px] w-full overflow-hidden rounded-[28px] sm:h-[440px] md:h-[540px]">
            <Image
              src={SHOWCASE_IMAGE}
              alt="A freshly plated dish at a restaurant"
              fill
              sizes="(min-width: 768px) 540px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>Built for busy restaurants</Eyebrow>
            <h2 className="text-[34px] leading-[1.1] md:text-[40px]">Update it once. It changes everywhere.</h2>
            <p className="text-[16px] leading-[1.6] text-muted-foreground">
              {"Your menu lives in one place and updates the moment you change it. You don't reprint anything, your PDFs never go stale, and you don't wait on an agency to edit it."}
            </p>
            <ul className="flex flex-col gap-3.5">
              {SHOWCASE_BULLETS.map((b) => (
                <li key={b} className="flex items-center gap-3 text-[15.5px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green)]"><Check size={15} strokeWidth={2.5} /></span>
                  {b}
                </li>
              ))}
            </ul>
            <Button as="a" href={SIGN_UP_HREF} variant="primary">Start free trial</Button>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────── */}
        <section id="pricing" className="bg-muted py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHead eyebrow="Simple pricing" title="One simple price" sub="Start free, then go unlimited for €12 a year." />
            <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
              <PlanCard plan={PRICING.free} href={SIGN_UP_HREF} />
              <PlanCard plan={PRICING.pro} href={SIGN_UP_HREF} highlighted />
            </div>
          </div>
        </section>

        {/* ── Testimonial ───────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
          <div className="mb-5 flex justify-center gap-1 text-primary">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={20} fill="currentColor" strokeWidth={0} />)}
          </div>
          <blockquote className="font-[family-name:var(--display)] text-[24px] font-semibold leading-[1.35] text-foreground md:text-[30px]">
            {"\"We set up our whole menu in an afternoon. Updating specials used to mean reprinting everything. Now it takes ten seconds from my phone, and guests love the photos.\""}
          </blockquote>
          <div className="mt-7 flex items-center justify-center gap-3.5">
            <Image src={AVATAR_IMAGE} alt="Maria Alvarez" width={52} height={52} className="size-[52px] rounded-full object-cover" />
            <div className="text-left">
              <p className="text-[16px] font-bold text-foreground">Maria Alvarez</p>
              <p className="text-[14px] text-muted-foreground">Owner, Café Verde</p>
            </div>
          </div>
        </section>

        {/* ── CTA band ──────────────────────────────────────── */}
        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[28px] bg-[var(--ink)] px-8 py-16 text-center text-[var(--paper)]">
            <h2 className="text-[32px] leading-[1.1] text-[var(--paper)] md:text-[44px]">Ready to put your menu online?</h2>
            <p className="max-w-xl text-[16px] leading-[1.6] text-[var(--paper)]/75">
              {"Join 1,200+ restaurants already using iedora. It's free to start, and you don't need a card."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <Button as="a" href={SIGN_UP_HREF} variant="primary" size="lg">Get started free</Button>
              <Button as="a" href={SIGN_IN_HREF} variant="ghost" size="lg" className="!text-[var(--paper)] !border-[color-mix(in_srgb,var(--paper)_30%,transparent)]">Book a demo</Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary font-[family-name:var(--display)] text-[15px] font-extrabold text-white">i</span>
              <span className="font-[family-name:var(--display)] text-[18px] font-extrabold text-foreground">iedora</span>
            </div>
            <p className="max-w-xs text-[14px] leading-[1.55] text-muted-foreground">
              Simple online menus for restaurants.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <p className="font-[family-name:var(--display)] text-[13px] font-bold tracking-[0.04em] text-foreground">{col.heading}</p>
              {col.links.map((l) => (
                <a key={l} href="#" className="text-[14px] text-muted-foreground no-underline transition-colors hover:text-foreground">{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <p className="text-[13px] text-muted-foreground">© 2026 iedora. All rights reserved.</p>
            <div className="flex items-center gap-4 text-muted-foreground">
              {SOCIALS.map((s) => (
                <a key={s.name} href="#" aria-label={s.name} className="transition-colors hover:text-foreground">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">{s.path}</svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-2xl text-[32px] leading-[1.12] md:text-[42px]">{title}</h2>
      {sub ? <p className="max-w-xl text-[16px] leading-[1.55] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function PlanCard({
  plan,
  href,
  highlighted = false,
}: {
  plan: { tier: string; price: string; sub: string; desc: string; feats: string[]; cta: string; badge?: string };
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`relative flex flex-col gap-5 rounded-[18px] border bg-card p-7 ${highlighted ? "border-2 border-primary shadow-[0_20px_44px_-14px_var(--cinnabar-16)]" : "border-border"}`}>
      {plan.badge ? (
        <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white">{plan.badge}</span>
      ) : null}
      <div>
        <p className="font-[family-name:var(--display)] text-[17px] font-bold text-foreground">{plan.tier}</p>
        <p className="text-[13px] text-muted-foreground">{plan.desc}</p>
      </div>
      <p className="flex items-baseline gap-1">
        <span className="font-[family-name:var(--display)] text-[44px] font-extrabold tracking-[-0.02em] text-foreground">{plan.price}</span>
        <span className="text-[15px] text-muted-foreground">{plan.sub}</span>
      </p>
      <Button as="a" href={href} variant={highlighted ? "primary" : "secondary"} className="!w-full !justify-center">{plan.cta}</Button>
      <ul className="flex flex-col gap-2.5">
        {plan.feats.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[14.5px]">
            <Check size={16} strokeWidth={2.5} className="shrink-0 text-[var(--green)]" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
