begin;

create table public.private_message_media (
  id uuid primary key,
  student_id text not null,
  chat_type text not null check (chat_type in ('家長', '學生')),
  sender_role text not null check (sender_role in ('家長', '學生')),
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  caption text not null default '' check (char_length(caption) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index private_message_media_thread on public.private_message_media (student_id, chat_type, created_at desc);
create index private_message_media_unread on public.private_message_media (student_id, chat_type) where read_at is null;
alter table public.private_message_media enable row level security;
revoke all on public.private_message_media from anon, authenticated;
grant select, insert, update, delete on public.private_message_media to service_role;

commit;
