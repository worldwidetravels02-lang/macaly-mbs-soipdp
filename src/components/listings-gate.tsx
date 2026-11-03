import { Link } from '@tanstack/react-router'
import { ArrowRight } from './site-chrome'

/** Shown instead of listings until a member signs in. */
export function ListingsGate({
  title = 'Listings are reserved for members.',
  intro = 'Sign in to see prices, floor plans and availability across the Msheireb collection. Registration takes a moment and is free.',
}: {
  title?: string
  intro?: string
}) {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <div
          data-testid="listings-gate"
          className="border border-border bg-card p-8 text-center soft-shadow sm:p-12"
        >
          <p className="eyebrow text-brass">Members only</p>
          <h2 className="display mt-4 text-[clamp(1.6rem,3vw,2.4rem)]">{title}</h2>
          <p className="mx-auto mt-4 max-w-lg text-[0.98rem] leading-relaxed text-ink-soft">{intro}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              data-testid="gate-login"
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Member login
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/register"
              data-testid="gate-signup"
              className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
