# Migration: mock data → real backend

Goal: every screen reads and writes real data through the server functions already built, with no UI/UX changes. No new features.

## Small backend gaps to close first

The screens need three things the server layer doesn't expose yet:

1. **Public app config** — pricing (star price, premium prices, min/max stars) and maintenance mode. Today `usePricing` and `MaintenanceGate` read localStorage. Add one public config server function returning pricing + maintenance + bot username, and rewrite both to read it (React Query, cached).
2. **Admin mission management** — the admin screen creates/edits/deletes missions in localStorage. Add admin-only create/update/delete mission server functions (audit-logged, same as the other admin actions).
3. **Data shape adapters** — the DB uses `awaiting_payment / processing / completed / cancelled / expired` while the UI renders `active / paid / delivered / expired`. Map statuses in a small helper so the existing badges, colours and labels stay exactly as they are.

## Screen-by-screen

Each screen moves to React Query (`useQuery` / `useMutation`) against its server function, keeps its current markup, and gets:
- a loading state reusing the existing skeleton style (`animate-pulse` card) where the screen already has one, otherwise a matching one,
- an inline error message with retry, in the current card style and the current translation system,
- cache invalidation after mutations instead of the `orders:changed` window event.

| Screen | Replaces | Uses |
| --- | --- | --- |
| Stars / Premium | `createOrder` from mock-store, `usePricing`, `useTelegramUser` | `createOrder`, config fn, `useSession` |
| Payment | mock `getOrder` / `markPaid` / `cancelOrder`, hardcoded card details | `getMyOrder`, `submitPayment`, `cancelOrder`, `getPaymentInfo` |
| Orders | `getOrders` | `listMyOrders` (polling kept at the current 30s) |
| Points | localStorage loyalty store | `getLoyaltyConfig`, `getMyProfile`, `getMyLedger`, `getMyRewardRequests`, `redeemReward` |
| Referral | `lib/referrals` localStorage | `getMyReferrals` |
| Missions | `lib/missions` localStorage | `listMissions`, `completeMission` |
| Profile | `lib/loyalty` PROFILE + mock orders | `getMyProfile`, `getMyReferrals` |
| Admin | mock pricing/maintenance/loyalty/missions | all `admin.functions` + new mission CRUD |

Route order: Stars → Premium → Payment → Orders → Points → Referral → Missions → Profile → Admin, one at a time.

## Authorization and identity

- `useTelegramUser` is deleted; screens take identity from `useSession` (the verified server session). `initDataUnsafe` is no longer read anywhere.
- Admin route: gated on the server-verified `isAdmin` flag, showing a "not authorized" state instead of the panel; every admin server function keeps its own `requireAdmin` check, so the UI gate is only cosmetic.
- Points, levels, referral rewards and order completion stay server-computed — the client only displays them.
- `ALLOW_DEV_AUTH` stays `true` for preview/development, with a production guard (below).

## Dev authentication guard

Dev auth currently turns on whenever `ALLOW_DEV_AUTH === "true"`, with no notion of environment — a leftover value would silently let anyone sign in as a fake Telegram user in production. Tighten it to:

- Detect production on the server (build/runtime environment flag plus an explicit `APP_ENV`/deploy indicator), independent of the dev-auth variable itself.
- In production, `ALLOW_DEV_AUTH` must be explicitly `"false"`. Any other value — `"true"`, empty, or unset — is a misconfiguration.
- On that misconfiguration the app fails safely: dev auth is never granted, the authenticate call rejects with a clear configuration error instead of issuing a session, and the failure is logged server-side once at startup of the request path so it's visible in logs.
- Outside production, `ALLOW_DEV_AUTH=true` behaves exactly as today.
- The dev-user branch in `authenticate` is unreachable in production regardless of the flag, so a signed `initData` is the only way to get a session there.
- Note in the project docs/README that going live requires setting `ALLOW_DEV_AUTH=false`.


## Cleanup

Delete `src/lib/mock-store.ts` (keeping `formatAmount` / label helpers in a small `src/lib/format.ts`), `src/lib/loyalty.ts`, `src/lib/referrals.ts`, `src/lib/missions.ts`, `src/hooks/useTelegramUser.ts`, `src/hooks/usePricing.ts` (rewritten against the config fn), and the `orders:changed` event listeners.

## Verification

There is no test suite in the project today, so verification is: typecheck, lint, production build, plus a Playwright pass over every migrated screen (create an order, submit payment, view orders/points/referral/missions/profile, load admin) capturing screenshots and console/network errors. I'll report anything still broken, including anything that needs a real Telegram context to exercise.
