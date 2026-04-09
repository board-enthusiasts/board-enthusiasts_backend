alter table public.titles
  add column max_players_or_more boolean not null default false;

alter table public.title_metadata_versions
  add column max_players_or_more boolean not null default false;
