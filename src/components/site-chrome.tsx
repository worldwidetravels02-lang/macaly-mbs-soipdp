import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RESIDENCES, RESIDENCE_PATHS, SITE } from '../data/site'
import { requireSupabase } from '../lib/supabase-client'

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
    <span className="flex items-center gap-3">
      <span className="text-brass">
        <BrandMark className="h-8 w-8" />
      </span>
      <span className="leading-none">
        <span className="display block text-[1.28rem] tracking-[0.2em] sm:text-[1.4rem]">MSHEIREB</span>
        <span className="eyebrow mt-1 block text-[0.52rem] opacity-70">Properties</span>
      </span>
    </span>
  )
}

const NAV_LINKS = [
  { label: 'Residences', to: '/residences' },
  { label: 'Amenities', to: '/amenities' },
  { label: 'Journal', to: '/journal' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
] as const

const ARABIC_LABELS: Record<string, string> = {
  Residences: 'المساكن', Amenities: 'المرافق', Journal: 'المجلة', About: 'من نحن', Contact: 'اتصل بنا',
  Language: 'اللغة', Currency: 'العملة', Login: 'تسجيل الدخول', 'Sign up': 'إنشاء حساب',
  'Book a visit': 'احجز زيارة', 'Create account': 'إنشاء حساب', 'Explore residences': 'استكشف المساكن',
  'Member login': 'دخول الأعضاء',
}

function translateSiteLabel(label: string, language: string): string {
  return language === 'AR' ? (ARABIC_LABELS[label] ?? label) : label
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [language, setLanguage] = useState('EN')
  const [currency, setCurrency] = useState('AED')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const client = requireSupabase()
    let active = true
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Could not check header session:', error.message)
      setIsAuthenticated(Boolean(data.session?.user))
    }).catch((error) => {
      if (active) console.error('Could not check header session:', error)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    try {
      const savedLanguage = window.localStorage.getItem('msheireb-language')
      const savedCurrency = window.localStorage.getItem('msheireb-currency')
      if (savedLanguage === 'EN' || savedLanguage === 'AR') {
        setLanguage(savedLanguage)
        document.documentElement.lang = savedLanguage.toLowerCase()
        document.documentElement.dir = savedLanguage === 'AR' ? 'rtl' : 'ltr'
      }
      if (['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR'].includes(savedCurrency ?? '')) {
        setCurrency(savedCurrency!)
      }
    } catch {
      // Preferences remain usable for this page even when storage is unavailable.
    }
  }, [])

  const changeLanguage = (value: string) => {
    if (value !== 'EN' && value !== 'AR') return
    setLanguage(value)
    document.documentElement.lang = value.toLowerCase()
    document.documentElement.dir = value === 'AR' ? 'rtl' : 'ltr'
    try { window.localStorage.setItem('msheireb-language', value) } catch { /* optional */ }
  }

  const changeCurrency = (value: string) => {
    if (!['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR'].includes(value)) return
    setCurrency(value)
    try { window.localStorage.setItem('msheireb-currency', value) } catch { /* optional */ }
    window.dispatchEvent(new CustomEvent('msheireb-currency-change', { detail: value }))
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
              {translateSiteLabel(link.label, language)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <label className="sr-only" htmlFor="site-language">{translateSiteLabel('Language', language)}</label>
          <select id="site-language" aria-label="Language" value={language} onChange={(event) => changeLanguage(event.target.value)} className="eyebrow max-w-16 cursor-pointer border border-current/25 bg-transparent px-2 py-2 text-[0.52rem]">
            <option value="EN">EN</option>
            <option value="AR">AR</option>
          </select>
          <label className="sr-only" htmlFor="site-currency">{translateSiteLabel('Currency', language)}</label>
          <select id="site-currency" aria-label="Currency" value={currency} onChange={(event) => changeCurrency(event.target.value)} className="eyebrow cursor-pointer border border-current/25 bg-transparent px-2 py-2 text-[0.52rem]">
            {['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR'].map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          {isAuthenticated ? (
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
                Member
              </span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="header-login"
                className="eyebrow auth-link text-[0.6rem] opacity-80 transition-opacity hover:opacity-100"
              >
                {translateSiteLabel('Login', language)}
              </Link>
              <Link
                to="/register"
                data-testid="header-signup"
                className="eyebrow group inline-flex items-center gap-2 border border-current/35 px-5 py-3 text-[0.58rem] transition-colors hover:border-brass hover:text-brass"
              >
                <span className="cta-sheen inline-flex items-center gap-2">
                  {translateSiteLabel('Sign up', language)}
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
            {translateSiteLabel('Book a visit', language)}
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
              <span className="eyebrow text-[0.5rem] text-brass">{translateSiteLabel('Language', language)}</span>
              <select aria-label="Language" value={language} onChange={(event) => changeLanguage(event.target.value)} className="border border-border bg-background px-3 py-3 text-sm">
                <option value="EN">English</option>
                <option value="AR">العربية</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-2">
              <span className="eyebrow text-[0.5rem] text-brass">{translateSiteLabel('Currency', language)}</span>
              <select aria-label="Currency" value={currency} onChange={(event) => changeCurrency(event.target.value)} className="border border-border bg-background px-3 py-3 text-sm">
                {['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR'].map((code) => <option key={code} value={code}>{code}</option>)}
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
                {translateSiteLabel(link.label, language)}
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
                  <span className="eyebrow text-[0.5rem] text-brass">Member</span>
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
              {translateSiteLabel('Book a visit', language)}
              <ArrowRight />
            </Link>
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="eyebrow flex items-center justify-between border border-border px-5 py-4 text-[0.6rem]"
            >
              {translateSiteLabel('Login', language)}
              <ArrowRight />
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              data-testid="mobile-signup"
              className="eyebrow flex items-center justify-between border border-brass px-5 py-4 text-[0.6rem] text-brass"
            >
              {translateSiteLabel('Create account', language)}
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
                  <Link to="/journal" className="transition-colors hover:text-brass-soft">
                    Journal
                  </Link>
                </li>
                <li>
                  <Link to="/membership" className="transition-colors hover:text-brass-soft">
                    Membership levels
                  </Link>
                </li>
                <li>
                  <Link to="/account" className="transition-colors hover:text-brass-soft">
                    Member account
                  </Link>
                </li>
                <li>
                  <Link to="/wallet" className="transition-colors hover:text-brass-soft">
                    Investment wallet
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
