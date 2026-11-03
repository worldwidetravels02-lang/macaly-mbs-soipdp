import { createFileRoute } from '@tanstack/react-router'
import { AuthPanel } from '../components/auth-panel'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/register']

export const Route = createFileRoute('/register')({
  head: () => {
    const canonical = canonicalUrl('/register')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div className="hidden lg:block">
            <div className="relative">
              <div aria-hidden="true" className="absolute -left-4 -top-4 h-full w-full border border-brass/40" />
              <img
                src={IMAGES.detail}
                alt="Travertine and bronze facade detail with a palm shadow"
                className="relative aspect-[4/5] w-full object-cover"
              />
            </div>
            <ul className="mt-8 space-y-3 text-sm text-ink-soft">
              {[
                'Save residences and receive private preview invitations',
                'Track your booking and download allotment papers',
                'Reach your concierge and raise service requests',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-2 h-px w-6 shrink-0 bg-brass" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <AuthPanel mode="register" />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
