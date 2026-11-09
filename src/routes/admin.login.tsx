import { createFileRoute } from '@tanstack/react-router'
import { AuthPanel } from '../components/auth-panel'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'

export const Route = createFileRoute('/admin/login')({
  head: () => {
    const canonical = canonicalUrl('/admin/login')
    return {
      meta: [
        { title: 'Administrator Login | Msheireb Properties' },
        { name: 'description', content: 'Secure administrator access for Msheireb Properties.' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AdminLoginPage,
})

function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto grid w-full max-w-3xl gap-8 px-5 sm:px-8">
          <div>
            <p className="eyebrow text-brass">Restricted access</p>
            <h1 className="display mt-3 text-3xl sm:text-4xl">Administrator login</h1>
            <p className="mt-3 text-sm leading-7 text-ink-soft">This sign-in is reserved for approved administrators. Customer accounts cannot enter the administration workspace.</p>
          </div>
          <AuthPanel mode="login" adminOnly />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
