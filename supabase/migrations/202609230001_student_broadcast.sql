-- Run once in the SAME Supabase project as the personal-home students table.
-- No browser role can read or write device credentials, approvals or messages.
create table public.student_broadcast_devices (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  student_id text not null,
  label text not null check (char_length(label) between 1 and 60),
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  created_at timestamptz not null default now(),
  lease_hash text,
  session_hash text,
  expires_at timestamptz,
  heartbeat_at timestamptz,
  message_id uuid,
  message_text text check (char_length(message_text) <= 200),
  message_expires_at timestamptz
);
alter table public.student_broadcast_devices enable row level security;
revoke all on public.student_broadcast_devices from anon, authenticated;
grant select, insert, update, delete on public.student_broadcast_devices to service_role;
create index student_broadcast_active on public.student_broadcast_devices (status, expires_at);
