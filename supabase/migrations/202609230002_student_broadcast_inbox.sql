begin;

-- Independent of the old approval/lease table; existing v1 rows are not reused.
create table public.student_broadcast_clients (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  student_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  disabled_at timestamptz
);
create index student_broadcast_clients_student on public.student_broadcast_clients (student_id);

create table public.student_broadcast_inbox (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null,
  student_id text not null,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  read_at timestamptz,
  unique (broadcast_id, student_id)
);
create index student_broadcast_inbox_unread on public.student_broadcast_inbox (student_id, created_at, id) where read_at is null;

alter table public.student_broadcast_clients enable row level security;
alter table public.student_broadcast_inbox enable row level security;
revoke all on public.student_broadcast_clients, public.student_broadcast_inbox from anon, authenticated;
grant select, insert, update, delete on public.student_broadcast_clients, public.student_broadcast_inbox to service_role;

commit;
