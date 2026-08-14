# StarKerak: mock → Supabase migration plan

Planning only. No code, schema, or data changes in this step.

## Phase 1 — What exists today (verified by reading the code)

Routes (`src/routes/`): `index`, `stars`, `premium`, `payment.$orderId`, `orders`, `points`, `missions`, `referral`, `profile`, `admin`, `__root`.
Components: `AppHeader`, `BottomNav`, `LanguageGate`, `MaintenanceGate`, `StatBits`, `ui/*`.
Hooks: `usePricing`, `useTelegramUser`, `use-mobile`.

All state is localStorage + a `window` event bus (`"orders:changed"`) — there is no data-fetching layer at all:

| File | localStorage keys | Owns |
| --- | --- | --- |
| `src/lib/mock-store.ts` | `starkerak.orders.v1`, `starkerak.pricing.v1`, `starkerak.maintenance.v1` | orders, prices, maintenance, card details, unique-amount trick, 10-min expiry, fake delivery timer |
| `src/lib/loyalty.ts` | `starkerak.loyalty.settings.v1/.ledger.v1/.requests.v1` | tiers, points ledger, reward requests, hardcoded `PROFILE` |
| `src/lib/referrals.ts` | `starbbot.referrals.v1`, `...invitedby.v1` | invited friends, referral awards |
| `src/lib/missions.ts` | `starbbot.missions.v1`, `...done.v1` | missions + completions |
| `src/lib/language.tsx` | language choice | UI locale (stays local) |

`useTelegramUser` reads `Telegram.WebApp.initDataUnsafe` (unverified) and falls back to a hardcoded profile. `/admin` is a plain route with no authorization at all. Points/levels are recomputed in the browser from local orders — fully forgeable.

Existing Supabase scaffolding is present at `src/integrations/supabase/*` (client, admin client, auth middleware, attacher) but unused.

## Phase 2 — Database architecture

Tables (all `public`, all with `created_at`/`updated_at`, all with explicit GRANTs + RLS):

- `users` — `id uuid pk`, `telegram_id bigint unique not null`, `username`, `first_name`, `last_name`, `photo_url`, `language_code`, `referral_code text unique`, `referred_by uuid → users(id)`, `is_blocked`, `last_seen_at`. Index on `telegram_id`, `referral_code`, `referred_by`.
- `user_roles` — `(user_id, role app_role)` unique, `app_role enum('admin','user')`, plus `has_role()` security-definer function. Roles never live on `users`.
- `products`/`pricing` — `settings` key/value JSONB table is enough for star price, premium tiers, maintenance, loyalty config (replaces three localStorage config blobs). Single row per key, admin-write only.
- `orders` — `id uuid`, `order_no bigserial unique` (the human number), `user_id → users`, `recipient_username`, `product_type enum('stars','premium_3','premium_6','premium_12')`, `quantity int check > 0`, `unit_price_uzs`, `amount_uzs` (unique among open orders — see risk), `status order_status`, `expires_at`, `completed_at`, `cancel_reason`. Indexes: `(user_id, created_at desc)`, `(status)`, partial unique on `amount_uzs where status in ('awaiting_payment','processing')`.
- `payments` — `id uuid`, `order_id → orders` (1:1 for now, table allows retries), `method 'manual_card'`, `declared_amount_uzs`, `payer_note`, `receipt_url`, `status payment_status`, `verified_by uuid → users`, `verified_at`, `reject_reason`.
- `points_ledger` — `user_id`, `type enum('earn','referral','mission','redeem','refund','adjust')`, `points int` (signed), `note`, `order_id`/`reward_request_id`/`mission_id` nullable refs, `unique(user_id, type, order_id)` to make awards idempotent. Balance = `sum(points)`, exposed via view `user_points_balance`.
- `loyalty_levels` — key, name, emoji, threshold, multiplier, sort order (admin-editable, seeded with New/Bronze/Silver/Gold/Diamond ×1.00/1.10/1.25/1.50/2.00).
- `rewards` — cost_points, output_stars, active.
- `reward_requests` — user, reward, cost snapshot, stars snapshot, level snapshot, `status enum('pending','approved','completed','rejected')`, admin actor, timestamps.
- `referrals` — `referrer_id`, `referred_id unique`, `status enum('pending','qualified','rewarded')`, `qualified_at`, `reward_ledger_id`. Constraint `referrer_id <> referred_id`; unique on `referred_id` prevents duplicates and re-attribution.
- `missions` + `mission_completions` — `unique(user_id, mission_id)`.
- `admin_audit_log` — actor, action, entity, entity_id, payload JSONB.
- Optional later: `promo_codes` — designed for but not created in this migration.

