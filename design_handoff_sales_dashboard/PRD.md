# PRD: Dashboard Monitoring Sales & Membership FnB

**Status:** Draft
**Tanggal:** 13 Agustus 2026
**Owner:** -
**Versi:** 1.0

---

## 1. Latar Belakang

Saat ini data sales dan membership hanya bisa diakses lewat sistem ESB OMS (POS/ERP) tanpa lapisan analisa dan visualisasi yang mudah dikonsumsi oleh management/eksekutif. Dibutuhkan dashboard yang menarik data secara otomatis, menyimpannya sebagai source of truth internal, dan menampilkannya dalam bentuk analisa serta grafik yang bisa difilter sesuai kebutuhan.

## 2. Tujuan

- Menyediakan visibilitas harian atas performa sales dan membership di seluruh outlet F&B.
- Mengotomasi penarikan data dari ESB API sehingga tidak ada proses manual/rekap manual lagi.
- Memberikan dashboard yang bisa difilter (outlet, tanggal, kategori) agar eksekutif bisa eksplorasi data sesuai kebutuhan masing-masing.
- Membangun sistem dengan biaya operasional Rp0 (fully free tier) namun tetap reliable.

## 3. Target Pengguna

| Peran | Kebutuhan Utama |
|---|---|
| Eksekutif/Management | Ringkasan performa bisnis, tren, insight cepat |
| Ops/Business Analyst | Detail analisa per outlet, per produk, per member |

## 4. Sumber Data

