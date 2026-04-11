create table if not exists public.be_home_device_identities (
    device_id_hash text primary key,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    first_country_code text null check (first_country_code is null or first_country_code ~ '^[A-Z]{2}$'),
    last_country_code text null check (last_country_code is null or last_country_code ~ '^[A-Z]{2}$'),
    last_client_version text null,
    last_device_id_source text null
);

create table if not exists public.be_home_presence_sessions (
    session_id text primary key,
    device_id_hash text not null references public.be_home_device_identities(device_id_hash) on delete cascade,
    auth_state text not null check (auth_state in ('anonymous', 'signed_in')),
    surface text not null default 'be_home' check (surface in ('be_home')),
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    ended_at timestamptz null,
    country_code text null check (country_code is null or country_code ~ '^[A-Z]{2}$'),
    client_version text null,
    app_environment text null,
    device_id_source text null
);

create index if not exists idx_be_home_device_identities_last_seen_at
    on public.be_home_device_identities(last_seen_at desc);

create index if not exists idx_be_home_presence_sessions_last_seen_at
    on public.be_home_presence_sessions(last_seen_at desc);

create index if not exists idx_be_home_presence_sessions_active_lookup
    on public.be_home_presence_sessions(ended_at, last_seen_at desc, auth_state);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.be_home_presence_sessions,
        public.be_home_device_identities,
        public.home_offering_spotlights,
        public.home_spotlight_entries,
        public.player_followed_studios,
        public.catalog_media_entries,
        public.catalog_media_type_definitions,
        public.title_showcase_media,
        public.title_metadata_version_genres,
        public.title_releases,
        public.title_metadata_versions,
        public.title_report_messages,
        public.title_reports,
        public.player_wishlist_titles,
        public.player_library_titles,
        public.title_media_assets,
        public.titles,
        public.age_rating_authorities,
        public.genres,
        public.studio_links,
        public.studio_memberships,
        public.studios,
        public.marketing_contact_role_interests,
        public.marketing_contacts,
        public.user_notifications,
        public.user_board_profiles,
        public.app_user_roles,
        public.app_users
    restart identity cascade;
$$;

alter table public.be_home_device_identities enable row level security;
alter table public.be_home_presence_sessions enable row level security;
