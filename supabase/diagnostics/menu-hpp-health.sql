-- HPP sync health checks. Run in the Supabase SQL editor.

-- 1. Last HPP runs (status, rows, first error)
select id, started_at, finished_at, status, rows_synced, error_message
from sync_log
where job_name = 'sync-esb-hpp'
order by id desc
limit 10;

-- 2. Cron dispatches for HPP and their HTTP result (200 ok, 207 partial, else failed)
select id, dispatched_at, status_code, response
from sync_dispatch
where kind = 'hpp'
order by id desc
limit 10;

-- 3. Snapshot coverage per day: how many menus per costing status
select snapshot_date, cost_status, count(*) as menus
from menu_hpp_snapshots
group by snapshot_date, cost_status
order by snapshot_date desc, cost_status
limit 40;

-- 4. Sold menus that don't exist in ESB's master menu (would show "Tidak ada di master ESB")
select distinct v.menu_id, v.menu_name
from v_sales_product_daily v
left join esb_menus m on m.menu_id = case when v.menu_id ~ '^[0-9]+$' then v.menu_id::bigint end
where v.sales_date >= current_date - 30
  and m.menu_id is null
order by v.menu_name
limit 50;

-- 5. Ingredients with no usable lastHpp in the latest snapshot (cause of incomplete_cost)
select l.product_id, l.product_name, l.uom_name, l.last_hpp, count(distinct l.bom_id) as boms
from esb_bom_lines l
where l.snapshot_date = (select max(snapshot_date) from esb_bom_lines)
  and fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp) is null
group by l.product_id, l.product_name, l.uom_name, l.last_hpp
order by boms desc;
