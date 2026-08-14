-- ========== enums ==========
create type public.app_role as enum ('admin','user');
create type public.product_type as enum ('stars','premium_3','premium_6','premium_12');
create type public.order_status as enum ('draft','awaiting_payment','processing','completed','cancelled','expired');
create type public.payment_status as enum ('pending','submitted','verified','rejected');
create type public.ledger_type as enum ('earn','referral','mission','redeem','refund','adjust');
create type public.request_status as enum ('pending','approved','completed','rejected');
create type public.referral_status as enum ('pending','qualified','rewarded');

-- ========== shared trigger ==========
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ========== users ==========
create table public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  language_code text,
  referral_code text not null unique,
  referred_by uuid references public.users(id) on delete set null,
  is_blocked boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_no_self_referral check (referred_by is null or referred_by <> id)
);
create index users_referred_by_idx on public.users(referred_by);
create index users_username_idx on public.users(lower(username));
grant all on public.users to service_role;
alter table public.users enable row level security;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ========== roles ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- ========== settings ==========
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings(key, value) values
  ('pricing', '{"starPriceUzs":200,"premium":{"3":55000,"6":95000,"12":170000},"minStars":50,"maxStars":5000}'::jsonb),
  ('payment', '{"cardNumber":"9860 1666 5354 5375","cardHolder":"E. Z.","orderExpireMinutes":10}'::jsonb),
  ('maintenance', '{"enabled":false,"message":""}'::jsonb),
  ('loyalty', '{"progressionRule":"lifetime_stars","baseRate":0.1,"redeemCooldownMinutes":5,"referralPoints":50,"referralAwardOn":"first_purchase"}'::jsonb);

-- ========== loyalty levels ==========
create table public.loyalty_levels (
  key text primary key,
  name text not null,
  emoji text not null,
  threshold integer not null check (threshold >= 0),
  multiplier numeric(4,2) not null check (multiplier > 0),
  stars smallint not null default 1,
  gradient text not null default 'var(--gradient-primary)',
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.loyalty_levels to service_role;
alter table public.loyalty_levels enable row level security;
create trigger loyalty_levels_updated_at before update on public.loyalty_levels
  for each row execute function public.set_updated_at();

insert into public.loyalty_levels(key,name,emoji,threshold,multiplier,stars,gradient,sort_order) values
  ('new','New','🆕',0,1.00,1,'var(--gradient-primary)',1),
  ('bronze','Bronze','🥉',1000,1.10,2,'linear-gradient(135deg,#8a5a2b,#c98b4b)',2),
  ('silver','Silver','🥈',5000,1.25,3,'linear-gradient(135deg,#7c8794,#c3ccd6)',3),
  ('gold','Gold','🥇',15000,1.50,4,'linear-gradient(135deg,#b8860b,#f5c542)',4),
  ('diamond','Diamond','💎',40000,2.00,5,'linear-gradient(135deg,#2a7bd6,#67e8f9)',5);

-- ========== rewards ==========
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  cost_points integer not null check (cost_points > 0),
  output_stars integer not null check (output_stars > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.rewards to service_role;
alter table public.rewards enable row level security;
create trigger rewards_updated_at before update on public.rewards
  for each row execute function public.set_updated_at();

insert into public.rewards(cost_points, output_stars) values (500,50),(1000,100);

-- ========== orders ==========
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigserial not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  recipient_username text not null check (recipient_username ~ '^[a-zA-Z][a-zA-Z0-9_]{2,31}$'),
  product_type public.product_type not null,
  quantity integer not null check (quantity > 0),
  unit_price_uzs integer not null check (unit_price_uzs > 0),
  base_amount_uzs integer not null check (base_amount_uzs > 0),
  amount_uzs integer not null check (amount_uzs > 0),
  status public.order_status not null default 'awaiting_payment',
  expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status);
create unique index orders_open_amount_unique
  on public.orders(amount_uzs) where status in ('awaiting_payment','processing');
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ========== payments ==========
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  method text not null default 'manual_card',
  declared_amount_uzs integer not null check (declared_amount_uzs > 0),
  payer_note text,
  receipt_url text,
  status public.payment_status not null default 'pending',
  submitted_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_one_open_per_order
  on public.payments(order_id) where status <> 'rejected';
create index payments_status_idx on public.payments(status);
create index payments_user_idx on public.payments(user_id, created_at desc);
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ========== points ledger ==========
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.ledger_type not null,
  points integer not null,
  note text not null default '',
  order_id uuid references public.orders(id) on delete set null,
  reward_request_id uuid,
  mission_id uuid,
  referral_id uuid,
  created_at timestamptz not null default now()
);
create index points_ledger_user_idx on public.points_ledger(user_id, created_at desc);
create unique index points_ledger_order_once
  on public.points_ledger(user_id, type, order_id) where order_id is not null;
