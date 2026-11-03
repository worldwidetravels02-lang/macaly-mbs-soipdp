import { createFileRoute } from '@tanstack/react-router'
import { PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/privacy']

export const Route = createFileRoute('/privacy')({
  head: () => {
    const canonical = canonicalUrl('/privacy')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Legal"
          title="Privacy policy"
          intro="How Msheireb Properties collects, uses and protects the details you share with us. This page describes our practice in plain language."
        />

        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            <div className="space-y-8 text-[1rem] leading-relaxed text-ink-soft">
              <div>
                <h2 className="display text-2xl text-foreground">What we collect</h2>
                <p className="mt-3">
                  When you submit an enquiry we collect your name, mobile number and, if you provide
                  it, your email address, the residence you are interested in and your message. When
                  you create a member account we also store your email, a securely hashed password
                  and the profile details you enter at registration.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">How we use it</h2>
                <p className="mt-3">
                  We use these details only to respond to your enquiry, arrange viewings, manage your
                  booking and provide member support. We do not sell personal data, and we do not use
                  enquiry details for unrelated marketing.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">Where it is stored</h2>
                <p className="mt-3">
                  Enquiries and member profiles are stored in our managed database. Passwords are
                  never stored in readable form. Access is limited to the {SITE.name} residential
                  team.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">Your choices</h2>
                <p className="mt-3">
                  You can ask us to correct or delete the details we hold about you at any time by
                  contacting our team through the contact page. Deleting a member account removes the
                  associated profile details.
                </p>
              </div>
              <div>
                <h2 className="display text-2xl text-foreground">Cookies</h2>
                <p className="mt-3">
                  We use only the storage required to keep you signed in to the member portal. No
                  advertising or third-party tracking cookies are set on this site.
                </p>
              </div>
              <p className="border-t border-border pt-6 text-sm">
                This policy applies to {SITE.name}, {SITE.address[0]}, {SITE.address[1]}.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
