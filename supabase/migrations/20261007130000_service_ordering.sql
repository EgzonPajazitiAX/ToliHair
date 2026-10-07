  -- Service ordering: append new services and allow atomic manual reordering.
  -- This replaces the two unapplied append_new_services/reorder_services migrations.
  -- Existing catalogue positions are left untouched until an explicit reorder.

  create function private.append_new_service() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
  declare next_position bigint;
  begin
    -- Shared with booking/configuration writes. Concurrent additions/reorders
    -- cannot compute positions from an outdated catalogue.
    perform private.lock_schedule();
    if new.sort_order = 0 then
      select greatest(coalesce(max(s.sort_order)::bigint, 0), 0) + 1
        into next_position from public.services s;
      if next_position > 2147483647 then
        raise exception 'Service ordering limit reached' using errcode = '22023';
      end if;
      new.sort_order := next_position::integer;
    end if;
    return new;
  end;
  $$;
  revoke all on function private.append_new_service() from public, anon, authenticated;
  create trigger append_new_service
  before insert on public.services
  for each row execute function private.append_new_service();

  -- Reorder the complete catalogue, including inactive services, in one write.
  -- Verify every revision before writing anything; stale clients must reload.
  create function public.reorder_services(p_order jsonb)
  returns jsonb language plpgsql volatile security definer set search_path = '' as $$
  declare item jsonb; ids uuid[]; total integer;
  begin
    perform private.require_admin();
    perform private.lock_schedule();
    if p_order is null or jsonb_typeof(p_order) <> 'array' then
      raise exception 'Service order required' using errcode = '22023';
    end if;
    total := jsonb_array_length(p_order);
    if total not between 1 and 200 then
      raise exception 'Invalid service order' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_order) loop
      if jsonb_typeof(item) is distinct from 'object' then
        raise exception 'Invalid service order' using errcode = '22023';
      end if;
      -- Match the API validation even when the RPC is called directly.
      if jsonb_typeof(item->'id') is distinct from 'string'
        or jsonb_typeof(item->'revision') is distinct from 'number'
        or (select count(*) from jsonb_object_keys(item)) <> 2
        or (item->>'revision') !~ '^[1-9][0-9]*$' then
        raise exception 'Invalid service order' using errcode = '22023';
      end if;
    end loop;
    select array_agg((value->>'id')::uuid) into ids from jsonb_array_elements(p_order);
    if (select count(distinct id) from unnest(ids) id) <> total then
      raise exception 'Duplicate service' using errcode = '22023';
    end if;
    if total <> (select count(*) from public.services)
      or exists(select 1 from jsonb_array_elements(p_order) chosen
        left join public.services s on s.id = (chosen->>'id')::uuid
        where s.id is null or s.revision <> (chosen->>'revision')::integer) then
      raise exception 'Record changed. Reload before saving.' using errcode = '40001';
    end if;
    update public.services s set sort_order = chosen.position::integer
      from jsonb_array_elements(p_order) with ordinality chosen(value,position)
      where s.id = (chosen.value->>'id')::uuid
        and s.sort_order is distinct from chosen.position::integer;
    return jsonb_build_object('success', true);
  end;
  $$;
  revoke all on function public.reorder_services(jsonb) from public, anon, authenticated;
  grant execute on function public.reorder_services(jsonb) to authenticated, service_role;

  notify pgrst, 'reload schema';
