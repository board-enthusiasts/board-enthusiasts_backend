alter table public.analytics_event_types
    add column if not exists metric_kind text not null default 'tracked_event'
        check (metric_kind in ('tracked_event', 'conversion_rate', 'conversion_rate_comparison', 'net_change'));

alter table public.analytics_event_types
    add column if not exists value_format text not null default 'number'
        check (value_format in ('number', 'percentage'));

alter table public.analytics_event_types
    add column if not exists supports_date_range boolean not null default true;

alter table public.analytics_event_types
    add column if not exists calculation_config jsonb null;

insert into public.analytics_event_types (
    descriptor,
    display_name,
    internal_description,
    public_description,
    public_tooltip,
    subject_scope,
    aggregation_kind,
    metric_kind,
    value_format,
    supports_date_range,
    calculation_config,
    display_order,
    is_active,
    is_public
)
values
    (
        'title_view_to_wishlist_conversion',
        'Wishlist conversion',
        'Shows the share of title viewers who added the title to their wishlist during the selected time range.',
        'The share of visitors who added this title to their wishlist after opening it during the selected time range.',
        'This compares title views and wishlist adds from the same selected time range.',
        'title',
        'event_count',
        'conversion_rate',
        'percentage',
        true,
        jsonb_build_object(
            'numeratorDescriptor', 'title_wishlisted',
            'denominatorDescriptor', 'title_detail_viewed'
        ),
        25,
        true,
        true
    ),
    (
        'title_view_to_wishlist_conversion_change',
        'Wishlist conversion change',
        'Shows how the wishlist conversion rate changed compared with the previous matching time range.',
        'How the wishlist conversion rate changed compared with the previous matching time range.',
        'This compares the selected time range against the same amount of time immediately before it.',
        'title',
        'event_count',
        'conversion_rate_comparison',
        'percentage',
        true,
        jsonb_build_object(
            'numeratorDescriptor', 'title_wishlisted',
            'denominatorDescriptor', 'title_detail_viewed'
        ),
        26,
        true,
        true
    ),
    (
        'title_wishlist_net_change',
        'Wishlist net change',
        'Balances wishlist adds and removals together to show the overall direction of wishlist activity.',
        'The overall change in wishlists during the selected time range after additions and removals are balanced together.',
        'Positive values mean more players added the title than removed it during the selected time range.',
        'title',
        'event_count',
        'net_change',
        'number',
        true,
        jsonb_build_object(
            'addedDescriptor', 'title_wishlisted',
            'removedDescriptor', 'title_unwishlisted'
        ),
        45,
        true,
        true
    ),
    (
        'title_view_to_library_conversion',
        'Library conversion',
        'Shows the share of title viewers who added the title to their library during the selected time range.',
        'The share of visitors who added this title to their library after opening it during the selected time range.',
        'This compares title views and library adds from the same selected time range.',
        'title',
        'event_count',
        'conversion_rate',
        'percentage',
        true,
        jsonb_build_object(
            'numeratorDescriptor', 'title_added_to_library',
            'denominatorDescriptor', 'title_detail_viewed'
        ),
        55,
        true,
        true
    ),
    (
        'title_view_to_library_conversion_change',
        'Library conversion change',
        'Shows how the library conversion rate changed compared with the previous matching time range.',
        'How the library conversion rate changed compared with the previous matching time range.',
        'This compares the selected time range against the same amount of time immediately before it.',
        'title',
        'event_count',
        'conversion_rate_comparison',
        'percentage',
        true,
        jsonb_build_object(
            'numeratorDescriptor', 'title_added_to_library',
            'denominatorDescriptor', 'title_detail_viewed'
        ),
        56,
        true,
        true
    ),
    (
        'title_library_net_change',
        'Library net change',
        'Balances library adds and removals together to show the overall direction of library activity.',
        'The overall change in library adds during the selected time range after additions and removals are balanced together.',
        'Positive values mean more players added the title than removed it during the selected time range.',
        'title',
        'event_count',
        'net_change',
        'number',
        true,
        jsonb_build_object(
            'addedDescriptor', 'title_added_to_library',
            'removedDescriptor', 'title_removed_from_library'
        ),
        65,
        true,
        true
    ),
    (
        'studio_follow_net_change',
        'Follower net change',
        'Balances follows and unfollows together to show whether the studio gained or lost followers overall.',
        'The overall change in followers during the selected time range after follows and unfollows are balanced together.',
        'Positive values mean more players followed the studio than unfollowed it during the selected time range.',
        'studio',
        'event_count',
        'net_change',
        'number',
        true,
        jsonb_build_object(
            'addedDescriptor', 'studio_followed',
            'removedDescriptor', 'studio_unfollowed'
        ),
        30,
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
    metric_kind = excluded.metric_kind,
    value_format = excluded.value_format,
    supports_date_range = excluded.supports_date_range,
    calculation_config = excluded.calculation_config,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    updated_at = now();
