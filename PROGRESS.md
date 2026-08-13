# Progress Proyek: ESB Analytics Dashboard

Acuan progress proyek — dipakai buat lanjutin kerjaan di sesi berikutnya. Setup/deploy step-by-step ada di `README.md`; file ini fokus ke **apa yang sudah beres, keputusan/asumsi apa yang diambil, dan apa yang masih perlu dikerjakan**. Diupdate tiap ada perubahan signifikan (skema baru, keputusan formula/field, fitur baru).

_Terakhir diupdate: 13 Agustus 2026._

## Stack & Arsitektur

- **App**: Next.js 16 (App Router, Turbopack) di `src/`, TypeScript, Tailwind CSS v4, TanStack Query, Recharts. Target hosting: Vercel (belum di-deploy).
- **Backend**: Supabase Postgres + Auth + Edge Functions (Deno) + `pg_cron`/`pg_net`.
- **Supabase project**: sudah **linked & live**. Project ref `giyspsmyitlygujelqjd`, URL `https://giyspsmyitlygujelqjd.supabase.co`.
- **ESB OMS API**: sudah terhubung, base URL `https://stg7.esb.co.id/api-fnb-backend/web`, endpoint `/corev1/sales/sales-information`.

## Yang Sudah Beres

### 1. Database (semua migration di `supabase/migrations/` sudah di-push)
- Tabel raw: `outlets`, `raw_sales`, `raw_sales_payments`, `raw_sales_menu_items`, `raw_members` (belum dipakai), `sync_log`.
- RLS: tabel raw cuma bisa ditulis service_role; app baca lewat views/functions yang di-grant ke `authenticated`.
- Views agregasi harian: `v_sales_daily_outlet`, `v_sales_hourly_outlet`, `v_sales_product_daily`, `v_promo_daily`, `v_outlets`, `v_categories`, `v_member_visits_daily`, `v_member_branch_counts`, `v_members_dim`, `v_membership_new_weekly`, `v_last_sync`.
- RPC functions: `fn_menu_performance` (FR-21-24), `fn_promo_performance` (FR-25-29), `fn_membership_summary`, `fn_top_members`.

**Keputusan penting soal skema:**
- **`raw_sales_menu_items` primary key = `(sales_num, line_seq)`**, BUKAN `(sales_num, menu_id, batch_id)`. Field `menuID`+`batchID` dari ESB ternyata bisa sama dalam satu transaksi (dikonfirmasi user), jadi satu-satunya ID yang reliable dari ESB cuma `salesNum` di level bill. `line_seq` adalah nomor urut posisi item di array `salesMenus[]`, di-generate sendiri oleh ETL (migration `20260813100000`, ada `truncate` karena PK berubah total — semua data menu item lama perlu di-sync ulang).
- **Nett Sales**: kolom `nett_sales` di `v_sales_daily_outlet` (migration `20260813100100` + `20260813100200`). Formula:
  ```
  nett_sales = grand_total
             - (other_tax_total + vat_total + other_vat_total)
             - (discount_total + voucher_discount_total)
             - order_fee            -- platform fee
             - rounding_total       -- other cost
             - delivery_cost
  ```

### 2. ETL — Edge Function `sync-esb` (sudah deployed)
- **Request contract terkonfirmasi** (bukan tebakan lagi):
  - Endpoint: `{ESB_API_BASE_URL}/corev1/sales/sales-information`
  - Auth: `Authorization: Bearer <token>`
  - Query params: `salesDateFrom`, `salesDateTo` (yyyy-mm-dd), `page` (default 1), `sortBy=salesDateIn`, `sortOrder=asc`. **Tidak ada param `perPage`** — page size fixed 20 di server (dari `x-pagination-*` response headers).
  - Sengaja **tidak** filter `statusName` (ambil semua: New/Finished/Cancelled/Void) — biar raw data lengkap buat audit. Filter "Finished" dilakukan di SQL views, bukan di request.
  - Sengaja **tidak** filter `branchCode` — ambil semua outlet dalam 1x request per tanggal, lebih efisien daripada loop per outlet.
