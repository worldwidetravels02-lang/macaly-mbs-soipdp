import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { TIERS } from '../lib/tiers'
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

type MemberTask = { id: string; title: string; detail: string | null; target_level: number; status: string; review_note: string | null; created_at: string; submitted_at: string | null }

function MembershipPage() {
  const [tasks, setTasks] = useState<MemberTask[]>([])
  const [taskLoading, setTaskLoading] = useState(true)
  const [taskUser, setTaskUser] = useState<string | null>(null)
  const [taskError, setTaskError] = useState('')
  const [taskNotice, setTaskNotice] = useState('')
  const [submittingTask, setSubmittingTask] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setTaskLoading(true)
    setTaskError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!auth.user) { setTaskUser(null); setTasks([]); return }
      setTaskUser(auth.user.id)
      const { data, error } = await client.from('member_tasks')
        .select('id,title,detail,target_level,status,review_note,created_at,submitted_at')
        .eq('user_id', auth.user.id).order('created_at', { ascending: false })
      if (error) throw error
      setTasks((data ?? []) as MemberTask[])
    } catch (cause) {
      setTaskError(cause instanceof Error ? cause.message : 'Could not load your membership tasks.')
    } finally { setTaskLoading(false) }
  }, [])

  useEffect(() => { void loadTasks() }, [loadTasks])

  async function submitTask(task: MemberTask) {
    if (!taskUser || !['assigned', 'rejected'].includes(task.status)) return
    setSubmittingTask(task.id); setTaskError(''); setTaskNotice('')
    try {
      const { data, error } = await requireSupabase().from('member_tasks')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', task.id).eq('user_id', taskUser).in('status', ['assigned', 'rejected'])
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('This task has already changed. Refresh the page and check its latest status.')
      setTaskNotice('Your task has been submitted to the administration team.')
      await loadTasks()
    } catch (cause) {
      setTaskError(cause instanceof Error ? cause.message : 'Could not submit this task.')
    } finally { setSubmittingTask(null) }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Membership"
          title="Membership levels and benefits."
          intro="This page shows illustrative membership levels and account features. Thresholds, project allowances and benefits are sample defaults until confirmed by the administrator. No bonus, profit or investment return is guaranteed."
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

            <section className="mt-16 border-t border-border pt-10" aria-labelledby="member-tasks-title">
              <p className="eyebrow text-brass">Your membership journey</p>
              <h2 id="member-tasks-title" className="display mt-3 text-2xl">Membership tasks</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">Tasks assigned by the administration team appear here. Submit completed tasks for review; your level changes only when administration confirms the relevant requirements.</p>
              {!taskUser && !taskLoading ? <p className="mt-5 border border-border bg-card p-5 text-sm text-ink-soft">Sign in to view tasks assigned to your account. <Link to="/login" className="underline">Login</Link></p> : null}
              {taskLoading ? <p className="mt-5 text-sm text-ink-soft">Loading your tasks…</p> : null}
              {taskError ? <p role="alert" className="mt-5 border border-destructive/40 p-4 text-sm text-destructive">{taskError}</p> : null}
              {taskNotice ? <p role="status" className="mt-5 border border-brass/40 p-4 text-sm text-ink-soft">{taskNotice}</p> : null}
              {taskUser && !taskLoading && tasks.length === 0 ? <p className="mt-5 border border-border bg-card p-5 text-sm text-ink-soft">No tasks have been assigned to you yet.</p> : null}
              {tasks.length > 0 ? <ul className="mt-6 grid gap-4 md:grid-cols-2">{tasks.map((task) => <li key={task.id} className="border border-border bg-card p-6"><div className="flex items-start justify-between gap-4"><h3 className="display text-lg">{task.title}</h3><span className="eyebrow shrink-0 text-[0.5rem] text-brass">Level {task.target_level}</span></div>{task.detail ? <p className="mt-3 text-sm leading-relaxed text-ink-soft">{task.detail}</p> : null}<p className="mt-4 text-xs text-ink-soft">Status: {task.status.replace(/_/g, ' ')}</p>{task.review_note ? <p className="mt-2 border-l-2 border-brass pl-3 text-xs text-ink-soft">Admin note: {task.review_note}</p> : null}{['assigned', 'rejected'].includes(task.status) ? <button type="button" disabled={submittingTask === task.id} onClick={() => void submitTask(task)} className="eyebrow mt-5 bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground disabled:opacity-50">{submittingTask === task.id ? 'Submitting…' : task.status === 'rejected' ? 'Resubmit task' : 'Submit completed task'}</button> : null}</li>)}</ul> : null}
            </section>

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
