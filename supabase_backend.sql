-- Run this in the Supabase SQL editor.

alter table public.messages
  add column if not exists delivered boolean not null default true,
  add column if not exists seen boolean not null default false;

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  online boolean not null default false,
  last_seen timestamptz not null default now()
);

create unique index if not exists conversation_participants_unique_user
  on public.conversation_participants (conversation_id, user_id);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants (conversation_id);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

alter table public.user_presence enable row level security;

drop policy if exists "Users can read presence" on public.user_presence;
create policy "Users can read presence"
  on public.user_presence
  for select
  to authenticated
  using (true);

drop policy if exists "Users can upsert own presence" on public.user_presence;
create policy "Users can upsert own presence"
  on public.user_presence
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own presence" on public.user_presence;
create policy "Users can update own presence"
  on public.user_presence
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_user_emails(user_ids uuid[])
returns table(id uuid, email text)
language sql
security definer
as $$
  select id, email
  from auth.users
  where id = any(user_ids);
$$;

revoke all on function public.get_user_emails(uuid[]) from public;
grant execute on function public.get_user_emails(uuid[]) to authenticated;

create or replace function public.find_user_by_email(target_email text)
returns table(id uuid, email text)
language sql
security definer
as $$
  select id, email
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;

create or replace function public.get_or_create_private_conversation(target_user_id uuid)
returns table(id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Invalid target user';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(current_user_id::text, target_user_id::text) ||
      ':' ||
      greatest(current_user_id::text, target_user_id::text),
      0
    )
  );

  select cp1.conversation_id
  into existing_conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp2.conversation_id = cp1.conversation_id
  where cp1.user_id = current_user_id
    and cp2.user_id = target_user_id
  limit 1;

  if existing_conversation_id is not null then
    return query
      select conversations.id, conversations.created_at
      from public.conversations
      where conversations.id = existing_conversation_id;
    return;
  end if;

  insert into public.conversations default values
  returning conversations.id into new_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, target_user_id);

  return query
    select conversations.id, conversations.created_at
    from public.conversations
    where conversations.id = new_conversation_id;
end;
$$;

revoke all on function public.get_or_create_private_conversation(uuid) from public;
grant execute on function public.get_or_create_private_conversation(uuid) to authenticated;

create or replace function public.mark_conversation_seen(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = target_conversation_id
      and user_id = current_user_id
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  update public.messages
  set seen = true
  where conversation_id = target_conversation_id
    and sender_id <> current_user_id
    and seen = false;
end;
$$;

revoke all on function public.mark_conversation_seen(uuid) from public;
grant execute on function public.mark_conversation_seen(uuid) to authenticated;