create unique index points_ledger_mission_once
  on public.points_ledger(user_id, mission_id) where mission_id is not null;
create unique index points_ledger_referral_once
  on public.points_ledger(referral_id) where referral_id is not null;
grant all on public.points_ledger to service_role;
alter table public.points_ledger enable row level security;

create or replace function public.user_points(_user_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(points),0)::int from public.points_ledger where user_id = _user_id;
$$;

-- ========== reward requests ==========
create table public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  request_no bigserial not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  cost_points integer not null check (cost_points > 0),
  output_stars integer not null check (output_stars > 0),
  level_key text,
  level_name text,
  level_emoji text,
  status public.request_status not null default 'pending',
  handled_by uuid references public.users(id) on delete set null,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reward_requests_user_idx on public.reward_requests(user_id, created_at desc);
create index reward_requests_status_idx on public.reward_requests(status);
grant all on public.reward_requests to service_role;
alter table public.reward_requests enable row level security;
create trigger reward_requests_updated_at before update on public.reward_requests
  for each row execute function public.set_updated_at();

alter table public.points_ledger
  add constraint points_ledger_request_fk
  foreign key (reward_request_id) references public.reward_requests(id) on delete set null;

-- ========== referrals ==========
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null unique references public.users(id) on delete cascade,
  status public.referral_status not null default 'pending',
  qualified_at timestamptz,
  rewarded_at timestamptz,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_no_self check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals(referrer_id, created_at desc);
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;
create trigger referrals_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

alter table public.points_ledger
  add constraint points_ledger_referral_fk
  foreign key (referral_id) references public.referrals(id) on delete set null;

-- ========== missions ==========
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  url text not null default '',
  points integer not null check (points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.missions to service_role;
alter table public.missions enable row level security;
create trigger missions_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  points integer not null check (points >= 0),
  completed_at timestamptz not null default now(),
  unique (user_id, mission_id)
);
create index mission_completions_user_idx on public.mission_completions(user_id, completed_at desc);
grant all on public.mission_completions to service_role;
alter table public.mission_completions enable row level security;

alter table public.points_ledger
  add constraint points_ledger_mission_fk
  foreign key (mission_id) references public.missions(id) on delete set null;

-- ========== admin audit log ==========
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;

-- ========== business logic ==========

create or replace function public.level_for(_value numeric)
returns public.loyalty_levels language sql stable security definer set search_path = public as $$
  select l.* from public.loyalty_levels l
  where l.threshold <= _value
  order by l.threshold desc limit 1;
$$;

create or replace function public.user_progress_value(_user_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity),0)::int from public.orders
  where user_id = _user_id and status = 'completed' and product_type = 'stars';
$$;

