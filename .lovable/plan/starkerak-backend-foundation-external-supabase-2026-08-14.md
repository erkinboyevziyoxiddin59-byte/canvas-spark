# StarKerak backend foundation (external Supabase)

I'm still in plan mode, so nothing has been applied. Approve this and I'll build the whole
backend in one go — schema, server logic, hooks, admin security, tests — without stopping
between components.

## Architecture decision

This project is TanStack Start, so business logic lives in **server functions**
(`createServerFn`), not Supabase Edge Functions — one backend layer, no duplication.
The browser never talks to PostgREST directly.

```text
Telegram Mini App
  → server function (verifies session cookie)
    → service-role Supabase client (server only)
      → PostgreSQL (RLS on everywhere, no browser grants)
```

Auth: the client sends the signed `Telegram.WebApp.initData` string once; the server
verifies its HMAC with the bot token, upserts the user by `telegram_id`, and stores the
verified user id in an encrypted httpOnly session cookie. `initDataUnsafe` is never trusted.
Outside Telegram (preview/browser) a dev user is used **only** when no bot token is
configured.

Secrets I'll need to add (server-side only, never bundled): `TELEGRAM_BOT_TOKEN`,
`SESSION_SECRET`, `ADMIN_TELEGRAM_IDS`. Supabase URL/keys are already connected.

## 1. Database (one migration)

Tables — uuid PKs, integer UZS, timestamps, `updated_at` triggers, RLS enabled on all,
`service_role` grants only (no `anon`/`authenticated` access at all, so cross-user reads
are impossible from the browser):

`users` (telegram_id unique, username, names, photo_url, language_code, referral_code
unique, referred_by, is_blocked) · `user_roles` + `has_role()` (never an is_admin column) ·
`app_settings` (pricing, card, maintenance, loyalty config) · `orders` (order_no bigserial,
recipient, product_type, quantity, unit/base/final price, status, expires_at) · `payments`
(separate payment_status, verifier, reason) · `loyalty_levels` (seeded New/Bronze/Silver/
Gold/Diamond ×1.00/1.10/1.25/1.50/2.00) · `rewards` (seeded 500→50, 1000→100) ·
`points_ledger` (append-only, signed points) · `reward_requests` · `referrals` ·
`missions` + `mission_completions` · `admin_audit_log`.

Consistency guards baked into the schema:

- partial unique index on `amount_uzs` for open orders → no two payable orders share an amount
- unique `(user_id, type, order_id)` in the ledger → points can never be awarded twice
- unique ledger keys per mission and per referral → no duplicate rewards
- unique `(user_id, mission_id)` completions, one open payment per order
- `referrals.referred_id` unique + `referrer_id <> referred_id` → one referrer, no self-referral

Atomic SQL routines: `complete_order()` (completes, awards points with the tier held at
purchase time, qualifies the referral), `redeem_reward()` (balance check + debit + request
in one transaction, with cooldown), `reject_reward_request()` (refund once),
`complete_mission()`, `expire_stale_orders()`, `user_points()`, `level_for()`.

## 2. Server functions (`src/lib/*.functions.ts`)

- **auth** — `authenticate(initData, startParam)`, `getSession()`, referral attribution at signup
- **settings** — public pricing/card/maintenance; admin writes
- **orders** — `createOrder` (server recomputes price from settings; frontend price ignored),
`listMyOrders`, `getMyOrder`, `cancelOrder`
- **payments** — `submitPayment` (user says "I paid"); `verifyPayment` / `rejectPayment` are
admin-only and are the only paths that complete an order
- **loyalty** — `getPoints`, `getLedger`, `redeemReward`, levels & rewards
- **referrals** — my code, link, invited list, stats
- **missions** — list, complete
- **profile** — one aggregated read for the profile page
- **admin** — users/orders/payments/requests/referrals queues, mission & settings management;
every call re-checks `has_role('admin')` and writes to `admin_audit_log`

## 3. Frontend data layer

React Query hooks (`useSession`, `useOrders`, `useOrder`, `usePricing`, `useProfile`,
`usePoints`, `useMissions`, `useReferrals`, `useAdmin*`) replacing the `"orders:changed"`
window event with query invalidation. Pages keep their exact markup; only data sources,
loading/error states and the payment screen's actions change:

- `stars` / `premium` → `createOrder` mutation
- `payment.$orderId` → DB-owned `expires_at` countdown; "I paid" now submits a payment and
shows "waiting for admin verification" instead of self-delivering; light polling for status
- `orders`, `points`, `missions`, `referral`, `profile` → real data
- `admin` → gated by server-side role check; renders "not authorized" otherwise
- Errors surface through the existing UI (no silent failures)

Old status names map onto the new ones so the existing badges keep working.

## 4. Mock removal

`mock-store.ts`, `loyalty.ts`, `referrals.ts`, `missions.ts` lose their localStorage
persistence and the hardcoded `PROFILE`; pure helpers (`formatAmount`, `typeLabel`, level
types) move to a small `format.ts`. `language.tsx` keeps localStorage — that's genuinely
client state. Removal happens after each feature is verified against Supabase.

## 5. Testing after build

Direct API probes plus a browser pass: new user, returning user, two users in parallel,
order create/cancel/expire, price tampering rejected, payment submit → admin verify →
completed, points awarded exactly once, redemption + duplicate blocked, referral attribution,
self/duplicate referral blocked, mission double-claim blocked, admin endpoints rejected for a
normal user, and — most importantly — user A cannot read user B's orders/points/payments,
verified by calling the endpoints directly rather than through the UI.

## Notes / decisions for later

- Realtime is intentionally left out; the payment screen polls while awaiting verification.
Easy to add later on `orders`/`payments` only.
- Admins are bootstrapped from `ADMIN_TELEGRAM_IDS`; a proper admin-manages-admins screen
can come later.
- Receipt image upload for payments is scaffolded (`receipt_url`) but not wired to Storage yet.

Switch to build mode and approve, and I'll implement all of it in this task. TELEGRAM_BOT_TOKEN = : 8612478490:AAEyT9rb71HWIOoxNxQsQT8CsTC-SX8x2Qg]

SESSION_SECRET     = [random secret you generate]

ADMIN_TELEGRAM_IDS = [your Telegram ID 1208388326] 