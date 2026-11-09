# Msheireb Properties

Luxury property website and member portal for the Dubai launch market.

## Stack

- React + TanStack Start + Vite
- Supabase Auth, Postgres, Row Level Security and Storage
- Cloudflare Workers deployment (configure after domain and account setup)

## Local setup

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Fill in the Supabase project URL and publishable/anon key from the Supabase dashboard.
4. Install packages with `npm install`.
5. Run the automated tests with `npm run test`.
6. Start the development site with `npm run dev`.
7. Verify the production bundle with `npm run build`.

Never put a Supabase `service_role` key in browser variables or commit real credentials.

## Supabase setup

Apply the SQL files in `supabase/migrations/` in filename order using the Supabase SQL Editor. Apply every migration in filename order, including these later workflow and security updates:

- `202611050010_disable_card_and_crypto_payment_workflows.sql` removes legacy card and cryptocurrency submission/finalization paths.
- `202611050011_enforce_withdrawal_available_balance.sql` rejects withdrawal requests that exceed the customer's available wallet balance, including pending and approved withdrawals.
- `202611090001_investment_commission_ledger.sql` adds the administrator-reviewed investment and commission ledger.
- `202611090002_member_task_workflow_states.sql` defines the task assignment, submission, review and resubmission states.
- `202611090003_identity_document_cleanup_policy.sql` allows customers to remove their own private identity uploads when a submission needs cleanup.

After creating the owner account through Supabase Auth, add that account to `public.admin_members` from the SQL Editor using its Auth user UUID:

```sql
insert into public.admin_members (user_id, role)
values ('YOUR_AUTH_USER_UUID', 'owner')
on conflict (user_id) do nothing;
```

Do not expose the owner UUID or any private credentials publicly. Confirm every migration completed successfully, verify Row Level Security is enabled on the financial and account tables, and confirm the withdrawal trigger exists before using the admin panel.

## Financial workflow

- Customers submit deposit requests and contact support for instructions. The website does not collect payments.
- Customers submit withdrawal requests; administrators review them. Mark a withdrawal paid only after the external transfer has actually been completed.
- New withdrawal requests are checked in the database against the available balance, including amounts already reserved by pending or approved requests.
- Wallet credits are internal ledger entries. Administrators alone can add manual wallet credit.
- No card payments or cryptocurrency payments are supported.
- Payment instructions are administrator-only; customer deposit guidance is handled by support.

## Cloudflare launch (after domain purchase)

1. Create/sign in to the Cloudflare account and add the purchased domain.
2. Configure the required DNS records and connect the domain to the Cloudflare Worker.
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_CANONICAL_ORIGIN` as build environment variables in the deployment workflow.
4. Run `npm run test` and `npm run build`.
5. Verify Supabase migrations, RLS policies, owner access, real property content, and customer/admin workflows.
6. Deploy with `npm run deploy` only after the launch checks above have passed.

Cloudflare hosting is not purchased or deployed by this repository change. Do not deploy until the launch checklist is complete.
