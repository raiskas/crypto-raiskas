alter table public.crypto_carteiras enable row level security;
alter table public.crypto_carteira_aportes enable row level security;
alter table public.crypto_carteira_snapshots enable row level security;
alter table public.crypto_operacoes enable row level security;

drop policy if exists crypto_carteiras_select_own on public.crypto_carteiras;
create policy crypto_carteiras_select_own
on public.crypto_carteiras
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_carteiras.usuario_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteiras_insert_own on public.crypto_carteiras;
create policy crypto_carteiras_insert_own
on public.crypto_carteiras
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_carteiras.usuario_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteiras_update_own on public.crypto_carteiras;
create policy crypto_carteiras_update_own
on public.crypto_carteiras
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_carteiras.usuario_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_carteiras.usuario_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteiras_delete_own on public.crypto_carteiras;
create policy crypto_carteiras_delete_own
on public.crypto_carteiras
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_carteiras.usuario_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_aportes_select_own on public.crypto_carteira_aportes;
create policy crypto_carteira_aportes_select_own
on public.crypto_carteira_aportes
for select
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_aportes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_aportes_insert_own on public.crypto_carteira_aportes;
create policy crypto_carteira_aportes_insert_own
on public.crypto_carteira_aportes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_aportes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_aportes_update_own on public.crypto_carteira_aportes;
create policy crypto_carteira_aportes_update_own
on public.crypto_carteira_aportes
for update
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_aportes.carteira_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_aportes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_aportes_delete_own on public.crypto_carteira_aportes;
create policy crypto_carteira_aportes_delete_own
on public.crypto_carteira_aportes
for delete
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_aportes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_snapshots_select_own on public.crypto_carteira_snapshots;
create policy crypto_carteira_snapshots_select_own
on public.crypto_carteira_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_snapshots.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_snapshots_insert_own on public.crypto_carteira_snapshots;
create policy crypto_carteira_snapshots_insert_own
on public.crypto_carteira_snapshots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_snapshots.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_snapshots_update_own on public.crypto_carteira_snapshots;
create policy crypto_carteira_snapshots_update_own
on public.crypto_carteira_snapshots
for update
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_snapshots.carteira_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_snapshots.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_carteira_snapshots_delete_own on public.crypto_carteira_snapshots;
create policy crypto_carteira_snapshots_delete_own
on public.crypto_carteira_snapshots
for delete
to authenticated
using (
  exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_carteira_snapshots.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_operacoes_select_own on public.crypto_operacoes;
create policy crypto_operacoes_select_own
on public.crypto_operacoes
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_operacoes.usuario_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_operacoes_insert_own on public.crypto_operacoes;
create policy crypto_operacoes_insert_own
on public.crypto_operacoes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_operacoes.usuario_id
      and u.auth_id = auth.uid()
  )
  and exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_operacoes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_operacoes_update_own on public.crypto_operacoes;
create policy crypto_operacoes_update_own
on public.crypto_operacoes
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_operacoes.usuario_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_operacoes.usuario_id
      and u.auth_id = auth.uid()
  )
  and exists (
    select 1
    from public.crypto_carteiras c
    join public.usuarios u on u.id = c.usuario_id
    where c.id = crypto_operacoes.carteira_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists crypto_operacoes_delete_own on public.crypto_operacoes;
create policy crypto_operacoes_delete_own
on public.crypto_operacoes
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = crypto_operacoes.usuario_id
      and u.auth_id = auth.uid()
  )
);
