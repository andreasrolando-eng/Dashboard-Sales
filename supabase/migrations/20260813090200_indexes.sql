-- Indexes to keep the aggregation views/functions fast as raw_sales grows.
create index if not exists idx_raw_sales_date_branch on raw_sales (sales_date, branch_code);
create index if not exists idx_raw_sales_member on raw_sales (member_code) where member_code is not null;
create index if not exists idx_raw_sales_promotion on raw_sales (promotion_id) where promotion_id is not null and promotion_id <> '0';
create index if not exists idx_raw_sales_status on raw_sales (status_name);

create index if not exists idx_raw_sales_menu_items_date_branch on raw_sales_menu_items (sales_date, branch_code);
create index if not exists idx_raw_sales_menu_items_category on raw_sales_menu_items (menu_category_name);
-- No separate index on sales_num alone: the primary key (sales_num, line_seq
-- as of migration 20260813100000) already serves sales_num-prefix lookups
-- (e.g. the FK join back to raw_sales).

create index if not exists idx_sync_log_job_started on sync_log (job_name, started_at desc);
