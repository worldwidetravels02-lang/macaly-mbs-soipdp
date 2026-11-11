// Authentication supports email/password and country-code mobile/password sign-in.
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase-client'
import { ArrowRight } from './site-chrome'

type View = 'signin' | 'signup' | 'forgot' | 'reset'

const countryCodes = [
  ['+971', 'UAE'], ['+44', 'UK'], ['+91', 'India'], ['+855', 'Cambodia'], ['+1', 'USA / Canada'],
  ['+966', 'Saudi Arabia'], ['+974', 'Qatar'], ['+968', 'Oman'], ['+965', 'Kuwait'],
  ['+973', 'Bahrain'], ['+92', 'Pakistan'], ['+880', 'Bangladesh'], ['+94', 'Sri Lanka'],
  ['+63', 'Philippines'], ['+60', 'Malaysia'], ['+65', 'Singapore'], ['+61', 'Australia'],
  ['+49', 'Germany'], ['+33', 'France'], ['+90', 'Turkey'], ['+20', 'Egypt'],
] as const

const inputClass =
  'mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60'

function mapError(err: unknown, view: View) {
  const message = err instanceof Error ? err.message : ''
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Please sign in instead.'
  if (/email signups? (are|is) disabled|signups? not allowed/i.test(message)) return 'New account registration is currently disabled in Supabase. Enable email sign-ups in Authentication settings, then try again.'
  if (/rate|too many/i.test(message)) return 'Too many attempts. Please wait a moment and try again.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address before signing in.'
  if (/invalid email/i.test(message)) return 'Enter a valid email address.'
  if (/password.*(weak|short)|weak password/i.test(message)) return 'Choose a stronger password with at least 8 characters.'
  if (view === 'signin') return 'Phone number or password is incorrect. Please try again.'
  if (view === 'reset') return 'That code is invalid or has expired. Please request a new one.'
  return message || 'Something went wrong. Please try again.'
}

