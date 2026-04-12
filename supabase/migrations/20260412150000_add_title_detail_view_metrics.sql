create table if not exists public.title_detail_views (
    title_id uuid not null references public.titles(id) on delete cascade,
    viewer_hash text not null,
    viewer_source text not null check (viewer_source in ('ip_address', 'visitor_id', 'be_home_device')),
    auth_state text not null check (auth_state in ('anonymous', 'authenticated')),
    studio_slug text null,
    title_slug text null,
    surface text null,
    app_environment text null,
    first_viewed_at timestamptz not null default now(),
    last_viewed_at timestamptz not null default now(),
    first_country_code text null check (first_country_code is null or first_country_code ~ '^[A-Z]{2}$'),
    last_country_code text null check (last_country_code is null or last_country_code ~ '^[A-Z]{2}$'),
    primary key (title_id, viewer_hash)
);

create index if not exists idx_title_detail_views_title_id
    on public.title_detail_views(title_id);

create index if not exists idx_title_detail_views_last_viewed_at
    on public.title_detail_views(last_viewed_at desc);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.title_detail_views,
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

alter table public.title_detail_views enable row level security;
