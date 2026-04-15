create table if not exists public.analytics_event_types (
    id uuid primary key default gen_random_uuid(),
    descriptor text not null unique,
    display_name text not null,
    internal_description text null,
    public_description text null,
    public_tooltip text null,
    subject_scope text not null check (subject_scope in ('studio', 'title')),
    aggregation_kind text not null check (aggregation_kind in ('event_count', 'unique_actor_count')),
    display_order integer not null default 0 check (display_order >= 0),
    is_active boolean not null default true,
    is_public boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
    id uuid primary key default gen_random_uuid(),
    event_type_id uuid not null references public.analytics_event_types(id) on delete cascade,
    studio_id uuid null references public.studios(id) on delete cascade,
    title_id uuid null references public.titles(id) on delete cascade,
    actor_user_id uuid null references public.app_users(id) on delete set null,
    actor_hash text null,
    occurred_at timestamptz not null default now(),
    surface text null,
    app_environment text null,
    country_code text null check (country_code is null or country_code ~ '^[A-Z]{2}$'),
    metadata jsonb null
);

create index if not exists idx_analytics_events_event_type_occurred_at
    on public.analytics_events(event_type_id, occurred_at desc);

create index if not exists idx_analytics_events_title_occurred_at
    on public.analytics_events(title_id, occurred_at desc);

create index if not exists idx_analytics_events_studio_occurred_at
    on public.analytics_events(studio_id, occurred_at desc);

insert into public.analytics_event_types (
    descriptor,
    display_name,
    internal_description,
    public_description,
    public_tooltip,
    subject_scope,
    aggregation_kind,
    display_order,
    is_active,
    is_public
)
values
    (
        'studio_followed',
        'Studio follows',
        'Counts successful player follow actions for a studio.',
        'How many times players chose to follow this studio during the selected time range.',
        'Each follow action is recorded with a timestamp when a player starts following the studio.',
        'studio',
        'event_count',
        10,
        true,
        true
    ),
    (
        'studio_unfollowed',
        'Studio unfollows',
        'Counts successful player unfollow actions for a studio.',
        'How many times players stopped following this studio during the selected time range.',
        'Each unfollow action is recorded with a timestamp when a player stops following the studio.',
        'studio',
        'event_count',
        20,
        true,
        true
    ),
    (
        'title_detail_viewed',
        'Title detail views',
        'Counts unique viewers who opened a title detail view.',
        'How many unique Boards or website visitors opened this title during the selected time range.',
        'This metric counts unique viewers in the selected range rather than every repeated page refresh.',
        'title',
        'unique_actor_count',
        10,
        true,
        true
    ),
    (
        'title_get_clicked',
        'Get Title clicks',
        'Counts unique viewers who clicked Get Title.',
        'How many unique visitors clicked Get Title for this title during the selected time range.',
        'This metric counts unique visitors in the selected range rather than every repeated click from the same viewer.',
        'title',
        'unique_actor_count',
        20,
        true,
        true
    ),
    (
        'title_wishlisted',
        'Added to wishlist',
        'Counts successful wishlist add actions for a title.',
        'How many times players added this title to their wishlist during the selected time range.',
        'Each successful add-to-wishlist action is recorded with its own timestamp.',
        'title',
        'event_count',
        30,
        true,
        true
    ),
    (
        'title_unwishlisted',
        'Removed from wishlist',
        'Counts successful wishlist removal actions for a title.',
        'How many times players removed this title from their wishlist during the selected time range.',
        'Each successful removal from wishlist is recorded with its own timestamp.',
        'title',
        'event_count',
        40,
        true,
        true
    ),
    (
        'title_added_to_library',
        'Added to library',
        'Counts successful library add actions for a title.',
        'How many times players added this title to their library during the selected time range.',
        'Each successful add-to-library action is recorded with its own timestamp.',
        'title',
        'event_count',
        50,
        true,
        true
    ),
    (
        'title_removed_from_library',
        'Removed from library',
        'Counts successful library removal actions for a title.',
        'How many times players removed this title from their library during the selected time range.',
        'Each successful library removal is recorded with its own timestamp.',
        'title',
        'event_count',
        60,
        true,
        true
    )
on conflict (descriptor) do update
set
    display_name = excluded.display_name,
    internal_description = excluded.internal_description,
    public_description = excluded.public_description,
    public_tooltip = excluded.public_tooltip,
    subject_scope = excluded.subject_scope,
    aggregation_kind = excluded.aggregation_kind,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    updated_at = now();

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
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

alter table public.analytics_event_types enable row level security;
alter table public.analytics_events enable row level security;
