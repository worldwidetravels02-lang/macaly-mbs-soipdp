import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import { formatDate } from '../lib/format'
import { requireSupabase } from '../lib/supabase-client'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']
type JournalPost = { id: string; title: string; slug: string; category: string; excerpt: string; cover_image_url: string | null; author_name: string; published_at: string | null; created_at: string }

export const Route = createFileRoute('/journal/')({
  head: () => {
    const canonical = canonicalUrl('/journal')
    return { meta: [{ title: meta.title }, { name: 'description', content: meta.description }, { property: 'og:title', content: meta.title }, { property: 'og:description', content: meta.description }, { property: 'og:type', content: 'website' }], links: canonical ? [{ rel: 'canonical', href: canonical }] : [] }
  },
  component: JournalPage,
})

function JournalPage() {
  const [posts, setPosts] = useState<JournalPost[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    void requireSupabase().from('posts').select('id,title,slug,category,excerpt,cover_image_url,author_name,published_at,created_at').eq('published', true).order('published_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return
      if (error) { console.error('Could not load journal posts', error); setFailed(true); setPosts([]); return }
      setPosts((data ?? []) as JournalPost[])
    }).catch((error) => { console.error('Could not load journal posts', error); if (active) { setFailed(true); setPosts([]) } })
    return () => { active = false }
  }, [])
  const [lead, ...rest] = posts ?? []
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main"><PageIntro eyebrow="Journal" title="Notes on building, living and investing in Dubai." intro="Market letters, design notes and neighbourhood guides from the Msheireb editorial desk. New articles appear here as soon as they are published." image={IMAGES.detail} imageAlt="Travertine and bronze detail in afternoon light" />
    <section className="py-16 sm:py-24"><div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      {posts === undefined ? <div data-testid="journal-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Loading articles…</div> : posts.length === 0 ? <div data-testid="journal-empty" className="border border-border bg-card px-6 py-14 text-center"><p className="eyebrow text-[0.55rem] text-brass">{failed ? 'Journal temporarily unavailable' : 'No articles yet'}</p><h2 className="display mt-4 text-2xl sm:text-3xl">{failed ? 'Please visit again shortly.' : 'The first issue is being written.'}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">Published articles from the admin panel appear here with their own page and link.</p><Link to="/contact" className="eyebrow mt-8 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground">Talk to the team <ArrowRight className="h-3.5 w-3.5" /></Link></div> : <div data-testid="journal-list" className="grid gap-14">
        {lead ? <Reveal><Link to="/journal/$slug" params={{ slug: lead.slug }} className="group grid gap-8 border border-border bg-card transition-colors hover:border-brass/60 lg:grid-cols-[1.1fr_1fr]"><div className="relative min-h-56 overflow-hidden bg-deep">{lead.cover_image_url ? <img src={lead.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="p-8 display text-5xl text-brass-soft/40">{lead.category}</div>}</div><div className="flex flex-col justify-center gap-4 p-7 sm:p-10"><p className="eyebrow text-[0.5rem] text-brass">{lead.category} · {formatDate(new Date(lead.published_at ?? lead.created_at).getTime())}</p><h2 className="display text-2xl leading-snug group-hover:text-brass sm:text-3xl">{lead.title}</h2><p className="text-sm leading-relaxed text-ink-soft">{lead.excerpt}</p><span className="eyebrow mt-2 inline-flex items-center gap-3 text-[0.55rem]">Read the article <ArrowRight className="h-3.5 w-3.5 text-brass" /></span></div></Link></Reveal> : null}
        {rest.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rest.map((post, index) => <Reveal key={post.id} delay={index * 60}><Link to="/journal/$slug" params={{ slug: post.slug }} className="group flex h-full flex-col border border-border bg-card hover:border-brass/60"><div className="aspect-[16/10] overflow-hidden bg-bone">{post.cover_image_url ? <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center bg-deep"><span className="display text-3xl text-brass-soft/40">{post.category}</span></div>}</div><div className="flex flex-1 flex-col gap-3 p-6"><p className="eyebrow text-[0.45rem] text-brass">{post.category} · {formatDate(new Date(post.published_at ?? post.created_at).getTime())}</p><h3 className="display text-lg leading-snug group-hover:text-brass">{post.title}</h3><p className="text-sm leading-relaxed text-ink-soft">{post.excerpt}</p><span className="eyebrow mt-auto pt-3 text-[0.5rem] text-ink-soft">{post.author_name}</span></div></Link></Reveal>)}</div> : null}
      </div>}
    </div></section></main><SiteFooter /></div>
}
