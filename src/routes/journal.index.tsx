import { createFileRoute, Link } from '@tanstack/react-router'
import { usePreloadedQuery, useQuery } from 'convex/react'
import type { Preloaded } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { preloadQuery } from '@/lib/convex'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import { formatDate } from '../lib/format'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']

type JournalPost = {
  _id: string
  title: string
  slug: string
  category: string
  excerpt: string
  coverImage: string | null
  authorName: string
  publishedAt: number
}

export const Route = createFileRoute('/journal/')({
  loader: async () => {
    try {
      const preloadedPosts = await preloadQuery(api.posts.listPublished, {})
      return { preloadedPosts }
    } catch (error) {
      console.error('Could not preload journal articles', error)
      return { preloadedPosts: null }
    }
  },
  head: () => {
    const canonical = canonicalUrl('/journal')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { property: 'og:title', content: meta.title },
        { property: 'og:description', content: meta.description },
        { property: 'og:type', content: 'website' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: JournalPage,
})

function JournalPage() {
  const { preloadedPosts } = Route.useLoaderData()
  return preloadedPosts ? (
    <JournalPreloaded preloaded={preloadedPosts} />
  ) : (
    <JournalLive />
  )
}

function JournalPreloaded({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.posts.listPublished>
}) {
  const posts = usePreloadedQuery(preloaded)
  return <JournalList posts={posts as JournalPost[] | undefined} />
}

function JournalLive() {
  const posts = useQuery(api.posts.listPublished)
  return <JournalList posts={posts as JournalPost[] | undefined} />
}

function JournalList({ posts }: { posts: JournalPost[] | undefined }) {
  const [lead, ...rest] = posts ?? []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Journal"
          title="Notes on building, living and investing in Dubai."
          intro="Market letters, design notes and neighbourhood guides from the Msheireb editorial desk. New articles appear here as soon as they are published."
          image={IMAGES.detail}
          imageAlt="Travertine and bronze detail in afternoon light"
        />

        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            {posts === undefined ? (
              <div
                data-testid="journal-loading"
                data-state="loading"
                className="border border-border bg-card p-10 text-center text-sm text-ink-soft"
              >
                Loading articles…
              </div>
            ) : posts.length === 0 ? (
              <div
                data-testid="journal-empty"
                data-state="ready"
                className="border border-border bg-card px-6 py-14 text-center"
              >
                <p className="eyebrow text-[0.55rem] text-brass">No articles yet</p>
                <h2 className="display mt-4 text-2xl sm:text-3xl">The first issue is being written.</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
                  Once an article is published from the admin panel it appears here, with its own
                  page and link.
                </p>
                <Link
                  to="/contact"
                  className="eyebrow mt-8 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Talk to the team
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div data-testid="journal-list" data-state="ready" className="grid gap-14">
                {lead ? (
                  <Reveal>
                    <Link
                      to="/journal/$slug"
                      params={{ slug: lead.slug }}
                      data-testid={`journal-lead-${lead.slug}`}
                      className="group grid gap-8 border border-border bg-card transition-colors hover:border-brass/60 lg:grid-cols-[1.1fr_1fr] lg:items-stretch"
                    >
                      <div className="relative min-h-56 overflow-hidden bg-deep">
                        {lead.coverImage ? (
                          <img
                            src={lead.coverImage}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                            loading="eager"
                          />
                        ) : (
                          <div aria-hidden="true" className="flex h-full items-end p-8">
                            <span className="display text-6xl text-brass-soft/40">{lead.category}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
                        <p className="eyebrow text-[0.5rem] text-brass">
                          {lead.category} · {formatDate(lead.publishedAt)}
                        </p>
                        <h2 className="display text-2xl leading-snug transition-colors group-hover:text-brass sm:text-3xl">
                          {lead.title}
                        </h2>
                        <p className="text-sm leading-relaxed text-ink-soft">{lead.excerpt}</p>
                        <span className="eyebrow mt-2 inline-flex items-center gap-3 text-[0.55rem]">
                          Read the article
                          <ArrowRight className="h-3.5 w-3.5 text-brass" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ) : null}

                {rest.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post, index) => (
                      <Reveal key={post._id} delay={index * 60}>
                        <Link
                          to="/journal/$slug"
                          params={{ slug: post.slug }}
                          data-testid={`journal-card-${post.slug}`}
                          className="group flex h-full flex-col border border-border bg-card transition-colors hover:border-brass/60"
                        >
                          <div className="aspect-[16/10] overflow-hidden bg-bone">
                            {post.coverImage ? (
                              <img
                                src={post.coverImage}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                                loading="lazy"
                              />
                            ) : (
                              <div aria-hidden="true" className="flex h-full items-center justify-center bg-deep">
                                <span className="display text-3xl text-brass-soft/40">{post.category}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-3 p-6">
                            <p className="eyebrow text-[0.45rem] text-brass">
                              {post.category} · {formatDate(post.publishedAt)}
                            </p>
                            <h3 className="display text-lg leading-snug transition-colors group-hover:text-brass">
                              {post.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>
                            <span className="eyebrow mt-auto pt-3 text-[0.5rem] text-ink-soft">
                              {post.authorName}
                            </span>
                          </div>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
