-- Extensions needed for the ETL cron schedule (pg_cron + pg_net) and general use.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