Scale notes: uuid PKs, bigserial display numbers, ledger append-only (never mutate balances), all money as integer UZS.

## Phase 3 — Telegram identity

- Frontend sends raw `window.Telegram.WebApp.initData` (the signed string, never `initDataUnsafe`) to the server.
- Server verifies the HMAC-SHA256 signature with the bot token, checks `auth_date` freshness (≤ 24h), then upserts `users` by `telegram_id` (the unique key that prevents duplicates and recognizes returning users). Stored: telegram_id, username, names, photo_url, language_code.
- Bot token is a Supabase/host secret, never in the bundle.

**Decision point (needs your call before Phase 6):**
1. *Server-mediated* — all reads/writes go through authenticated server functions using a verified Telegram session cookie; DB access uses the service key server-side; RLS is deny-all to `anon`. Simplest and safest, no Supabase Auth involved, but no client Realtime.
2. *Minted JWT* — server signs a Supabase-compatible JWT (`sub` = user id) with the project JWT secret; the browser client then works with real RLS + Realtime. More moving parts, needs your external project's JWT secret.
Recommendation: start with (1), add (2) only if Realtime on the client becomes necessary.

## Phase 4 — Security / RLS

- Every table: RLS enabled, no `anon` grants except read-only reference data (`loyalty_levels`, `rewards`, active `missions`, public `settings`).
- User can read their own `users` row, own orders, own payments, own ledger, own reward requests, own referrals, own completions.
- User can insert: nothing sensitive directly. Order creation, payment submission, redemption, mission completion and referral attribution all go through server code.
- User can never read: other users' rows, `admin_audit_log`, `user_roles` of others, verification fields.
- Admin: `has_role(auth.uid(),'admin')` policies for full read + status transitions.
- Never trusted from the frontend: prices, points math, tier/multiplier, order status transitions, payment verification, referral qualification, reward approval, admin flag.

## Phase 5 — Server-side logic

