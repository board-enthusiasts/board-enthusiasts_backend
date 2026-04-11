alter table public.be_home_presence_sessions
    drop constraint if exists be_home_presence_sessions_surface_check;

alter table public.be_home_presence_sessions
    add constraint be_home_presence_sessions_surface_check
    check (surface in ('be_home', 'be_website'));
