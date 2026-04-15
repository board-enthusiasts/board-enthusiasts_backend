-- Best-effort historical bootstrap for the new analytics event log.
-- This backfills only the currently "on" membership state that still exists in the
-- live projection tables. It cannot reconstruct prior removals that were never logged.

with studio_follow_event_type as (
    select id
    from public.analytics_event_types
    where descriptor = 'studio_followed'
    limit 1
)
insert into public.analytics_events (
    event_type_id,
    studio_id,
    actor_user_id,
    occurred_at,
    surface,
    metadata
)
select
    event_type.id,
    follows.studio_id,
    follows.user_id,
    follows.created_at,
    'migration_backfill',
    jsonb_build_object(
        'source', 'current_state_backfill',
        'backfilled_from_table', 'player_followed_studios',
        'inferred_from_current_state', true
    )
from public.player_followed_studios follows
cross join studio_follow_event_type event_type
where not exists (
    select 1
    from public.analytics_events existing
    where existing.event_type_id = event_type.id
      and existing.studio_id = follows.studio_id
      and existing.actor_user_id = follows.user_id
);

with title_wishlisted_event_type as (
    select id
    from public.analytics_event_types
    where descriptor = 'title_wishlisted'
    limit 1
)
insert into public.analytics_events (
    event_type_id,
    studio_id,
    title_id,
    actor_user_id,
    occurred_at,
    surface,
    metadata
)
select
    event_type.id,
    titles.studio_id,
    wishlist.title_id,
    wishlist.user_id,
    wishlist.created_at,
    'migration_backfill',
    jsonb_build_object(
        'source', 'current_state_backfill',
        'backfilled_from_table', 'player_wishlist_titles',
        'inferred_from_current_state', true
    )
from public.player_wishlist_titles wishlist
inner join public.titles titles
    on titles.id = wishlist.title_id
cross join title_wishlisted_event_type event_type
where not exists (
    select 1
    from public.analytics_events existing
    where existing.event_type_id = event_type.id
      and existing.title_id = wishlist.title_id
      and existing.actor_user_id = wishlist.user_id
);

with title_added_to_library_event_type as (
    select id
    from public.analytics_event_types
    where descriptor = 'title_added_to_library'
    limit 1
)
insert into public.analytics_events (
    event_type_id,
    studio_id,
    title_id,
    actor_user_id,
    occurred_at,
    surface,
    metadata
)
select
    event_type.id,
    titles.studio_id,
    library.title_id,
    library.user_id,
    library.created_at,
    'migration_backfill',
    jsonb_build_object(
        'source', 'current_state_backfill',
        'backfilled_from_table', 'player_library_titles',
        'inferred_from_current_state', true
    )
from public.player_library_titles library
inner join public.titles titles
    on titles.id = library.title_id
cross join title_added_to_library_event_type event_type
where not exists (
    select 1
    from public.analytics_events existing
    where existing.event_type_id = event_type.id
      and existing.title_id = library.title_id
      and existing.actor_user_id = library.user_id
);