- **Source of truth eksternal:** ESB OMS API — endpoint `get-sales-information` ([dokumentasi](https://developers.esb.co.id/esb-oms/#api-Report-get-sales-information)) dan endpoint membership terkait.
- **Frekuensi tarik data:** Harian (batch, terjadwal otomatis).
- **Source of truth internal:** Supabase Postgres, sebagai tempat data hasil tarikan disimpan dan diolah.

## 5. Ruang Lingkup (Scope)

### 5.1 In Scope

**Automasi data:**
- Job terjadwal harian yang menarik data sales & membership dari ESB API.
- Penyimpanan data mentah (raw) dan data teragregasi (views) di Supabase Postgres.
- Mekanisme upsert/anti-duplikat agar job yang re-run tidak menggandakan data.
- Logging tiap eksekusi job (sukses/gagal, jumlah row, waktu proses) di tabel `sync_log`.
- Monitoring & alert otomatis jika job harian gagal/tidak jalan.

**Dashboard:**
- List/tabel analisa sales (revenue, transaksi, AOV, breakdown outlet & produk).
- List/tabel analisa membership (growth, retensi, kontribusi revenue member).
- Analisa menu underperforming (kandidat takeout dari menu).
- Analisa efektivitas promosi (promo yang menaikkan transaksi vs yang tidak efektif).
- Rekomendasi promo ke depan berbasis pola data historis (rule-based, bukan prediksi ML).
- Grafik visualisasi untuk seluruh kategori analisa di atas.
- Filter interaktif: outlet, rentang tanggal, kategori produk.
- Akses dashboard terbatas untuk management/eksekutif.

### 5.2 Out of Scope (Fase 1)

- Integrasi real-time/streaming (data cukup harian).
- Export data ke sistem finance/akunting.
- Notifikasi/report otomatis via email/WhatsApp (bisa jadi fase berikutnya).
- Multi-role permission granular (fase 1 asumsinya satu level akses eksekutif).

## 6. Kebutuhan Fungsional

### 6.1 Automasi Penarikan Data
- FR-1: Sistem menarik data sales dari ESB API secara otomatis setiap hari pada jam tertentu.
- FR-2: Sistem menarik data membership dari ESB API secara otomatis setiap hari.
- FR-3: Data yang ditarik disimpan ke Supabase Postgres dengan mekanisme upsert berbasis identifier unik (misal `transaction_id`, `member_id` + tanggal).
- FR-4: Setiap eksekusi job dicatat ke tabel `sync_log` (waktu mulai, waktu selesai, status, jumlah row, pesan error jika ada).
- FR-5: Jika job gagal atau tidak berjalan dalam 24 jam, sistem mengirim alert otomatis (via healthchecks.io atau setara).

### 6.2 Analisa Sales
- FR-6: Menampilkan revenue harian/mingguan/bulanan dengan perbandingan periode sebelumnya (WoW/MoM).
- FR-7: Menampilkan breakdown sales per outlet.
- FR-8: Menampilkan breakdown sales per produk/kategori (top seller & slow moving).
- FR-9: Menampilkan average order value (AOV) dan jumlah transaksi.
- FR-10: Menampilkan distribusi sales per jam operasional (peak hour).

### 6.3 Analisa Membership
- FR-11: Menampilkan jumlah member baru per periode.
- FR-12: Menampilkan status member aktif vs tidak aktif/churn.
- FR-13: Menampilkan retention rate & frekuensi kunjungan member.
- FR-14: Menampilkan kontribusi revenue dari member vs non-member.
- FR-15: Menampilkan top member berdasarkan total spending.

### 6.4 Analisa Menu Underperforming
- FR-21: Menampilkan daftar menu dengan unit terjual terendah dalam periode tertentu (misal rolling 30 hari).
- FR-22: Menampilkan kontribusi revenue tiap menu terhadap total revenue, untuk mengidentifikasi menu dengan kontribusi minim.
- FR-23: Menampilkan tren penjualan tiap menu (naik/turun/stagnan) untuk membedakan menu yang benar-benar mati vs yang musiman.
- FR-24: Menandai menu sebagai "kandidat takeout" berdasarkan threshold yang bisa diatur (misal: unit terjual < X dalam Y hari terakhir).

### 6.5 Analisa Efektivitas Promosi
- FR-25: Menampilkan daftar promo yang pernah/sedang berjalan beserta periode aktifnya.
- FR-26: Membandingkan rata-rata transaksi/revenue saat promo aktif vs periode baseline (non-promo) untuk mengukur incremental lift.
- FR-27: Menghitung estimasi cost diskon vs incremental revenue per promo (ROI sederhana).
- FR-28: Mengklasifikasikan promo ke kategori "efektif" vs "kurang efektif" berdasarkan lift dan ROI.
- FR-29 (dependency): Fitur ini membutuhkan data promo/diskon per transaksi dari ESB API (`promo_id`/`promo_name`/`discount_amount` atau setara) — perlu dikonfirmasi ketersediaannya di endpoint ESB.

### 6.6 Rekomendasi Promo Ke Depan
- FR-30: Menyediakan saran promo berbasis pola historis, contoh: bundling menu laris dengan menu kandidat takeout untuk membantu menghabiskan stok/mendorong penjualan menu tersebut.
- FR-31: Menyediakan saran untuk menghentikan atau merevisi promo dengan ROI rendah berdasarkan data historis.
- FR-32: Menyediakan saran waktu promosi berdasarkan pola jam/hari sepi (dari analisa peak hour) untuk mendorong transaksi di luar jam ramai.
- Catatan: Rekomendasi ini bersifat rule-based/insight dari pola data historis, bukan model prediktif machine learning.

### 6.7 Dashboard & Interaksi
- FR-16: User dapat memfilter seluruh data di dashboard berdasarkan outlet.
- FR-17: User dapat memfilter berdasarkan rentang tanggal.
- FR-18: User dapat memfilter berdasarkan kategori produk.
- FR-19: Perubahan filter memperbarui seluruh tabel dan grafik terkait secara langsung.
- FR-20: Dashboard menampilkan waktu update data terakhir (last synced at).

## 7. Kebutuhan Non-Fungsional

| Kategori | Requirement |
|---|---|
| Biaya | Seluruh stack menggunakan free tier, Rp0/bulan |
| Reliability | Job harian punya retry/log/alert kegagalan |
| Idempotency | Re-run job tidak menyebabkan duplikasi data |
| Performa | Dashboard tetap responsif meski data difilter (query lewat pre-aggregated views) |
| Keamanan akses | Dashboard hanya bisa diakses oleh pihak yang diberi izin (auth sederhana) |
| Observability | Ada log yang bisa dicek manual kapan pun untuk audit data |

## 8. Arsitektur Teknis (Ringkasan)

1. **Automasi & ETL:** Supabase Edge Function, dipicu oleh Supabase Cron setiap hari — menarik data dari ESB API, transformasi ringan, upsert ke Postgres.
2. **Storage / source of truth internal:** Supabase Postgres — raw tables + SQL views teragregasi untuk sales & membership.
3. **Monitoring:** healthchecks.io (free) — memantau apakah job harian berjalan sesuai jadwal.
4. **Dashboard:** Next.js, di-hosting di Vercel (free tier) — mengambil data dari Supabase views dengan filter dinamis (outlet, tanggal, kategori), divisualisasikan dengan chart library (misal Recharts).

## 9. Metrik Keberhasilan

- Data ter-update otomatis setiap hari tanpa intervensi manual (≥95% keberhasilan job per bulan).
- Waktu load dashboard di bawah 3 detik untuk kombinasi filter umum.
- Eksekutif bisa mendapatkan insight sales & membership harian tanpa perlu minta rekap manual ke tim ops.
- Zero biaya infrastruktur bulanan selama masih dalam batas free tier.

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Supabase free tier auto-pause jika tidak ada aktivitas 7 hari | Job harian otomatis menjaga project tetap aktif |
| Rate limit / perubahan struktur response ESB API | Tambahkan validasi response & alert jika format berubah |
| Free tier limit terlampaui seiring pertumbuhan data | Monitor kapasitas Supabase (500MB), rencanakan migrasi/upgrade jika mendekati limit |
| Job gagal tanpa diketahui | Alert otomatis via healthchecks.io |

## 11. Milestone (Usulan)

| Fase | Deliverable |
|---|---|
| 1 | Setup Supabase, skema tabel raw & sync log, koneksi ke ESB API |
| 2 | Job otomatis harian + monitoring/alert berjalan stabil |
| 3 | SQL views agregasi sales & membership |
| 4 | Dashboard Next.js dasar dengan tabel & grafik |
| 5 | Filter interaktif (outlet, tanggal, kategori) |
| 6 | Testing, akses eksekutif, go-live |

## 12. Open Questions

- Field detail apa saja yang tersedia di endpoint `get-sales-information` dan endpoint membership ESB (perlu dicek dokumentasi/API key)?
- Apakah ESB API menyediakan data promo/diskon per transaksi (nama promo, jenis promo, nilai diskon)? Jika belum ada di endpoint sales, apakah ada endpoint terpisah untuk data promosi?
- Siapa saja yang akan diberi akses ke dashboard, dan apakah butuh login/auth?
- Berapa jumlah outlet saat ini dan proyeksi pertumbuhan data ke depan?
- Threshold apa yang dianggap wajar untuk menandai menu sebagai "kandidat takeout" (misal unit terjual minimum per bulan)?
