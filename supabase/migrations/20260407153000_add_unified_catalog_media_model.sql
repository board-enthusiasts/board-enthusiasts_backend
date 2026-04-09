create table if not exists public.catalog_media_type_definitions (
    key text primary key check (
        key in (
            'studio_avatar',
            'studio_logo',
            'studio_banner',
            'title_avatar',
            'title_card',
            'title_logo',
            'title_quick_view_banner',
            'title_showcase'
        )
    ),
    owner_kind text not null check (owner_kind in ('studio', 'title')),
    display_name text not null,
    usage_summary text not null,
    bucket_name text not null check (bucket_name in ('avatars', 'card-images', 'hero-images', 'logo-images')),
    max_upload_bytes integer not null check (max_upload_bytes > 0),
    accepted_mime_types jsonb not null default '[]'::jsonb,
    aspect_width integer not null check (aspect_width > 0),
    aspect_height integer not null check (aspect_height > 0),
    allows_multiple boolean not null default false,
    supports_video boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.catalog_media_entries (
    id uuid primary key default gen_random_uuid(),
    studio_id uuid null references public.studios(id) on delete cascade,
    title_id uuid null references public.titles(id) on delete cascade,
    media_type_key text not null references public.catalog_media_type_definitions(key) on delete restrict,
    kind text not null check (kind in ('image', 'external_video')),
    source_url text null,
    storage_path text null,
    preview_image_url text null,
    preview_storage_path text null,
    video_url text null,
    alt_text text null,
    mime_type text null,
    width integer null,
    height integer null,
    display_order integer not null default 0 check (display_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint catalog_media_entries_owner check (
        (studio_id is not null and title_id is null)
        or (studio_id is null and title_id is not null)
    ),
    constraint catalog_media_entries_source_by_kind check (
        (kind = 'image' and source_url is not null and preview_image_url is null and video_url is null)
        or (kind = 'external_video' and source_url is null and video_url is not null)
    ),
    constraint catalog_media_entries_dimensions_pair check (
        (width is null and height is null)
        or (width is not null and height is not null and width > 0 and height > 0)
    )
);

create index if not exists idx_catalog_media_entries_studio
    on public.catalog_media_entries(studio_id, media_type_key, display_order, created_at);

create index if not exists idx_catalog_media_entries_title
    on public.catalog_media_entries(title_id, media_type_key, display_order, created_at);

create unique index if not exists uq_catalog_media_entries_studio_single
    on public.catalog_media_entries(studio_id, media_type_key)
    where studio_id is not null;

create unique index if not exists uq_catalog_media_entries_title_single
    on public.catalog_media_entries(title_id, media_type_key)
    where title_id is not null and media_type_key <> 'title_showcase';

insert into public.catalog_media_type_definitions (
    key,
    owner_kind,
    display_name,
    usage_summary,
    bucket_name,
    max_upload_bytes,
    accepted_mime_types,
    aspect_width,
    aspect_height,
    allows_multiple,
    supports_video
)
values
    (
        'studio_avatar',
        'studio',
        'Studio avatar',
        'Used in compact studio identity spots, such as the square studio icon on studio cards and studio headers.',
        'avatars',
        262144,
        '["image/webp","image/jpeg","image/png"]'::jsonb,
        1,
        1,
        false,
        false
    ),
    (
        'studio_logo',
        'studio',
        'Studio logo',
        'Used where the studio needs a horizontal brand mark or wordmark.',
        'logo-images',
        262144,
        '["image/webp","image/png","image/svg+xml"]'::jsonb,
        3,
        1,
        false,
        false
    ),
    (
        'studio_banner',
        'studio',
        'Studio banner',
        'Used as the wide studio header image at the top of studio surfaces.',
        'hero-images',
        3145728,
        '["image/webp","image/jpeg","image/png","image/svg+xml"]'::jsonb,
        21,
        9,
        false,
        false
    ),
    (
        'title_avatar',
        'title',
        'Title avatar',
        'Used in compact title identity spots, such as the small image beside the title name on cards and quick views.',
        'avatars',
        262144,
        '["image/webp","image/jpeg","image/png"]'::jsonb,
        1,
        1,
        false,
        false
    ),
    (
        'title_card',
        'title',
        'Title card',
        'Used on browse tiles and other square title discovery cards.',
        'card-images',
        1572864,
        '["image/webp","image/jpeg","image/png"]'::jsonb,
        1,
        1,
        false,
        false
    ),
    (
        'title_logo',
        'title',
        'Title logo',
        'Used for large horizontal title branding where a wordmark fits naturally.',
        'logo-images',
        262144,
        '["image/webp","image/png","image/svg+xml"]'::jsonb,
        3,
        1,
        false,
        false
    ),
    (
        'title_quick_view_banner',
        'title',
        'Title quick view banner',
        'Used in the wide thin image strip at the top of title quick view.',
        'hero-images',
        3145728,
        '["image/webp","image/jpeg","image/png","image/svg+xml"]'::jsonb,
        21,
        9,
        false,
        false
    ),
    (
        'title_showcase',
        'title',
        'Title showcase',
        'Used for title screenshots and videos in the full title gallery. The first item becomes the default title detail image.',
        'hero-images',
        3145728,
        '["image/webp","image/jpeg","image/png","image/svg+xml"]'::jsonb,
        16,
        9,
        true,
        true
    )
on conflict (key) do update
set
    owner_kind = excluded.owner_kind,
    display_name = excluded.display_name,
    usage_summary = excluded.usage_summary,
    bucket_name = excluded.bucket_name,
    max_upload_bytes = excluded.max_upload_bytes,
    accepted_mime_types = excluded.accepted_mime_types,
    aspect_width = excluded.aspect_width,
    aspect_height = excluded.aspect_height,
    allows_multiple = excluded.allows_multiple,
    supports_video = excluded.supports_video,
    updated_at = now();

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    gen_random_uuid(),
    s.id,
    null,
    'studio_avatar',
    'image',
    s.avatar_url,
    s.avatar_storage_path,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    0,
    now(),
    now()
from public.studios s
where s.avatar_url is not null
  and not exists (
      select 1
      from public.catalog_media_entries existing
      where existing.studio_id = s.id
        and existing.media_type_key = 'studio_avatar'
  );

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    gen_random_uuid(),
    s.id,
    null,
    'studio_logo',
    'image',
    s.logo_url,
    s.logo_storage_path,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    0,
    now(),
    now()
from public.studios s
where s.logo_url is not null
  and not exists (
      select 1
      from public.catalog_media_entries existing
      where existing.studio_id = s.id
        and existing.media_type_key = 'studio_logo'
  );

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    gen_random_uuid(),
    s.id,
    null,
    'studio_banner',
    'image',
    s.banner_url,
    s.banner_storage_path,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    0,
    now(),
    now()
from public.studios s
where s.banner_url is not null
  and not exists (
      select 1
      from public.catalog_media_entries existing
      where existing.studio_id = s.id
        and existing.media_type_key = 'studio_banner'
  );

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    gen_random_uuid(),
    null,
    tma.title_id,
    case
        when tma.media_role = 'card' then 'title_card'
        when tma.media_role = 'logo' then 'title_logo'
    end,
    'image',
    tma.source_url,
    tma.storage_path,
    null,
    null,
    null,
    tma.alt_text,
    tma.mime_type,
    tma.width,
    tma.height,
    0,
    tma.created_at,
    tma.updated_at
from public.title_media_assets tma
where tma.media_role in ('card', 'logo')
  and not exists (
      select 1
      from public.catalog_media_entries existing
      where existing.title_id = tma.title_id
        and existing.media_type_key = case when tma.media_role = 'card' then 'title_card' else 'title_logo' end
  );

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    gen_random_uuid(),
    null,
    tma.title_id,
    'title_showcase',
    'image',
    tma.source_url,
    tma.storage_path,
    null,
    null,
    null,
    tma.alt_text,
    tma.mime_type,
    tma.width,
    tma.height,
    0,
    tma.created_at,
    tma.updated_at
from public.title_media_assets tma
where tma.media_role = 'hero'
  and not exists (
      select 1
      from public.catalog_media_entries existing
      where existing.title_id = tma.title_id
        and existing.media_type_key = 'title_showcase'
  );

insert into public.catalog_media_entries (
    id,
    studio_id,
    title_id,
    media_type_key,
    kind,
    source_url,
    storage_path,
    preview_image_url,
    preview_storage_path,
    video_url,
    alt_text,
    mime_type,
    width,
    height,
    display_order,
    created_at,
    updated_at
)
select
    tsm.id,
    null,
    tsm.title_id,
    'title_showcase',
    tsm.kind,
    case when tsm.kind = 'image' then tsm.image_url else null end,
    case when tsm.kind = 'image' then tsm.image_storage_path else null end,
    case when tsm.kind = 'external_video' then tsm.image_url else null end,
    case when tsm.kind = 'external_video' then tsm.image_storage_path else null end,
    tsm.video_url,
    tsm.alt_text,
    null,
    null,
    null,
    tsm.display_order,
    tsm.created_at,
    tsm.updated_at
from public.title_showcase_media tsm
where not exists (
    select 1
    from public.catalog_media_entries existing
    where existing.id = tsm.id
);

create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
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
        public.studio_links,
        public.studio_memberships,
        public.studios,
        public.user_board_profiles,
        public.app_user_roles,
        public.app_users
    restart identity cascade;
$$;

alter table public.catalog_media_type_definitions enable row level security;
alter table public.catalog_media_entries enable row level security;
