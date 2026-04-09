alter table public.catalog_media_type_definitions
  add column accepted_file_types jsonb not null default '[]'::jsonb;

update public.catalog_media_type_definitions
set accepted_file_types = case key
  when 'studio_avatar' then '["PNG","JPG","WEBP"]'::jsonb
  when 'studio_logo' then '["PNG","WEBP","SVG"]'::jsonb
  when 'studio_banner' then '["PNG","JPG","WEBP","SVG"]'::jsonb
  when 'title_avatar' then '["PNG","JPG","WEBP"]'::jsonb
  when 'title_card' then '["PNG","JPG","WEBP"]'::jsonb
  when 'title_logo' then '["PNG","WEBP","SVG"]'::jsonb
  when 'title_quick_view_banner' then '["PNG","JPG","WEBP","SVG"]'::jsonb
  when 'title_showcase' then '["PNG","JPG","WEBP","SVG"]'::jsonb
  else accepted_file_types
end;
