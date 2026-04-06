alter table public.titles
    alter column age_rating_authority drop not null,
    alter column age_rating_value drop not null;

alter table public.title_metadata_versions
    alter column age_rating_authority drop not null,
    alter column age_rating_value drop not null;

alter table public.title_releases
    add column if not exists expires_at timestamptz null;

create table if not exists public.title_showcase_media (
    id uuid primary key default gen_random_uuid(),
    title_id uuid not null references public.titles(id) on delete cascade,
    kind text not null check (kind in ('image', 'external_video')),
    image_url text null,
    image_storage_path text null,
    video_url text null,
    alt_text text null,
    display_order integer not null default 0 check (display_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_title_showcase_media_title_id
    on public.title_showcase_media(title_id);

create index if not exists idx_title_showcase_media_title_order
    on public.title_showcase_media(title_id, display_order, created_at);

create table if not exists public.player_followed_studios (
    user_id uuid not null references public.app_users(id) on delete cascade,
    studio_id uuid not null references public.studios(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, studio_id)
);

create index if not exists idx_player_followed_studios_user_id
    on public.player_followed_studios(user_id);

create table if not exists public.home_spotlight_entries (
    slot_number integer primary key check (slot_number between 1 and 3),
    title_id uuid not null references public.titles(id) on delete cascade,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.home_spotlight_entries,
        public.player_followed_studios,
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
        public.studio_links,
        public.studio_memberships,
        public.studios,
        public.user_board_profiles,
        public.app_user_roles,
        public.app_users
    restart identity cascade;
$$;

alter table public.title_showcase_media enable row level security;
alter table public.player_followed_studios enable row level security;
alter table public.home_spotlight_entries enable row level security;
