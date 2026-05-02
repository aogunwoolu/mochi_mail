-- Make store_states readable by everyone so the store is a shared marketplace.
-- Write policies remain owner-only (each user can only publish to their own row).
drop policy "store_states_select_own" on public.store_states;
create policy "store_states_select_all"
on public.store_states
for select
using (true);
