import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight } from './site-chrome'
import { signInWithEmail, signUpWithEmail } from '@/lib/supabase-auth'
import { requireSupabase } from '@/lib/supabase-client'

type View = 'signin' | 'signup' | 'forgot' | 'reset'

const DIAL_CODES = [
  { code: '+971', label: 'UAE' },
  { code: '+91', label: 'India' },
  { code: '+92', label: 'Pakistan' },
  { code: '+966', label: 'Saudi Arabia' },
  { code: '+974', label: 'Qatar' },
  { code: '+965', label: 'Kuwait' },
  { code: '+973', label: 'Bahrain' },
  { code: '+968', label: 'Oman' },
  { code: '+20', label: 'Egypt' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+1', label: 'United States' },
  { code: '+33', label: 'France' },
  { code: '+49', label: 'Germany' },
  { code: '+90', label: 'Turkey' },
  { code: '+7', label: 'Russia' },
  { code: '+86', label: 'China' },
  { code: '+62', label: 'Indonesia' },
  { code: '+63', label: 'Philippines' },
  { code: '+234', label: 'Nigeria' },
  { code: '+27', label: 'South Africa' },
]

const inputClass =
  'mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60'

function mapError(err: unknown, view: View) {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('already exists')) {
    return 'An account with this email already exists. Please sign in instead.'
  }
  if (message.includes('Too many') || message.includes('rate')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (view === 'signin') return 'Email or password is incorrect. Please try again.'
  if (view === 'reset') return 'That code is invalid or has expired. Please request a new one.'
  return 'Something went wrong. Please try again.'
}

export function AuthPanel({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()

  const [view, setView] = useState<View>(mode === 'register' ? 'signup' : 'signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [dialCode, setDialCode] = useState('+971')
  const [referralCode, setReferralCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [loginMethod, setLoginMethod] = useState<'mobile' | 'email'>('email')

  const clearError = () => {
    if (error) setError(null)
  }

  const handleSignInOrUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (view === 'signup') {
      if (fullName.trim().length < 2) return setError('Please enter your full name.')
      if (mobile.replace(/\D/g, '').length < 7) return setError('Please enter a valid mobile number.')
      if (password.length < 8) return setError('Your password needs at least 8 characters.')
      if (password !== confirmPassword) return setError('The two passwords do not match.')
    }

    setBusy(true)
    try {
      if (view === 'signin') {
        if (loginMethod !== 'email') {
          throw new Error('Please choose Email address to sign in. Mobile-number sign-in will be added after secure phone lookup is configured.')
        }
        await signInWithEmail(email, password)
      } else {
        const result = await signUpWithEmail(email, password, {
          full_name: fullName,
          mobile: mobile.trim().startsWith('+') ? mobile.trim() : `${dialCode} ${mobile.trim()}`,
        })
        if (!result.session) {
          setError('Account created. Check your email to confirm it, then sign in.')
          setView('signin')
          return
        }
      }

      await navigate({ to: '/dashboard' })
    } catch (err) {
      setError(mapError(err, view))
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) throw resetError
      setError('Password reset link sent. Check your email and follow the link to choose a new password.')

    } catch (err) {
      setError(mapError(err, 'forgot'))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Your new password needs at least 8 characters.')
    setBusy(true)
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password })
      if (updateError) throw updateError
      await navigate({ to: '/dashboard' })

    } catch (err) {
      setError(mapError(err, 'reset'))
    } finally {
      setBusy(false)
    }
  }

  const heading =
    view === 'signup'
      ? 'Create your member account'
      : view === 'forgot'
        ? 'Reset your password'
        : view === 'reset'
          ? 'Enter your reset code'
          : 'Welcome back'

  const subheading =
    view === 'signup'
      ? 'Register to save residences, receive private previews and manage your booking.'
      : view === 'forgot'
        ? 'We will email you a secure link to set a new password.'
        : view === 'reset'
          ? `Follow the password reset link from your email, then return here.`
          : 'Sign in with the mobile number and password on your account.'

  return (
    <div className="border border-border bg-card p-6 soft-shadow sm:p-9" data-testid="auth-panel" data-state={busy ? 'loading' : 'ready'}>
      <p className="eyebrow text-brass">{view === 'signup' ? 'Registration' : 'Member portal'}</p>
      <h1 className="display mt-4 text-[clamp(1.8rem,3vw,2.5rem)]">{heading}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{subheading}</p>

      {view === 'signup' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSignInOrUp} data-testid="register-form">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Full name</span>
            <input
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value)
                clearError()
              }}
              disabled={busy}
              placeholder="Your name"
              data-testid="register-name"
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="you@example.com"
                data-testid="register-email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
              <input
                type="tel"
                required
                autoComplete="tel"
                value={mobile}
                onChange={(event) => {
                  setMobile(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="+971 50 000 0000"
                data-testid="register-mobile"
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Referral code (optional)</span>
            <input
              type="text"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              disabled={busy}
              placeholder="If a resident referred you"
              data-testid="register-referral"
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="At least 8 characters"
                data-testid="register-password"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Confirm password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="Repeat your password"
                data-testid="register-confirm"
                className={inputClass}
              />
            </label>
          </div>

          {error ? (
            <p
              role="alert"
              data-testid="auth-error"
              className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            data-testid="register-submit"
            className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {busy ? 'Creating account…' : 'Create account'}
            <ArrowRight />
          </button>

          <p className="mt-1 text-sm text-ink-soft">
            Already registered?{' '}
            <Link to="/login" className="text-ink underline decoration-brass underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      ) : null}

      {view === 'signin' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSignInOrUp} data-testid="login-form">
          <div role="group" aria-label="Sign in with" className="grid grid-cols-2 border border-border">
            {([
              { id: 'mobile' as const, label: 'Mobile number' },
              { id: 'email' as const, label: 'Email address' },
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setLoginMethod(option.id)
                  clearError()
                }}
                disabled={busy}
                aria-pressed={loginMethod === option.id}
                data-testid={`login-method-${option.id}`}
                className={`px-4 py-3 text-[0.6rem] uppercase tracking-[0.14em] transition-colors ${
                  loginMethod === option.id
                    ? 'bg-brass/10 text-ink'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {loginMethod === 'email' ? (
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Email address</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="you@example.com"
                data-testid="login-email"
                className={inputClass}
              />
            </label>
          ) : (
          <div className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
            <div className="mt-2 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <select
                value={dialCode}
                onChange={(event) => {
                  setDialCode(event.target.value)
                  clearError()
                }}
                disabled={busy}
                aria-label="Country code"
                data-testid="login-dial-code"
                className="w-full border border-input bg-background px-3 py-3 text-[0.95rem] outline-none transition-colors focus:border-brass disabled:opacity-60"
              >
                {DIAL_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code} {country.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                autoComplete="tel-national"
                value={mobile}
                onChange={(event) => {
                  setMobile(event.target.value)
                  clearError()
                }}
                disabled={busy}
                placeholder="50 000 0000"
                aria-label="Mobile number"
                data-testid="login-mobile"
                className="w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
              />
            </div>
          </div>
          )}
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearError()
              }}
              disabled={busy}
              placeholder="Your password"
              data-testid="login-password"
              className={inputClass}
            />
          </label>

          {error ? (
            <p
              role="alert"
              data-testid="auth-error"
              className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit"
            className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight />
          </button>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
            <button
              type="button"
              onClick={() => {
                setView('forgot')
                setError(null)
              }}
              data-testid="forgot-password"
              className="underline decoration-brass underline-offset-4 hover:text-ink"
            >
              Forgot password?
            </button>
            <Link to="/register" className="underline decoration-brass underline-offset-4 hover:text-ink">
              Create an account
            </Link>
          </div>
        </form>
      ) : null}

      {view === 'forgot' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleForgot} data-testid="forgot-form">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError()
              }}
              disabled={busy}
              placeholder="you@example.com"
              data-testid="forgot-email"
              className={inputClass}
            />
          </label>

          {error ? (
            <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            data-testid="forgot-submit"
            className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send reset code'}
            <ArrowRight />
          </button>
          <button
            type="button"
            onClick={() => {
              setView('signin')
              setError(null)
            }}
            className="mt-1 text-left text-sm text-ink-soft underline decoration-brass underline-offset-4 hover:text-ink"
          >
            Back to sign in
          </button>
        </form>
      ) : null}

      {view === 'reset' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleReset} data-testid="reset-form">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Reset code</span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                clearError()
              }}
              disabled={busy}
              placeholder="Six digit code"
              data-testid="reset-code"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">New password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearError()
              }}
              disabled={busy}
              placeholder="At least 8 characters"
              data-testid="reset-password"
              className={inputClass}
            />
          </label>

          {error ? (
            <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            data-testid="reset-submit"
            className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Set new password'}
            <ArrowRight />
          </button>
        </form>
      ) : null}
    </div>
  )
}
