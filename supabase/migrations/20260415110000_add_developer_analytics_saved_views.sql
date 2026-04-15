create table if not exists public.developer_analytics_saved_views (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.app_users(id) on delete cascade,
    subject_scope text not null check (subject_scope in ('studio', 'title')),
    name text not null check (char_length(btrim(name)) > 0 and char_length(name) <= 120),
    configuration jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_developer_analytics_saved_views_user_scope_updated_at
    on public.developer_analytics_saved_views(user_id, subject_scope, updated_at desc);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.developer_analytics_saved_views,
        public.analytics_events,
        public.title_get_clicks,
        public.title_detail_views,
        public.be_home_presence_sessions,
        public.be_home_device_identities,
        public.home_offering_spotlight_entries,
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

alter table public.developer_analytics_saved_views enable row level security;
