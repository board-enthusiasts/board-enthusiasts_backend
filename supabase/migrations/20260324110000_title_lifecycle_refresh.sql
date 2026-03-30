alter table public.titles
    drop constraint if exists titles_lifecycle_status_check,
    drop constraint if exists titles_visibility_check,
    drop constraint if exists titles_draft_private;

alter table public.title_releases
    drop constraint if exists title_releases_status_check;

update public.titles
set lifecycle_status = 'active'
where lifecycle_status in ('testing', 'published');

update public.titles
set visibility = 'unlisted'
where visibility = 'private'
   or lifecycle_status in ('draft', 'archived');

update public.title_releases
set status = case status
    when 'draft' then 'testing'
    when 'published' then 'production'
    when 'withdrawn' then 'testing'
    else status
end;

alter table public.titles
    add constraint titles_lifecycle_status_check check (lifecycle_status in ('draft', 'active', 'archived')),
    add constraint titles_visibility_check check (visibility in ('unlisted', 'listed')),
    add constraint titles_visibility_active_only check (visibility <> 'listed' or lifecycle_status = 'active');

alter table public.title_releases
    add constraint title_releases_status_check check (status in ('testing', 'production'));
