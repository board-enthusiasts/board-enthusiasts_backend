create table if not exists public.home_offering_spotlight_entries (
    slot_number integer primary key check (slot_number between 1 and 3),
    eyebrow text not null,
    title text not null,
    description text not null,
    status_label text not null,
    glyph text not null check (glyph in ('api', 'discord', 'library', 'spark', 'toolkit', 'youtube')),
    action_label text null,
    action_url text null,
    action_external boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint home_offering_spotlight_action_pair_check
        check (
            (action_label is null and action_url is null)
            or (action_label is not null and action_url is not null)
        )
);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.home_offering_spotlight_entries,
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

alter table public.home_offering_spotlight_entries enable row level security;
