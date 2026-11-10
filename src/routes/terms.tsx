import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/terms']

export const Route = createFileRoute('/terms')({
  head: () => {
    const canonical = canonicalUrl('/terms')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: TermsPage,
})

function TermsPage() {
  const [pageContent, setPageContent] = useState<{ title: string; content: string } | null>(null)
  useEffect(() => {
    let active = true
    void requireSupabase().from('site_content').select('title,content').eq('slug', 'terms').eq('published', true).maybeSingle().then(({ data }) => {
      if (active && data?.content) setPageContent({ title: data.title, content: data.content })
    })
    return () => { active = false }
  }, [])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Legal"
          title={pageContent?.title || "Terms of use"}
          intro="The terms that apply when you browse this website, submit an enquiry or create a member account."
        />

        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            {pageContent ? <div className="whitespace-pre-wrap text-[1rem] leading-relaxed text-ink-soft">{pageContent.content}</div> : <div className="space-y-8 text-[1rem] leading-relaxed text-ink-soft">
              <div>
                <h2 className="display text-2xl text-foreground">Website content</h2>
                <p className="mt-3">
                  Images, plans and specifications on this site are illustrative. Dimensions, finishes
                  and handover dates may change during construction. Nothing on this site forms part of
                  an offer or contract; the sale agreement and its annexes govern each purchase.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">Member accounts</h2>
                <p className="mt-3">
                  You are responsible for keeping your password confidential and for the accuracy of
                  the details you register. Accounts are personal and may not be shared. We may suspend
                  an account that is used to submit false enquiries or to interfere with the site.
                </p>
              </div>
              <div id="rera" className="scroll-mt-28">
                <h2 className="display text-2xl text-foreground">RERA disclosures</h2>
                <p className="mt-3">
                  Projects are marketed in accordance with the regulations of the Real Estate
                  Regulatory Agency (RERA) of the Dubai Land Department. Project registration numbers,
                  escrow account details and the developer permit number are stated in the project
                  brochure and the sale and purchase agreement, and are available on request from the
                  sales gallery.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">Enquiries</h2>
                <p className="mt-3">
                  Submitting an enquiry does not reserve a residence. Availability, pricing and payment
                  plans are confirmed in writing by the {SITE.name} residential team.
                </p>
              </div>
              <p className="border-t border-border pt-6 text-sm">
                Questions about these terms can be raised through the contact page. {SITE.name},{' '}
                {SITE.address[0]}, {SITE.address[1]}.
              </p>
            </div>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