export function AuthPanel({ mode, adminOnly = false }: { mode: 'login' | 'register'; adminOnly?: boolean }) {
  const navigate = useNavigate()
  const [view, setView] = useState<View>(mode === 'register' ? 'signup' : 'signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const client = requireSupabase()
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset')
        setNotice('Choose a new password for your account.')
        setError(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const clearMessages = () => {
    setError(null)
    setNotice(null)
  }

  const handleSignInOrUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    if (view === 'signup') {
      const cleanName = fullName.trim().replace(/\s+/g, ' ')
      const digits = mobile.replace(/\D/g, '')
      if (cleanName.length < 2 || cleanName.length > 120 || /[\u0000-\u001f<>]/.test(cleanName)) return setError('Enter a valid full name between 2 and 120 characters.')
      if (digits.length < 7 || digits.length > 15 || !/^[+()\d\s.-]+$/.test(mobile.trim())) return setError('Please enter a valid mobile number with 7–15 digits.')
      if (referralCode.trim().length > 64) return setError('Referral code must be 64 characters or fewer.')
      if (password.length < 8 || password.length > 72) return setError('Your password must be between 8 and 72 characters.')
      if (password !== confirmPassword) return setError('The two passwords do not match.')
    }
    setBusy(true)
    try {
      const supabase = requireSupabase()
      if (view === 'signup') {
        const normalizedMobile = phoneCountryCode + ' ' + digits
        const internalAuthEmail = 'phone-' + digits + '@accounts.msheireb.invalid'
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email: internalAuthEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim().replace(/\s+/g, ' '),
              mobile: normalizedMobile,
              referral_code: referralCode.trim() || null,
            },
          },
        })
        if (authError) throw authError
        setPassword('')
        setConfirmPassword('')
        if (signUpData.session) {
          await navigate({ to: '/residences' })
          return
        }
        setNotice('Your account was created, but Supabase is requiring email confirmation. Disable email confirmation in Supabase Authentication settings to allow immediate access.')
        setView('signin')
        return
      } else {
        let signedInUserId = ''
        const { data, error: invokeError } = await supabase.functions.invoke('phone-password-login', {
          body: { mobile: phoneCountryCode + ' ' + loginIdentifier.replace(/\D/g, ''), password },
        })
        if (invokeError) throw invokeError
        if (!data?.access_token || !data?.refresh_token) throw new Error('Invalid login details.')
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (sessionError) throw sessionError
        signedInUserId = sessionData.user?.id ?? sessionData.session?.user.id ?? ''
        if (!signedInUserId) throw new Error('Sign-in succeeded but no user session was returned. Please sign in again.')
        if (adminOnly) {
          const { data: membership, error: membershipError } = await supabase
            .from('admin_members')
            .select('user_id')
            .eq('user_id', signedInUserId)
            .maybeSingle()
          if (membershipError) throw membershipError
          if (!membership) {
            await supabase.auth.signOut()
            throw new Error('This account is not authorized for administrator access.')
          }
          await navigate({ to: '/admin' })
        } else {
          setLoginSuccess(true)
          await new Promise(resolve => window.setTimeout(resolve, 2000))
          await navigate({ to: '/dashboard' })
        }
      }
    } catch (err) {
      setError(mapError(err, view))
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    setBusy(true)
    try {
      const { error: authError } = await requireSupabase().auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/login` },
      )
      if (authError) throw authError
      setNotice('If an account exists for this email, a password-reset link has been sent. Open it on this device, then return here to sign in with your new password.')
      setView('signin')
    } catch (err) {
      setError(mapError(err, 'forgot'))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    if (password.length < 8) return setError('Your new password needs at least 8 characters.')
    setBusy(true)
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password })
      if (updateError) throw updateError
      setNotice('Your password has been updated. You can now sign in.')
      setView('signin')
      setPassword('')
    } catch (err) {
      setError(mapError(err, 'reset'))
    } finally {
      setBusy(false)
    }
  }

  const heading =
    view === 'signup' ? 'Create your member account'
      : view === 'forgot' ? 'Reset your password'
        : view === 'reset' ? 'Choose a new password' : 'Welcome back'

  const subheading =
    view === 'signup' ? 'Register to save residences, receive private previews and manage your booking.'
      : view === 'forgot' ? 'We will send a password-reset email if an account exists.'
        : view === 'reset' ? 'Your recovery link is verified. Enter a new password below.'
          : 'Sign in with your registered phone number and password.'

  return (
    <div className="border border-border bg-card p-6 soft-shadow sm:p-9" data-testid="auth-panel" data-state={busy ? 'loading' : 'ready'}>
      {loginSuccess ? (
        <div role="status" aria-live="polite" data-testid="login-success-popup" className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-5">
          <div className="w-full max-w-sm border border-brass/60 bg-background p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brass text-brass">
              <span aria-hidden="true" className="text-2xl">✓</span>
            </div>
            <p className="eyebrow mt-5 text-brass">Msheireb Properties</p>
            <h2 className="display mt-2 text-2xl">Login Successful!</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">Welcome back. You have successfully signed in.</p>
            <p className="mt-5 text-xs text-ink-soft">Opening your dashboard…</p>
          </div>
        </div>
      ) : null}
      <p className="eyebrow text-brass">{view === 'signup' ? 'Registration' : 'Member portal'}</p>
      <h1 className="display mt-4 text-[clamp(1.8rem,3vw,2.5rem)]">{heading}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{subheading}</p>

      {view === 'signup' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSignInOrUp} data-testid="register-form">
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Full name</span>
            <input type="text" required autoComplete="name" value={fullName} onChange={e => { setFullName(e.target.value); clearMessages() }} disabled={busy} placeholder="Your name" data-testid="register-name" className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
              <div className="mt-2 grid grid-cols-[minmax(110px,0.38fr)_1fr] gap-2">
                <select aria-label="Country calling code" value={phoneCountryCode} onChange={e => setPhoneCountryCode(e.target.value)} disabled={busy} className="min-w-0 border border-input bg-background px-2 py-3 text-sm outline-none focus:border-brass" data-testid="register-country-code">
                  {countryCodes.map(([code, country]) => <option key={code} value={code}>{code} {country}</option>)}
                </select>
                <input type="tel" required autoComplete="tel-national" value={mobile} onChange={e => { setMobile(e.target.value); clearMessages() }} disabled={busy} placeholder="50 000 0000" data-testid="register-mobile" className="min-w-0 border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60" />
              </div>
            </label>
          </div>
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Referral code (optional)</span>
            <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)} disabled={busy} placeholder="If a resident referred you" data-testid="register-referral" className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Password</span>
              <input type="password" required autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); clearMessages() }} disabled={busy} placeholder="At least 8 characters" data-testid="register-password" className={inputClass} />
            </label>
            <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Confirm password</span>
              <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearMessages() }} disabled={busy} placeholder="Repeat your password" data-testid="register-confirm" className={inputClass} />
            </label>
          </div>
          {error && <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="border border-border px-4 py-3 text-sm">{notice}</p>}
          <button type="submit" disabled={busy} data-testid="register-submit" className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60">{busy ? 'Creating account…' : 'Create account'}<ArrowRight /></button>
          <p className="mt-1 text-sm text-ink-soft">Already registered? <Link to="/login" className="text-ink underline decoration-brass underline-offset-4">Sign in</Link></p>
        </form>
      ) : null}

      {view === 'signin' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSignInOrUp} data-testid="login-form">
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Phone number</span>
            <div className="mt-2 grid grid-cols-[minmax(110px,0.38fr)_1fr] gap-2">
              <select aria-label="Country calling code" value={phoneCountryCode} onChange={e => setPhoneCountryCode(e.target.value)} disabled={busy} className="min-w-0 border border-input bg-background px-2 py-3 text-sm outline-none focus:border-brass" data-testid="login-country-code">
                {countryCodes.map(([code, country]) => <option key={code} value={code}>{code} {country}</option>)}
              </select>
              <input type="tel" required autoComplete="tel-national" value={loginIdentifier} onChange={e => { setLoginIdentifier(e.target.value); clearMessages() }} disabled={busy} placeholder="50 000 0000" data-testid="login-identifier" className="min-w-0 border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60" />
            </div>
          </label>
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); clearMessages() }} disabled={busy} placeholder="Your password" data-testid="login-password" className={inputClass} />
          </label>
          {error && <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="border border-border px-4 py-3 text-sm">{notice}</p>}
          <button type="submit" disabled={busy} data-testid="login-submit" className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}<ArrowRight /></button>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
            <button type="button" onClick={() => { setView('forgot'); clearMessages() }} data-testid="forgot-password" className="underline decoration-brass underline-offset-4 hover:text-ink">Forgot password?</button>
            <Link to="/register" className="underline decoration-brass underline-offset-4 hover:text-ink">Create an account</Link>
          </div>
        </form>
      ) : null}

      {view === 'forgot' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleForgot} data-testid="forgot-form">
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Email</span>
            <input type="email" required value={email} onChange={e => { setEmail(e.target.value); clearMessages() }} disabled={busy} placeholder="you@example.com" data-testid="forgot-email" className={inputClass} />
          </label>
          {error && <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy} data-testid="forgot-submit" className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60">{busy ? 'Sending…' : 'Send reset email'}<ArrowRight /></button>
          <button type="button" onClick={() => { setView('signin'); clearMessages() }} className="mt-1 text-left text-sm text-ink-soft underline decoration-brass underline-offset-4 hover:text-ink">Back to sign in</button>
        </form>
      ) : null}

      {view === 'reset' ? (
        <form className="mt-8 grid gap-4" onSubmit={handleReset} data-testid="reset-form">
          <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">New password</span>
            <input type="password" required autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); clearMessages() }} disabled={busy} placeholder="At least 8 characters" data-testid="reset-password" className={inputClass} />
          </label>
          {error && <p role="alert" data-testid="auth-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy} data-testid="reset-submit" className="eyebrow mt-2 inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60">{busy ? 'Saving…' : 'Set new password'}<ArrowRight /></button>
        </form>
      ) : null}
    </div>
  )
}
