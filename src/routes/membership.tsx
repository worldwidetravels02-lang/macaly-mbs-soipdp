import { createFileRoute, Link } from '@tanstack/react-router'
const TIERS = [
  { level: 1, name: 'Member · Explorer', summary: 'A simple starting point for discovering our residences.', propertyAllowance: 'Explore', minTopUpAed: 0, benefits: ['Browse published residences', 'Save your account details', 'Send enquiries to our team'] },
  { level: 2, name: 'Member · Private', summary: 'A more personal way to arrange a property conversation.', propertyAllowance: 'Discover', minTopUpAed: 0, benefits: ['Request a private viewing', 'Receive project updates', 'Contact member services'] },
  { level: 3, name: 'Member · Signature', summary: 'Priority assistance as additional services become available.', propertyAllowance: 'Connect', minTopUpAed: 0, benefits: ['Personal enquiry support', 'Project announcements', 'Member account access'] },
  { level: 4, name: 'Member · Premier', summary: 'An enhanced relationship with the Msheireb Properties team.', propertyAllowance: 'Experience', minTopUpAed: 0, benefits: ['Dedicated enquiry follow-up', 'Residence collection updates', 'Member account access'] },
] as const
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/membership']

export const Route = createFileRoute('/membership')({
  head: () => {
    const canonical = canonicalUrl('/membership')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: MembershipPage,
})

function MembershipPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Membership"
          title="A more considered way to discover Dubai."
          intro="Create a member account to save your details, explore the residence collection and contact our team. Membership benefits and account services will be introduced as they become available."
          image={IMAGES.tower}
          imageAlt="Msheireb Properties tower at dusk"
        />

        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div data-testid="membership-levels" className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {TIERS.map((tier, index) => (
                <Reveal key={tier.level} delay={index * 80}>
                  <article className="flex h-full flex-col border border-border bg-card p-6">
                    <p className="eyebrow text-[0.5rem] text-brass">Level {tier.level}</p>
                    <h2 className="display mt-3 text-2xl">{tier.name.split('·')[1]?.trim() ?? tier.name}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{tier.summary}</p>
                    <p data-testid={`membership-projects-${tier.level}`} className="eyebrow mt-5 text-[0.5rem] text-brass">
                      Member access
                    </p>
                    <p className="eyebrow mt-3 text-[0.5rem] text-ink-soft">Membership status</p>
                    <p className="display mt-1 text-xl">
                      Registration
                    </p>
                    <ul className="mt-5 space-y-3 border-t border-border pt-5 text-sm text-ink-soft">
                      {tier.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-3">
                          <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-brass" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
            </div>

            <div className="mt-12 grid gap-6 border-t border-border pt-10 lg:grid-cols-12 lg:items-center">
              <p className="max-w-xl text-[0.98rem] leading-relaxed text-ink-soft lg:col-span-7">
                Levels are calculated from approved top-ups only, so they always match the money
                administration has confirmed. Withdrawals do not lower your level.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
                <Link
                  to="/dashboard"
                  className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Member dashboard
                  <ArrowRight />
                </Link>
                <Link
                  to="/register"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
                >
                  Join
                  <ArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