- Idempotent: upsert berbasis `sales_num` (dan `sales_num+line_seq` untuk item menu, `sales_num+sales_payment_backend_id` untuk payment) — sync ulang tanggal yang sama aman, tidak dobel.
- Mendukung **sync 1 hari atau rentang tanggal** (`{date}` atau `{dateFrom, dateTo}`), maks 31 hari/request, tiap hari punya baris `sync_log` sendiri (kalau 1 hari di tengah gagal, hari lain tetap sukses).
- CORS sudah di-enable (`supabase/functions/_shared/cors.ts`) — bisa dipanggil langsung dari browser.
- Monitoring: ping ke `HEALTHCHECKS_PING_URL` (sukses/gagal) kalau di-set.
- **Sinkronisasi manual dari dashboard**: tombol "Sync Manual" di header (semua tab), dengan date-range picker. Kalau ada hari yang gagal, muncul chip merah per tanggal buat retry cuma hari itu.

### 3. Frontend — semua tab jadi
- Auth: Supabase Auth (email/password), `src/proxy.ts` (Next 16 rename dari `middleware.ts`) guard semua route kecuali `/login`. Ada dev-only mock bypass (`NEXT_PUBLIC_USE_MOCK_DATA=true`, cuma aktif kalau `NODE_ENV !== production`).
- 4 tab: Overview, Sales, Membership, Marketing — semua connect ke Supabase views/RPC asli (bukan dummy lagi).
- **Semua angka Rupiah eksplisit** (`Rp804.627.630`, bukan `Rp804.6jt`) — formatter `fmtRupiah` di `src/lib/format.ts`. `fmtJuta`/`fmtRibu` sudah dihapus total.
- KPI **"Nett Sales"** ada di sebelah "Total Revenue" (tab Overview & Sales).
- Chart "Tren Revenue" nampilin tanggal di tooltip hover.
- Panel **Analisa Menu Underperforming** (tab Sales) di-redesign: dropdown threshold (10/25/50/100/250/500/1000 unit), dropdown "Tampilkan" (5/10/20/50/Semua), tombol **Terapkan** (perubahan dropdown gak langsung query, nunggu diklik). Panel ini komponen React terpisah (`menu-underperforming-panel.tsx`) supaya ganti kontrolnya cuma re-render panel ini doang, gak reload seluruh tab.
- Delta KPI ("+8.4% vs periode lalu") itu **hitungan asli** dari periode sebelumnya yang sama panjang, bukan hardcode.

## Yang Masih Perlu Dikerjakan / Dicek

1. **Cek ulang vault secret `sync_esb_service_key`** — sempat ke-set salah (isi placeholder, bukan key asli) waktu setup cron, sudah dikasih cara benerinnya tapi perlu dikonfirmasi user udah beneran fix & cron jalan otomatis jam 06:00 WIB.
2. **Endpoint membership ESB** — belum ada sample/dokumentasi. `supabase/functions/sync-esb/membership.ts` masih stub (off by default via `ESB_MEMBERSHIP_ENDPOINT` env var kosong). Analytics membership tetap jalan (dari `memberCode` di data sales), cuma field `tier`/`join_date` di `raw_members` yang belum akurat (pakai fallback rule spending-bracket).
3. **Re-sync ulang data lama** kalau belum — karena migration `20260813100000` nge-truncate `raw_sales_menu_items`, tanggal-tanggal yang udah pernah di-sync sebelum migration ini perlu di-sync ulang lewat tombol Sync Manual.
4. **Deploy ke Vercel** — belum dilakukan sama sekali, project masih jalan lokal (`npm run dev`) aja.
5. **healthchecks.io** — belum dikonfirmasi udah di-setup atau belum (opsional tapi disarankan buat FR-5).

## Referensi Cepat

- Migration terbaru: `supabase/migrations/20260813100200_nett_sales_more_deductions.sql`
- Edge Function: `supabase/functions/sync-esb/` (index.ts = handler, esb-client.ts = fetch ESB, transform.ts = mapping, upsert.ts = idempotent write)
- Query façade app: `src/lib/queries/`
- Setup/deploy lengkap: `README.md`