create or replace function public.complete_order(_order_id uuid, _actor uuid default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  lvl public.loyalty_levels;
  base_rate numeric;
  ref_points integer;
  pts integer;
  progress integer;
  r public.referrals;
begin
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'completed' then return o; end if;
  if o.status in ('cancelled','expired') then raise exception 'order_terminal'; end if;

  update public.orders set status='completed', completed_at=now() where id=o.id returning * into o;

  select coalesce((value->>'baseRate')::numeric, 0.1),
         coalesce((value->>'referralPoints')::int, 50)
    into base_rate, ref_points from public.app_settings where key='loyalty';
  base_rate := coalesce(base_rate, 0.1);
  ref_points := coalesce(ref_points, 50);

  if o.product_type = 'stars' then
    progress := public.user_progress_value(o.user_id) - o.quantity;
    if progress < 0 then progress := 0; end if;
    select * into lvl from public.level_for(progress);
    pts := round(o.quantity * base_rate * coalesce(lvl.multiplier,1));
    if pts > 0 then
      insert into public.points_ledger(user_id, type, points, note, order_id)
      values (o.user_id, 'earn', pts,
              o.quantity || ' Stars · ' || coalesce(lvl.emoji,'') || ' ' || coalesce(lvl.name,'') || ' ×' || coalesce(lvl.multiplier,1),
              o.id)
      on conflict do nothing;
    end if;
  end if;

  select * into r from public.referrals where referred_id = o.user_id for update;
  if found and r.status = 'pending' then
    update public.referrals
      set status='rewarded', qualified_at=now(), rewarded_at=now(), points_awarded=ref_points
      where id=r.id returning * into r;
    insert into public.points_ledger(user_id, type, points, note, referral_id)
    values (r.referrer_id, 'referral', ref_points, 'Referral bonus', r.id)
    on conflict do nothing;
  end if;

  if _actor is not null then
    insert into public.admin_audit_log(actor_id, action, entity, entity_id, payload)
    values (_actor, 'complete_order', 'orders', o.id::text, jsonb_build_object('order_no', o.order_no));
  end if;

  return o;
end; $$;

create or replace function public.redeem_reward(_user_id uuid, _reward_id uuid)
returns public.reward_requests language plpgsql security definer set search_path = public as $$
declare
  rw public.rewards;
  balance integer;
  cooldown integer;
  last_at timestamptz;
  lvl public.loyalty_levels;
  req public.reward_requests;
begin
  select * into rw from public.rewards where id=_reward_id and active;
  if not found then raise exception 'unknown_reward'; end if;

  perform 1 from public.users where id=_user_id for update;

  select coalesce((value->>'redeemCooldownMinutes')::int, 5) into cooldown
    from public.app_settings where key='loyalty';
  cooldown := coalesce(cooldown, 5);

  select max(created_at) into last_at from public.reward_requests where user_id=_user_id;
  if last_at is not null and now() - last_at < make_interval(mins => cooldown) then
    raise exception 'cooldown';
  end if;

  balance := public.user_points(_user_id);
  if balance < rw.cost_points then raise exception 'insufficient'; end if;

  select * into lvl from public.level_for(public.user_progress_value(_user_id));

  insert into public.reward_requests(user_id, reward_id, cost_points, output_stars, level_key, level_name, level_emoji)
  values (_user_id, rw.id, rw.cost_points, rw.output_stars, lvl.key, lvl.name, lvl.emoji)
  returning * into req;

  insert into public.points_ledger(user_id, type, points, note, reward_request_id)
  values (_user_id, 'redeem', -rw.cost_points, rw.output_stars || ' Telegram Stars · #' || req.request_no, req.id);

  return req;
end; $$;

create or replace function public.reject_reward_request(_request_id uuid, _actor uuid, _reason text default null)
returns public.reward_requests language plpgsql security definer set search_path = public as $$
declare req public.reward_requests;
begin
  select * into req from public.reward_requests where id=_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if req.status = 'rejected' then return req; end if;

  update public.reward_requests set status='rejected', handled_by=_actor, reject_reason=_reason
    where id=req.id returning * into req;

  if not exists (select 1 from public.points_ledger where reward_request_id=req.id and type='refund') then
    insert into public.points_ledger(user_id, type, points, note, reward_request_id)
    values (req.user_id, 'refund', req.cost_points, 'Request #' || req.request_no || ' rejected — refunded', req.id);
  end if;

  insert into public.admin_audit_log(actor_id, action, entity, entity_id, payload)
  values (_actor, 'reject_reward_request', 'reward_requests', req.id::text, jsonb_build_object('reason', _reason));

  return req;
end; $$;

create or replace function public.complete_mission(_user_id uuid, _mission_id uuid)
returns public.mission_completions language plpgsql security definer set search_path = public as $$
declare m public.missions; c public.mission_completions;
begin
  select * into m from public.missions where id=_mission_id and active;
  if not found then raise exception 'unknown_mission'; end if;

  insert into public.mission_completions(user_id, mission_id, points)
  values (_user_id, m.id, m.points)
  on conflict (user_id, mission_id) do nothing
  returning * into c;

  if c.id is null then raise exception 'already_completed'; end if;

  insert into public.points_ledger(user_id, type, points, note, mission_id)
  values (_user_id, 'mission', m.points, m.title, m.id)
  on conflict do nothing;

  return c;
end; $$;

create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with upd as (
    update public.orders set status='expired'
    where status='awaiting_payment' and expires_at < now()
      and not exists (select 1 from public.payments p where p.order_id=orders.id and p.status in ('submitted','verified'))
    returning 1
  ) select count(*) into n from upd;
  return coalesce(n,0);
end; $$;

revoke all on function public.complete_order(uuid,uuid) from public, anon, authenticated;
revoke all on function public.redeem_reward(uuid,uuid) from public, anon, authenticated;
revoke all on function public.reject_reward_request(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_mission(uuid,uuid) from public, anon, authenticated;
revoke all on function public.expire_stale_orders() from public, anon, authenticated;