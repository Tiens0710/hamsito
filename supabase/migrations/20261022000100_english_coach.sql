create table if not exists public.english_coach_profiles (
  learner_id text primary key check (length(learner_id) between 1 and 100),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.english_coach_profiles enable row level security;
revoke all on public.english_coach_profiles from anon, authenticated;
grant all on public.english_coach_profiles to service_role;

create table if not exists public.english_coach_pairing_codes (
  code_hash text primary key check (length(code_hash) = 64),
  learner_id text not null check (length(learner_id) between 1 and 100),
  expires_at timestamptz not null
);

alter table public.english_coach_pairing_codes enable row level security;
revoke all on public.english_coach_pairing_codes from anon, authenticated;
grant all on public.english_coach_pairing_codes to service_role;
create index if not exists english_coach_pairing_codes_expires_at_idx
  on public.english_coach_pairing_codes (expires_at);
