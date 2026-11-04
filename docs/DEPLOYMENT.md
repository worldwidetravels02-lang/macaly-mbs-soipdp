# Deployment guide

This application is a TanStack Start + Vite web app with a Convex backend. It is not a static-only site; GitHub Pages cannot host the complete application and its server routes.

## 1. Required services

- GitHub: source code.
- Convex: database, authentication, backend functions, scheduled jobs.
- A Node.js hosting provider that supports the Nitro/TanStack Start server output (for example, Vercel after confirming the project's build output and adapter compatibility).

Do not configure a static export or GitHub Pages deployment for the full application.

## 2. Frontend environment variables

Configure these in the hosting provider's project settings:

- `VITE_CONVEX_URL`: URL of the Convex deployment (public).
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (public; use a test key until payment testing is complete).
- `VITE_CANONICAL_ORIGIN`: production website origin, if canonical URLs should be emitted.

Only variables prefixed with `VITE_` are exposed to browser code. Never put secret keys in these variables.

## 3. Convex deployment and server secrets

Deploy the `convex/` backend to a Convex deployment and configure its environment variables there, not in frontend build settings:

- `STRIPE_SECRET_KEY`: Stripe secret key (keep private).
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret (keep private).
- `OTP_ENDPOINT`: endpoint used by the configured one-time-password delivery service.
- `CHAT_ID`: delivery-service chat identifier, if required.
- `SECRET_KEY`: delivery-service secret, if required.
- `APP_NAME`: application name used in OTP delivery.
- `ADMIN_SETUP_SECRET`: private first-admin bootstrap secret (at least 20 characters). Generate a unique random value and set it only in the Convex deployment environment; never commit it to GitHub. After the owner has created the administrator and saved a new passcode in Admin Settings, remove this environment variable.

The OTP provider in `convex/ResendOTP.ts` depends on the OTP service above. Email registration and password reset will not work until that service is configured and tested.

## 4. Build and test before launch

Run these commands from the repository root:

```bash
npm ci
npm test
npm run build
```

Resolve all test and build errors before connecting a production domain. Confirm the hosting provider runs the production server output rather than serving only the static client assets.

## 5. Payments and financial features

Start with Stripe test-mode credentials and test successful, failed, expired, and duplicate webhook events. Configure the webhook endpoint at:

```
https://YOUR-CONVEX-DEPLOYMENT.convex.site/stripe/webhook
```

Use the exact HTTP Actions URL shown by your Convex deployment. Do not accept real customer deposits, withdrawals, or investment funds until payment reconciliation, identity checks, legal/compliance requirements, and manual approval workflows have been reviewed.

Automatic monthly profit payouts are currently disabled in `convex/crons.ts`. Keep them disabled until the payout formula, funding basis, reconciliation, and business/legal requirements have been independently reviewed and approved.

## 6. Admin security before launch

- First-admin setup now fails closed unless a private `ADMIN_SETUP_SECRET` is configured in Convex.
- Public self-claim and automatic promotion based only on an email address are disabled.
- Verify the owner setup flow with the private secret before launch; then save a new admin passcode and remove the bootstrap secret.
- Require strong unique passwords and a strong passcode; never commit credentials to GitHub.
- Test access from a non-admin account and verify every admin mutation rejects it.
- Review admin recovery and account invitation flows before inviting staff.

## 7. Important

The first-admin setup uses a private `ADMIN_SETUP_SECRET` stored only in Convex. Never share it in chat or add it to GitHub. This guide documents the variables and deployment shape visible in the current source. It does not mean a hosting provider, Convex deployment, Stripe account, email/OTP service, domain, or production secrets have already been configured.
