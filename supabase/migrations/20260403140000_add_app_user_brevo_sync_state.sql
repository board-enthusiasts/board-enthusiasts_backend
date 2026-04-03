alter table public.app_users
    add column if not exists brevo_contact_id text null,
    add column if not exists brevo_sync_state text not null default 'pending'
        check (brevo_sync_state in ('pending', 'synced', 'skipped', 'failed')),
    add column if not exists brevo_synced_at timestamptz null,
    add column if not exists brevo_last_error text null;
