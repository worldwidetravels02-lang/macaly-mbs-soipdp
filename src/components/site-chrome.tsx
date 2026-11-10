import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RESIDENCES, RESIDENCE_PATHS, SITE } from '../data/site'
import { formatAed } from '../lib/format'

export function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 12h15M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <path d="M11 49V15h9l12 16 12-16h9v34h-9V28.5L32 44.5 20 28.5V49z" fill="currentColor" />
      <rect x="22" y="53.5" width="20" height="2.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5 text-[#172238]">
      <span className="flex min-w-0 flex-col items-end leading-none">
        <span lang="ar" dir="rtl" className="font-serif text-[1.05rem] font-semibold tracking-normal sm:text-[1.2rem]">مشيرب العقارية</span>
        <span className="mt-1 font-serif text-[0.68rem] font-semibold uppercase tracking-[0.055em] sm:text-[0.78rem]">MSHEIREB PROPERTIES</span>
      </span>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="h-10 w-10 shrink-0 text-[#b69a5b] sm:h-12 sm:w-12">
        <g fill="currentColor">
          <path d="M26 2h12l4 14H22z"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(45 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(90 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(135 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(180 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(225 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(270 32 32)"/>
          <path d="M26 2h12l4 14H22z" transform="rotate(315 32 32)"/>
        </g>
        <circle cx="32" cy="32" r="10" fill="currentColor"/>
        <circle cx="32" cy="32" r="5" fill="white"/>
      </svg>
    </span>
  )
}

const NAV_LINKS = [
  { label: 'Residences', to: '/residences' },
  { label: 'Amenities', to: '/amenities' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
] as const

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [language, setLanguage] = useState('EN')
  const [currency, setCurrency] = useState('AED')
  const wallet = null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('msheireb-language')
    const savedCurrency = window.localStorage.getItem('msheireb-currency')
    if (savedLanguage === 'EN' || savedLanguage === 'AR') setLanguage(savedLanguage)
    if (['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR'].includes(savedCurrency ?? '')) setCurrency(savedCurrency!)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('msheireb-language', language)
    window.localStorage.setItem('msheireb-currency', currency)
  }, [language, currency])

  const solid = scrolled || !overlay
  const tone = solid ? 'text-foreground' : 'text-on-deep'

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        solid
          ? 'border-b border-border bg-background/95 py-3 backdrop-blur-md'
          : 'border-b border-on-deep/10 bg-transparent py-4 sm:py-6',
      ].join(' ')}
    >
      <div className={`mx-auto flex w-full max-w-7xl items-center justify-between px-5 sm:px-8 ${tone}`}>
        <Link to="/" className="flex items-center transition-opacity hover:opacity-80" aria-label="Msheireb Properties, home">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              data-testid={`nav-${link.label.toLowerCase()}`}
              className="eyebrow text-[0.6rem] opacity-80 transition-opacity hover:opacity-100"
              activeProps={{ className: 'text-brass opacity-100' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <label className="sr-only" htmlFor="site-language">Language</label>
          <select id="site-language" aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value)} className="eyebrow max-w-16 cursor-pointer border border-current/25 bg-transparent px-2 py-2 text-[0.52rem]">
            <option value="EN">EN</option>
            <option value="AR">AR</option>
          </select>
          <label className="sr-only" htmlFor="site-currency">Currency</label>
          <select id="site-currency" aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="eyebrow cursor-pointer border border-current/25 bg-transparent px-2 py-2 text-[0.52rem]">
            {['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR'].map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          {wallet ? (
            <Link
              to="/dashboard"
              data-testid="header-wallet"
              className="flex items-center gap-3 border border-current/30 px-4 py-2 transition-colors hover:border-brass"
            >
              <span className="text-left leading-tight">
                <span className="eyebrow block text-[0.42rem] opacity-70">My area</span>
                <span className="display block text-sm">Dashboard</span>
              </span>
              <span className="eyebrow border-l border-current/25 pl-3 text-[0.45rem] text-brass">
                L{wallet.tier.level}
              </span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="header-login"
                className="eyebrow auth-link text-[0.6rem] opacity-80 transition-opacity hover:opacity-100"
              >
                Login
              </Link>
              <Link
                to="/register"
                data-testid="header-signup"
                className="eyebrow group inline-flex items-center gap-2 border border-current/35 px-5 py-3 text-[0.58rem] transition-colors hover:border-brass hover:text-brass"
              >
                <span className="cta-sheen inline-flex items-center gap-2">
                  Sign up
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </>
          )}
          <Link
            to="/contact"
            className={[
              'eyebrow inline-flex items-center gap-2 px-5 py-3 text-[0.58rem] transition-colors',
              solid
                ? 'bg-primary text-primary-foreground hover:bg-ink/85'
                : 'bg-on-deep text-deep hover:bg-brass hover:text-deep',
            ].join(' ')}
          >
            Book a visit
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          data-testid="menu-toggle"
          className="inline-flex items-center justify-center border border-current/40 p-2.5 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            ) : (
              <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div
          id="mobile-menu"
          data-testid="mobile-menu"
          className="mt-4 border-t border-border bg-background px-5 pb-7 pt-5 text-foreground lg:hidden"
        >
          <div className="mb-5 flex gap-3">
            <label className="flex flex-1 flex-col gap-2">
              <span className="eyebrow text-[0.5rem] text-brass">Language</span>
              <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value)} className="border border-border bg-background px-3 py-3 text-sm">
                <option value="EN">English</option>
                <option value="AR">العربية</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-2">
              <span className="eyebrow text-[0.5rem] text-brass">Currency</span>
              <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="border border-border bg-background px-3 py-3 text-sm">
                {['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR'].map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
          </div>
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="display border-b border-border py-4 text-2xl"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            {wallet ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  data-testid="mobile-wallet"
                  className="flex items-center justify-between border border-brass/50 bg-brass/5 px-5 py-4"
                >
                  <span>
                    <span className="eyebrow block text-[0.45rem] text-ink-soft">My area</span>
                    <span className="display block text-lg">Dashboard</span>
                  </span>
                  <span className="eyebrow text-[0.5rem] text-brass">{wallet.tier.name}</span>
                </Link>
                <Link
                  to="/account"
                  onClick={() => setMenuOpen(false)}
                  className="eyebrow flex items-center justify-between border border-border px-5 py-4 text-[0.6rem]"
                >
                  My account
                  <ArrowRight />
                </Link>
              </>
            ) : null}
            <Link
              to="/contact"
              onClick={() => setMenuOpen(false)}
              className="eyebrow flex items-center justify-between bg-primary px-5 py-4 text-[0.6rem] text-primary-foreground"
            >
              Book a visit
              <ArrowRight />
            </Link>
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="eyebrow flex items-center justify-between border border-border px-5 py-4 text-[0.6rem]"
            >
              Login
              <ArrowRight />
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              data-testid="mobile-signup"
              className="eyebrow flex items-center justify-between border border-brass px-5 py-4 text-[0.6rem] text-brass"
            >
              Create account
              <ArrowRight />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-deep pb-10 pt-16 text-on-deep sm:pt-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 border-b border-on-deep/15 pb-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Wordmark />
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-on-deep/60">
              Luxury residential addresses across Dubai. Built slowly, in fewer places, with the
              people who live there in mind.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
            <div>
              <p className="eyebrow text-[0.5rem] text-brass-soft">Residences</p>
              <ul className="mt-4 space-y-3 text-sm text-on-deep/70">
                {RESIDENCES.map((residence) => (
                  <li key={residence.slug}>
                    <Link
                      to={RESIDENCE_PATHS[residence.slug]}
                      className="transition-colors hover:text-brass-soft"
                    >
                      {residence.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[0.5rem] text-brass-soft">Company</p>
              <ul className="mt-4 space-y-3 text-sm text-on-deep/70">
                <li>
                  <Link to="/about" className="transition-colors hover:text-brass-soft">
                    About Msheireb
                  </Link>
                </li>
                <li>
                  <Link to="/amenities" className="transition-colors hover:text-brass-soft">
                    Amenities
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="transition-colors hover:text-brass-soft">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/account" className="transition-colors hover:text-brass-soft">
                    Member account
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="transition-colors hover:text-brass-soft">
                    Customer service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[0.5rem] text-brass-soft">Legal</p>
              <ul className="mt-4 space-y-3 text-sm text-on-deep/70">
                <li>
                  <Link to="/privacy" className="transition-colors hover:text-brass-soft">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="transition-colors hover:text-brass-soft">
                    Terms of use
                  </Link>
                </li>
                <li>
                  <Link to="/terms" hash="rera" className="transition-colors hover:text-brass-soft">
                    RERA disclosures
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-4 text-xs text-on-deep/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>
            {SITE.city} · {SITE.country}
          </p>
        </div>
      </div>
    </footer>
  )
}

export function PageIntro({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
}: {
  eyebrow: string
  title: string
  intro: string
  image?: string
  imageAlt?: string
}) {
  return (
    <section className="relative isolate overflow-hidden bg-deep pb-16 pt-32 text-on-deep sm:pb-20 sm:pt-40">
      {image ? (
        <>
          <img src={image} alt={imageAlt ?? ''} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden="true" className="hero-veil absolute inset-0 -z-10" />
        </>
      ) : null}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <p className="eyebrow text-brass-soft">{eyebrow}</p>
        <h1 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.2vw,4rem)]">{title}</h1>
        <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-on-deep/75">{intro}</p>
      </div>
    </section>
  )
}
