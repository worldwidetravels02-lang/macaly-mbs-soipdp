import { createFileRoute, Link } from '@tanstack/react-router'
import { usePreloadedQuery, useQuery } from 'convex/react'
import type { Preloaded } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { preloadQuery } from '@/lib/convex'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import { formatDate } from '../lib/format'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']

type JournalArticle = {
  _id: string
  title: string
  slug: string
  category: string
  excerpt: string
  content: string
  coverImage: string | null
  authorName: string
  publishedAt: number
  updatedAt: number
}

/** Reads the preloaded payload once on the server so the page can carry article SEO tags. */
function readHeadline(valueJSON: string): { title: string; excerpt: string; coverImage: string | null } | null {
  try {
    const parsed = JSON.parse(valueJSON) as JournalArticle | null
    if (!parsed) return null
    return { title: parsed.title, excerpt: parsed.excerpt, coverImage: parsed.coverImage }
  } catch {
    return null
  }
}

export const Route = createFileRoute('/journal/$slug')({
  loader: async ({ params }) => {
    try {
      const preloadedArticle = await preloadQuery(api.posts.getBySlug, { slug: params.slug })
      return { preloadedArticle, headline: readHeadline(preloadedArticle._valueJSON) }
    } catch (error) {
      console.error('Could not preload journal article', error)
      return { preloadedArticle: null, headline: null }
    }
  },
  head: ({ params, loaderData }) => {
    const headline = loaderData?.headline ?? null
    const title = headline ? `${headline.title} | ${meta.brand}` : `Journal | ${meta.brand}`
    const description = headline?.excerpt ?? meta.description
    const canonical = canonicalUrl(`/journal/${params.slug}`)
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        ...(headline?.coverImage ? [{ property: 'og:image', content: headline.coverImage }] : []),
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: ArticlePage,
})

function ArticlePage() {
  const { slug } = Route.useParams()
  const { preloadedArticle } = Route.useLoaderData()
  return preloadedArticle ? (
    <ArticlePreloaded preloaded={preloadedArticle} slug={slug} />
  ) : (
    <ArticleLive slug={slug} />
  )
}

function ArticlePreloaded({
  preloaded,
  slug,
}: {
  preloaded: Preloaded<typeof api.posts.getBySlug>
  slug: string
}) {
  const article = usePreloadedQuery(preloaded)
  return <ArticleView article={article as JournalArticle | null | undefined} slug={slug} />
}

function ArticleLive({ slug }: { slug: string }) {
  const article = useQuery(api.posts.getBySlug, { slug })
  return <ArticleView article={article as JournalArticle | null | undefined} slug={slug} />
}

function ArticleView({ article, slug }: { article: JournalArticle | null | undefined; slug: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <Link
            to="/journal"
            className="eyebrow inline-flex items-center gap-2 text-[0.5rem] text-ink-soft transition-colors hover:text-brass"
          >
            Journal
          </Link>

          {article === undefined ? (
            <div
              data-testid="article-loading"
              data-state="loading"
              className="mt-8 border border-border bg-card p-10 text-center text-sm text-ink-soft"
            >
              Loading article…
            </div>
          ) : article === null ? (
            <div data-testid="article-missing" data-state="ready" className="mt-8 border border-border bg-card p-10">
              <h1 className="display text-2xl">This article is not published</h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                The link “/journal/{slug}” has no published article behind it. It may have been
                unpublished or renamed.
              </p>
              <Link
                to="/journal"
                className="eyebrow mt-8 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85"
              >
                Back to the journal
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <article data-testid="article-content" data-state="ready" className="mt-6">
              <p className="eyebrow text-[0.5rem] text-brass">
                {article.category} · {formatDate(article.publishedAt)}
              </p>
              <h1 className="display mt-4 text-[clamp(2rem,4.6vw,3.2rem)] leading-tight">{article.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{article.excerpt}</p>
              <p className="mt-4 text-xs text-ink-soft">By {article.authorName}</p>

              {article.coverImage ? (
                <img
                  src={article.coverImage}
                  alt=""
                  className="mt-10 aspect-[16/9] w-full object-cover"
                  loading="eager"
                />
              ) : null}

              <div className="mt-10 border-t border-border pt-8">
                <ArticleBody content={article.content} />
              </div>

              <AdjacentArticles slug={article.slug} />

              <footer className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
                <p>Last updated {formatDate(article.updatedAt)}</p>
                <Link to="/journal" className="eyebrow text-[0.5rem] transition-colors hover:text-brass">
                  More from the journal
                </Link>
              </footer>
            </article>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** Previous and next published articles, so readers can keep reading. */
function AdjacentArticles({ slug }: { slug: string }) {
  const adjacent = useQuery(api.posts.getAdjacent, { slug })

  if (!adjacent || (!adjacent.previous && !adjacent.next)) return null

  return (
    <nav
      aria-label="More articles"
      data-testid="article-adjacent"
      data-state="ready"
      className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
    >
      {adjacent.previous ? (
        <Link
          to="/journal/$slug"
          params={{ slug: adjacent.previous.slug }}
          data-testid="article-previous"
          className="group border border-border bg-card p-6 transition-colors hover:border-brass/60"
        >
          <span className="eyebrow text-[0.45rem] text-brass">Previous article</span>
          <span className="display mt-3 block text-lg leading-snug transition-colors group-hover:text-brass">
            {adjacent.previous.title}
          </span>
        </Link>
      ) : null}

      {adjacent.next ? (
        <Link
          to="/journal/$slug"
          params={{ slug: adjacent.next.slug }}
          data-testid="article-next"
          className="group border border-border bg-card p-6 transition-colors hover:border-brass/60 sm:col-start-2 sm:text-right"
        >
          <span className="eyebrow text-[0.45rem] text-brass">Next article</span>
          <span className="display mt-3 block text-lg leading-snug transition-colors group-hover:text-brass">
            {adjacent.next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  )
}

/** Small plain-text renderer: ## headings, - lists and blank-line paragraphs. */
function ArticleBody({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/)

  return (
    <div className="max-w-none space-y-5 text-[1.02rem] leading-relaxed text-ink-soft">
      {blocks.map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
        if (lines.length === 0) return null

        if (lines[0].startsWith('## ')) {
          return (
            <h2 key={index} className="display pt-4 text-2xl text-foreground">
              {lines[0].slice(3)}
            </h2>
          )
        }

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>{line.slice(2)}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={index} className="whitespace-pre-line">
            {lines.join(' ')}
          </p>
        )
      })}
    </div>
  )
}
