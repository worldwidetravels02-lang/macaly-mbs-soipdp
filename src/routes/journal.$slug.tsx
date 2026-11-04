import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import { formatDate } from '../lib/format'
import { requireSupabase } from '../lib/supabase-client'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']
type JournalArticle = { id: string; title: string; slug: string; category: string; excerpt: string; content: string; cover_image_url: string | null; author_name: string; published_at: string | null; updated_at: string; created_at: string }
type Adjacent = { previous: { slug: string; title: string } | null; next: { slug: string; title: string } | null }

export const Route = createFileRoute('/journal/$slug')({
  head: ({ params }) => { const canonical = canonicalUrl('/journal/' + params.slug); return { meta: [{ title: 'Journal | ' + meta.brand }, { name: 'description', content: meta.description }, { property: 'og:type', content: 'article' }], links: canonical ? [{ rel: 'canonical', href: canonical }] : [] } },
  component: ArticlePage,
})

function ArticlePage() {
  const { slug } = Route.useParams()
  const [article, setArticle] = useState<JournalArticle | null | undefined>(undefined)
  const [adjacent, setAdjacent] = useState<Adjacent>({ previous: null, next: null })
  useEffect(() => {
    let active = true
    void requireSupabase().from('posts').select('*').eq('slug', slug).eq('published', true).maybeSingle().then(async ({ data, error }) => {
      if (!active) return
      if (error) { console.error('Could not load journal article', error); setArticle(null); return }
      const item = data as JournalArticle | null
      setArticle(item)
      if (!item) return
      const { data: list } = await requireSupabase().from('posts').select('slug,title,published_at,created_at').eq('published', true).order('published_at', { ascending: false })
      if (!active || !list) return
      const ordered = list as Array<{ slug: string; title: string; published_at: string | null; created_at: string }>
      const index = ordered.findIndex((post) => post.slug === slug)
      setAdjacent({ previous: index > 0 ? ordered[index - 1] : null, next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null })
    }).catch((error) => { console.error('Could not load journal article', error); if (active) setArticle(null) })
    return () => { active = false }
  }, [slug])
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main" className="pb-20 pt-28 sm:pt-36"><div className="mx-auto w-full max-w-3xl px-5 sm:px-8"><Link to="/journal" className="eyebrow inline-flex items-center gap-2 text-[0.5rem] text-ink-soft hover:text-brass">Journal</Link>
    {article === undefined ? <div data-testid="article-loading" className="mt-8 border border-border bg-card p-10 text-center text-sm text-ink-soft">Loading article…</div> : article === null ? <div data-testid="article-missing" className="mt-8 border border-border bg-card p-10"><h1 className="display text-2xl">This article is not published</h1><p className="mt-3 text-sm leading-relaxed text-ink-soft">This article may have been unpublished or renamed.</p><Link to="/journal" className="eyebrow mt-8 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground">Back to the journal <ArrowRight className="h-3.5 w-3.5" /></Link></div> : <article data-testid="article-content" className="mt-6"><p className="eyebrow text-[0.5rem] text-brass">{article.category} · {formatDate(new Date(article.published_at ?? article.created_at).getTime())}</p><h1 className="display mt-4 text-[clamp(2rem,4.6vw,3.2rem)] leading-tight">{article.title}</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{article.excerpt}</p><p className="mt-4 text-xs text-ink-soft">By {article.author_name}</p>{article.cover_image_url ? <img src={article.cover_image_url} alt="" className="mt-10 aspect-[16/9] w-full object-cover" /> : null}<div className="mt-10 border-t border-border pt-8"><ArticleBody content={article.content} /></div><AdjacentArticles adjacent={adjacent} /><footer className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between"><p>Last updated {formatDate(new Date(article.updated_at).getTime())}</p><Link to="/journal" className="eyebrow text-[0.5rem] hover:text-brass">More from the journal</Link></footer></article>}
  </div></main><SiteFooter /></div>
}

function AdjacentArticles({ adjacent }: { adjacent: Adjacent }) {
  if (!adjacent.previous && !adjacent.next) return null
  return <nav aria-label="More articles" data-testid="article-adjacent" className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">{adjacent.previous ? <Link to="/journal/$slug" params={{ slug: adjacent.previous.slug }} className="group border border-border bg-card p-6 hover:border-brass/60"><span className="eyebrow text-[0.45rem] text-brass">Previous article</span><span className="display mt-3 block text-lg group-hover:text-brass">{adjacent.previous.title}</span></Link> : null}{adjacent.next ? <Link to="/journal/$slug" params={{ slug: adjacent.next.slug }} className="group border border-border bg-card p-6 hover:border-brass/60 sm:col-start-2 sm:text-right"><span className="eyebrow text-[0.45rem] text-brass">Next article</span><span className="display mt-3 block text-lg group-hover:text-brass">{adjacent.next.title}</span></Link> : null}</nav>
}

function ArticleBody({ content }: { content: string }) {
  const blocks = content.replace(/\\r\\n/g, '\\n').split(/\\n{2,}/)
  return <div className="max-w-none space-y-5 text-[1.02rem] leading-relaxed text-ink-soft">{blocks.map((block, index) => { const lines = block.split('\\n').map((line) => line.trim()).filter(Boolean); if (!lines.length) return null; if (lines[0].startsWith('## ')) return <h2 key={index} className="display pt-4 text-2xl text-foreground">{lines[0].slice(3)}</h2>; if (lines.every((line) => line.startsWith('- '))) return <ul key={index} className="list-disc space-y-2 pl-5">{lines.map((line, itemIndex) => <li key={itemIndex}>{line.slice(2)}</li>)}</ul>; return <p key={index} className="whitespace-pre-line">{lines.join(' ')}</p> })}</div>
}
