begin;

alter table public.private_message_media
  drop constraint if exists private_message_media_sender_role_check;
alter table public.private_message_media
  add constraint private_message_media_sender_role_check
  check (sender_role in ('家長', '學生', '導師'));

commit;
