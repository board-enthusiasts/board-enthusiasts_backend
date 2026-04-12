create or replace function public.reset_migration_demo_data()
returns void
language sql
security definer
as $$
    truncate table
        public.title_detail_views,
        public.be_home_presence_sessions,
        public.be_home_device_identities,
        public.home_offering_spotlight_entries,
        public.home_spotlight_entries,
        public.player_followed_studios,
        public.catalog_media_entries,
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
        public.marketing_contact_role_interests,
        public.marketing_contacts,
        public.user_notifications,
        public.user_board_profiles,
        public.app_user_roles,
        public.app_users
    restart identity cascade;
$$;