This project is TanStack Start, so the correct equivalent of Edge Functions is `createServerFn` (plus `src/routes/api/public/*` for anything Telegram's bot server calls). No Supabase Edge Functions.

- `auth.functions.ts` — verify initData, upsert user, issue session. (Only place the bot token is used.)
- `orders.functions.ts` — `createOrder` (server recomputes price from `settings`, allocates unique amount, sets expiry), `cancelOrder`, `listMyOrders`, `getMyOrder`.
- `payments.functions.ts` — `submitPayment` (user declares they paid), `verifyPayment` / `rejectPayment` (admin only) → these are what flip order status and trigger point awards.
- `loyalty.functions.ts` — `redeemReward` (balance check + ledger debit in one transaction), `listLedger`.
- `admin.functions.ts` — queues, status changes, settings writes; every call re-checks `has_role`.
- DB-side: a trigger/RPC that awards earn-points and qualifies referrals when an order reaches `completed`, using the multiplier at that moment — idempotent via the ledger unique key.
- `api/public/telegram/webhook` only if the bot itself must post updates.

## Phase 6-12 — Feature migration (order of work)

6. **Users** — auth server fn + `users`/`user_roles`; `useTelegramUser` gains a `useSession()` sibling; nothing else changes yet.
7. **Orders** — `orders` table + server fns behind a `useOrders()`/`useCreateOrder()` React Query layer. `stars`, `premium`, `orders`, `payment.$orderId` switch to the hooks; mock-store stays on disk untouched.
8. **Payments** — `payments` table; strictly separated `order_status ('draft','awaiting_payment','processing','completed','cancelled','expired')` vs `payment_status ('pending','submitted','verified','rejected')`. Manual card model preserved; countdown driven by `expires_at` from the DB.
9. **Loyalty** — levels/rewards/ledger in DB, awards server-side on completion, admin-editable config. `points.tsx`, `profile.tsx` read balances from the server.
10. **Referrals** — `ref_<telegramId>` code captured from `start_param`, attributed once at signup by the server, qualified on first completed order, reward written to the ledger. Self-referral and duplicates blocked by constraints.
11. **Profile** — same layout, data from a single `getMyProfile` server fn (stats, level, points, referrals, requests).
12. **Admin** — `/admin` moves under an authorization gate: server fns check `has_role`, the route hides itself for non-admins, and every mutation is logged to `admin_audit_log`.

## Phase 13-15 — Frontend data layer, cleanup, realtime

- Keep: `language.tsx`, i18n, all UI components, all page layouts.
- Add: `src/lib/*.functions.ts` server fns + `src/hooks/useOrders.ts`, `useProfile.ts`, `usePoints.ts`, `useMissions.ts`, `useReferrals.ts`, `useSettings.ts` — all React Query, loading via existing skeletons, errors via sonner toasts. Optimistic updates only for cancel-order and mission-complete.
- Replace the `"orders:changed"` window event with React Query invalidation, one feature at a time.
- Obsolete only at the very end, after each feature is verified: `mock-store.ts`, `loyalty.ts`, `referrals.ts`, `missions.ts` storage halves, `usePricing.ts` (rewritten), `PROFILE` constant.
- Realtime: worth it only for `orders`/`payments` status on the payment screen (user waits for admin approval) and the admin queue. Everywhere else, polling/invalidation is enough. Requires auth option (2), otherwise poll every 10s on the payment page only.

## Phase 16-18 — Production

- Hosting note: this project is built and deployed by Lovable (TanStack Start server runtime), not Netlify — Netlify static hosting cannot run the server functions this plan relies on. Worth confirming before Phase 16.
- Env: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` client-side only; `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, session secret server-only. Never in the bundle, never in the DB.
- Migrations applied through the migration tool in order, each phase its own migration; seed reference data (levels, rewards, settings) in the same migration.
- Testing per phase: new user, returning user, two users in parallel (cross-access must fail on RLS, verified with direct API calls, not just UI), order create/expire/cancel, payment submit → verify → complete, points awarded exactly once, referral self/duplicate blocked, admin-only endpoints rejected for normal users, Telegram Mini App on iOS/Android + browser fallback.

## Risks found in the current architecture

1. Points, tiers and referral rewards are computed in the browser — fully forgeable today; must move server-side before any real money flows.
2. `/admin` is completely unprotected.
3. Prices come from localStorage, so an order's amount is client-chosen.
4. The "unique amount" payment-matching trick collides silently once concurrent orders exist — needs a DB-level partial unique constraint and a retry loop.
5. `markPaid` self-delivers after 2.5s; real flow must wait for admin verification.
6. Referral attribution is single-device localStorage, so it cannot work across users at all.
7. Order expiry is computed at read time client-side; the DB must own `expires_at` and a sweeper.
8. Hardcoded `PROFILE` and card details need to become DB rows.

## Files unlikely to change

`src/components/ui/*`, `src/lib/i18n.ts`, `src/lib/language.tsx`, `src/lib/error-*.ts`, `src/styles.css`, `src/router.tsx`, page layout/markup (data sources swap, JSX stays).
