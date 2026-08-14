# Loyalty system

## Overview
Users earn **Star Points** on every completed purchase. Points never expire and live in a
per-user ledger. Membership tiers increase the point multiplier applied to each purchase.

## Progression rule (admin-configurable)
Default: **lifetime Stars purchased**. Alternatives selectable in admin settings without code
changes: lifetime spending (UZS) or completed order count.

## Tiers (defaults)

| Tier | Emoji | Threshold (lifetime Stars) | Multiplier |
| --- | --- | --- | --- |
| New | 🆕 | 0 | ×1.00 |
| Bronze | 🥉 | 1,000 | ×1.10 |
| Silver | 🥈 | 5,000 | ×1.25 |
| Gold | 🥇 | 15,000 | ×1.50 |
| Diamond | 💎 | 40,000 | ×2.00 |

## Point formula
```
points = round(StarsPurchased × base_rate × tier_multiplier_at_purchase_time)
```
Default `base_rate = 0.1`. The tier used is the one held **at the time of the purchase**, so
history is never rewritten when a user levels up.

## Rewards (admin-configurable)
| Cost | Reward |
| --- | --- |
| 500 points | 50 Telegram Stars |
| 1,000 points | 100 Telegram Stars |

Costs, outputs and the redemption cooldown are edited in Admin settings.

## Redemption flow
```
User clicks Redeem
  → points deducted (ledger entry)
  → Reward Request created  (status: pending)
  → Admin approves          (status: approved)
  → Admin sends Stars manually, marks done (status: completed)
  → or rejects              (status: rejected → points refunded)
```
Statuses shown on the profile: 🟡 pending · 🔵 approved · 🟢 completed · 🔴 rejected.

## Admin settings
`/admin` exposes: progression rule, base rate, per-tier thresholds and multipliers, reward
costs/outputs, redemption cooldown, plus the reward-request queue with Approve / Sent / Reject
actions.

## Data model (client mock)
- `LoyaltySettings` — persisted config (`starkerak.loyalty.settings.v1`)
- `LedgerEntry` — `earn | referral | redeem | refund` (earn entries derived from completed orders)
- `RewardRequest` — id, user, tier, cost, stars, status, timestamps

This build stores everything in localStorage. When a backend is added, the same shapes map to
`PointsLedger`, `Tier` and `UserProfile` tables with `GET /user/:id/points`,
`GET /user/:id/tier`, `POST /user/:id/redeem` and admin settings endpoints.

## Localization
Profile/loyalty strings live in `src/lib/i18n.ts` (Uzbek).

## Referral program
Referrers earn **Star Points**, never free Stars.

```
Share https://t.me/Starbbot?start=ref_<telegramId>
  → friend registers (pending)
  → friend completes first purchase
  → referrer receives +50 Star Points (ledger type: referral)
```

Admin settings expose the points per referral (default 50) and whether the bonus fires on
registration or on the friend's first purchase (default). Client mock lives in
`src/lib/referrals.ts` (`starbbot.referrals.v1`); real cross-user attribution needs a backend.
