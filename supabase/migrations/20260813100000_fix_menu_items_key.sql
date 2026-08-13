-- (sales_num, menu_id, batch_id) turned out not to be a reliable unique key:
-- the real ESB payload repeats the same menuID+batchID as separate
-- salesMenus[] entries within one sale. Only salesNum is a guaranteed-unique
-- identifier from ESB -- individual line items have no natural key at all.
-- Switch to a synthetic per-sale line sequence (the item's position in
-- salesMenus[], assigned by the ETL) instead of deriving uniqueness from
-- source fields that don't reliably provide it. batch_id stays as a plain
-- informational column, just no longer part of the key.
--
-- raw_sales_menu_items is purely an ETL-managed mirror of ESB, not
-- user-authored data, so truncating and re-syncing is the simplest safe
-- migration path -- re-run the daily/manual sync for any date range you
-- need after this applies.
truncate table raw_sales_menu_items;

alter table raw_sales_menu_items drop constraint raw_sales_menu_items_pkey;
alter table raw_sales_menu_items add column line_seq int not null;
alter table raw_sales_menu_items add primary key (sales_num, line_seq);
