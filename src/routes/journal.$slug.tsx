import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']

export const Route = createFileRoute('/journal/$slug')({
  head: ({ params }) => {
    const canonical = canonicalUrl(`/journal/${params.slug}`)
    return {
      meta: [
        { title: `Journal | ${meta.brand}` },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: ArticlePage,
})

function ArticlePage() {
  const { slug } = Route.useParams()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-32 sm:px-8">
        <p className="eyebrow text-brass">Journal</p>
        <h1 className="display mt-4 text-3xl">This article is not available yet.</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          The article “{slug}” has not been published. Please return to the journal for future updates.
        </p>
        <Link to="/journal" className="eyebrow mt-8 inline-flex border border-border px-5 py-3">Back to journal</Link>
      </main>
      <SiteFooter />
    </div>
  )
}
