alter table public.catalog_media_type_definitions
  add column recommended_width integer not null default 1 check (recommended_width > 0),
  add column recommended_height integer not null default 1 check (recommended_height > 0);

update public.catalog_media_type_definitions
set
  recommended_width = case key
    when 'studio_avatar' then 512
    when 'studio_logo' then 1200
    when 'studio_banner' then 1680
    when 'title_avatar' then 512
    when 'title_card' then 1200
    when 'title_logo' then 1200
    when 'title_quick_view_banner' then 1680
    when 'title_showcase' then 1920
    else recommended_width
  end,
  recommended_height = case key
    when 'studio_avatar' then 512
    when 'studio_logo' then 400
    when 'studio_banner' then 720
    when 'title_avatar' then 512
    when 'title_card' then 1200
    when 'title_logo' then 400
    when 'title_quick_view_banner' then 720
    when 'title_showcase' then 1080
    else recommended_height
  end;
