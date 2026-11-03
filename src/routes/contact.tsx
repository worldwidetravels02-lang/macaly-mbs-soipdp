import { createFileRoute, Link } from '@tanstack/react-router'
import { EnquiryForm } from '../components/enquiry-form'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES, SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/contact']

export const Route = createFileRoute('/contact')({
  head: () => {
    const canonical = canonicalUrl('/contact')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: ContactPage,
})

function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Contact"
          title="Book a private preview."
          intro="Site visits are arranged by appointment, seven days a week. Share a few details and our residential team will follow up within one working day."
          image={IMAGES.living}
          imageAlt="Msheireb residence living room at golden hour"
        />

        <section className="py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-20">
            <Reveal className="lg:col-span-5">
              <h2 className="display text-[clamp(1.8rem,3vw,2.6rem)]">Sales gallery</h2>
              <dl className="mt-8 space-y-6 border-t border-border pt-8">
                <div>
                  <dt className="eyebrow text-[0.5rem] text-ink-soft">Address</dt>
                  <dd className="mt-2 text-[0.98rem] leading-relaxed">
                    {SITE.address[0]}
                    <br />
                    {SITE.address[1]}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-[0.5rem] text-ink-soft">Hours</dt>
                  <dd className="mt-2 text-[0.98rem]">{SITE.hours}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[0.5rem] text-ink-soft">Member support</dt>
                  <dd className="mt-2 text-[0.98rem]">
                    Existing owners and applicants can sign in to reach their advisor directly.
                  </dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
                >
                  Member login
                  <ArrowRight />
                </Link>
                <Link
                  to="/residences"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
                >
                  Browse residences
                  <ArrowRight />
                </Link>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-7" delay={120}>
              <EnquiryForm source="contact-page" showResidenceSelect />
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
