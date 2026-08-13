-- Local/reference seed data. Only runs via `supabase db reset` against a
-- local (Dockerized) or explicitly targeted Supabase instance -- shaped like
-- the real ESB payload (see supabase/functions/sync-esb/transform.ts) but
-- synthetic, so `raw` is left as an empty object rather than a real capture.

insert into outlets (branch_code, branch_name, ext_branch_code) values
  ('LB1', 'L-Bar Station', 'ABC123'),
  ('PIK1', 'Outlet PIK', 'ABC124'),
  ('BDG1', 'Outlet Bandung', 'ABC125')
on conflict (branch_code) do nothing;

-- 3 members with repeat visits (exercises retention/top-member/tier logic),
-- rest of the bills are walk-in (member_code null).
with member_codes as (
  select unnest(array['MBR001', 'MBR002', 'MBR003']) as member_code,
         unnest(array['Andi Wijaya', 'Siti Rahma', 'Budi Santoso']) as member_name
),
categories as (
  select * from (values
    ('91', 'GI Drink', '821', 'GI Coffee', 'Ice Coffee Latte', 'GC000001', 15000),
    ('91', 'GI Drink', '822', 'GI Tea', 'Teh Tarik', 'GC000002', 8000),
    ('89', 'GI Eat', '229', 'GI Portion', 'Paket Ayam', 'GP000009', 20000),
    ('89', 'GI Eat', '230', 'GI Main', 'Nasi Goreng Spesial', 'GP000010', 30000),
    ('92', 'GI Dessert', '831', 'GI Cake', 'Choco Lava Cake', 'GD000001', 20000),
    ('93', 'GI Snack', '841', 'GI Fries', 'Kentang Goreng', 'GS000001', 10000)
  ) as t(menu_category_id, menu_category_name, menu_category_detail_id, menu_category_detail_name, menu_name, menu_code, unit_price)
),
promos as (
  select * from (values ('3475', 'UAT50PCT'), ('3480', 'Buy 1 Get 1 Kopi')) as t(promotion_id, promotion_name)
),
generated as (
  select
    gs as seq,
    (current_date - (random() * 45)::int) as sales_date,
    (array['LB1', 'PIK1', 'BDG1'])[1 + floor(random() * 3)::int] as branch_code,
    (10 + floor(random() * 13))::int as hour_of_day,
    case when random() < 0.35 then (select member_code from member_codes order by random() limit 1) else null end as member_code,
    case when random() < 0.15 then (select promotion_id from promos order by random() limit 1) else null end as promotion_id
  from generate_series(1, 260) as gs
)
insert into raw_sales (
  sales_num, bill_num, sales_date, sales_date_in, sales_date_out,
  branch_code, branch_name, member_code, member_name,
  pax_total, subtotal, discount_total, grand_total, payment_total,
  promotion_id, promotion_name, status_id, status_name,
  created_by, edited_by, edited_date, raw
)
select
  'SEED' || lpad(g.seq::text, 6, '0'),
  'BILL' || lpad(g.seq::text, 6, '0'),
  g.sales_date,
  g.sales_date + make_interval(hours => g.hour_of_day, mins => (random() * 59)::int),
  g.sales_date + make_interval(hours => g.hour_of_day, mins => (random() * 59)::int + 5),
  g.branch_code,
  o.branch_name,
  g.member_code,
  mc.member_name,
  1 + floor(random() * 4)::int,
  amounts.subtotal,
  amounts.discount_total,
  amounts.grand_total,
  amounts.grand_total,
  g.promotion_id,
  p.promotion_name,
  '8',
  'Finished',
  'seed',
  'seed',
  g.sales_date + make_interval(hours => g.hour_of_day),
  '{}'::jsonb
from generated g
join outlets o on o.branch_code = g.branch_code
left join member_codes mc on mc.member_code = g.member_code
left join promos p on p.promotion_id = g.promotion_id
cross join lateral (
  select
    (30000 + floor(random() * 120000))::numeric as subtotal,
    case when g.promotion_id is not null then (5000 + floor(random() * 15000))::numeric else 0 end as discount_total,
    (30000 + floor(random() * 120000))::numeric - case when g.promotion_id is not null then (5000 + floor(random() * 15000))::numeric else 0 end as grand_total
) amounts;

-- 1-3 line items per bill, drawn from the category fixture above.
with categories as (
  select * from (values
    ('91', 'GI Drink', '821', 'GI Coffee', 'Ice Coffee Latte', 'GC000001', 15000),
    ('91', 'GI Drink', '822', 'GI Tea', 'Teh Tarik', 'GC000002', 8000),
    ('89', 'GI Eat', '229', 'GI Portion', 'Paket Ayam', 'GP000009', 20000),
    ('89', 'GI Eat', '230', 'GI Main', 'Nasi Goreng Spesial', 'GP000010', 30000),
    ('92', 'GI Dessert', '831', 'GI Cake', 'Choco Lava Cake', 'GD000001', 20000),
    ('93', 'GI Snack', '841', 'GI Fries', 'Kentang Goreng', 'GS000001', 10000)
  ) as t(menu_category_id, menu_category_name, menu_category_detail_id, menu_category_detail_name, menu_name, menu_code, unit_price)
),
lines as (
  select
    s.sales_num,
    s.sales_date,
    s.branch_code,
    -- batch_id is plain informational data here (like the real payload),
    -- not part of the key -- line_seq (below) is what raw_sales_menu_items
    -- actually keys on, see migration 20260813100000.
    (1 + floor(random() * 2))::text as batch_id,
    c.*,
    (1 + floor(random() * 3))::numeric as qty
  from raw_sales s
  cross join lateral (select generate_series(1, 1 + floor(random() * 2)::int)) g
  cross join lateral (select * from categories order by random() limit 1) c
  where s.sales_num like 'SEED%'
),
numbered as (
  select *, row_number() over (partition by sales_num order by menu_code) - 1 as line_seq
  from lines
)
insert into raw_sales_menu_items (
  sales_num, line_seq, menu_id, batch_id, sales_date, branch_code,
  menu_category_id, menu_category_name, menu_category_detail_id, menu_category_detail_name,
  menu_name, menu_code, qty, original_price, price, total, status_id, status_name, sales_type
)
select
  sales_num,
  line_seq,
  menu_code,
  batch_id,
  sales_date,
  branch_code,
  menu_category_id,
  menu_category_name,
  menu_category_detail_id,
  menu_category_detail_name,
  menu_name,
  menu_code,
  qty,
  unit_price,
  unit_price,
  qty * unit_price,
  '14',
  'Served',
  'POS'
from numbered
on conflict (sales_num, line_seq) do nothing;
