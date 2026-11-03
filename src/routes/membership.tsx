import { createFileRoute, Link } from '@tanstack/react-router'
import { TIERS } from '@/convex/tiers'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { formatAed } from '../lib/format'
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
          title="Four levels, earned by what you invest."
          intro="Every registered member starts at Level 1 with an AED 200 sign-in bonus. Approved wallet top-ups move you through the levels, and each level adds access rather than noise."
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
                      {tier.propertyAllowance} projects unlocked
                    </p>
                    <p className="eyebrow mt-3 text-[0.5rem] text-ink-soft">Approved top-ups from</p>
                    <p className="display mt-1 text-xl">
                      {tier.minTopUpAed === 0 ? 'AED 0' : formatAed(tier.minTopUpAed)}
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
                  to="/wallet"
                  className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Open my wallet
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
