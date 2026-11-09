import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthPanel } from '../components/auth-panel'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/login']

export const Route = createFileRoute('/login')({
  head: () => {
    const canonical = canonicalUrl('/login')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div className="hidden lg:block">
            <div className="relative">
              <div aria-hidden="true" className="absolute -left-4 -top-4 h-full w-full border border-brass/40" />
              <img
                src={IMAGES.living}
                alt="Msheireb residence living room looking out over the water"
                className="relative aspect-[4/5] w-full object-cover"
              />
            </div>
            <p className="display mt-8 max-w-sm text-2xl italic leading-snug">
              “Sign in to track your booking, download papers and reach your concierge.”
            </p>
          </div>

          <div>
            <AuthPanel mode="login" />
            <p className="mt-6 text-center text-xs text-ink-soft">
              Administrator? <Link to="/admin/login" className="text-brass underline underline-offset-4">Go to admin login</Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
