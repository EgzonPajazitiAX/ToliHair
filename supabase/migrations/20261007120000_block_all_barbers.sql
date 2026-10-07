-- One transaction: a closure covers every existing barber or none of them.
-- Individual records remain editable/removable through the existing manager.
create function public.block_all_barbers(p_start_local text, p_end_local text, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare barber uuid; result jsonb := '[]'::jsonb; starts timestamptz; ends timestamptz;
begin
  perform private.require_admin();
  perform private.lock_schedule();
  starts := private.shop_instant(p_start_local);
  ends := private.shop_instant(p_end_local);
  if starts is null or ends is null or ends <= starts then
    raise exception 'End must be after start' using errcode = '22023';
  end if;
  if not exists(select 1 from public.barbers) then
    raise exception 'Barber unavailable' using errcode = '22023';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Reason too long' using errcode = '22023';
  end if;
  if exists(select 1 from public.appointments a where a.status = 'confirmed' and a.ends_at > now()
    and a.starts_at < ends and a.ends_at > starts) then
    raise exception 'Time is blocked' using errcode = '23P01';
  end if;
  for barber in select id from public.barbers order by id loop
    result := result || jsonb_build_array(public.manage_shop('blocked-times', jsonb_build_object(
      'barber_id', barber, 'start_local', p_start_local, 'end_local', p_end_local, 'reason', coalesce(p_reason, '')
    )));
  end loop;
  return result;
end;
$$;
revoke all on function public.block_all_barbers(text,text,text) from public, anon, authenticated;
grant execute on function public.block_all_barbers(text,text,text) to authenticated, service_role;
notify pgrst, 'reload schema';
