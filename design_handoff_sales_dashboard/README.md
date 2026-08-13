# Handoff: Dashboard Sales, Membership & Marketing (ESB F&B)

## Overview
Dashboard internal untuk monitoring performa sales, membership, dan marketing (promo) seluruh outlet F&B. Mobile-first, responsive ke tablet & desktop. Dibangun sesuai `PRD.md` (disertakan di folder ini): data sales & membership ditarik otomatis harian dari ESB OMS API ke Supabase Postgres; dashboard membaca dari Supabase views dengan filter dinamis.

## About the Design Files
File di folder ini (`design-reference.dc.html`) adalah **referensi desain berbentuk HTML** — mockup interaktif yang menunjukkan tampilan, layout, dan perilaku yang diinginkan, BUKAN kode produksi untuk disalin langsung. Tugasnya: **rekonstruksi desain ini di codebase target** menggunakan stack yang disebut PRD — Next.js (App Router) di Vercel, dengan Recharts untuk chart dan Supabase JS client untuk data — mengikuti pola & komponen yang sudah ada di codebase kalau sudah ada; buat baru dengan struktur Next.js standar kalau belum ada repo.

Buka `design-reference.dc.html` langsung di browser untuk melihat & mencoba interaksinya (klik filter, ganti tab, buka sidebar mobile).

## Fidelity
**High-fidelity.** Warna, tipografi, spacing, dan struktur layout di file referensi ini final — implementasikan pixel-close. Semua angka/data di dalamnya adalah **dummy/contoh** (lihat bagian Data Model) — data asli akan datang dari Supabase views setelah pipeline ETL PRD selesai dibangun.

## Screens / Views

Semua screen ada dalam satu shell aplikasi (bukan halaman terpisah secara route, kecuali Login):

### 1. Login
- **Purpose:** Gate akses — hanya management/eksekutif (FR sesuai PRD §6.4, §7 keamanan akses).
- **Layout:** Full-viewport, konten dipusatkan (`flex align-items:center justify-content:center`), card max-width 380px, padding 36px/32px, radius 16px, shadow tipis (`0 1px 3px rgba(0,0,0,.04)`), border 1px `#e5e7eb`-ish.
- **Components:**
  - Logo mark: kotak 36x36px radius 10px, warna aksen `#2563eb`, di samping wordmark "ESB Analytics" (19px/700).
  - Judul "Masuk ke Dashboard" (22px/700), subjudul (14px, abu-abu `oklch(50% 0.01 260)`).
  - Input email (type=email, required) + input password (type=password, required): full width, padding 11px 14px, radius 10px, border 1px `oklch(88% 0.005 260)`.
  - Tombol submit full width, background `#2563eb`, teks putih 15px/600, radius 10px.
  - Catatan kecil di bawah: "Akses terbatas untuk management & eksekutif" (12px, abu-abu).
- **Behavior:** Submit form → auth (di real app: Supabase Auth atau provider auth pilihan tim) → redirect ke dashboard. Desain saat ini tidak validasi kredensial (demo).

### 2. Dashboard Shell (Sidebar + Header + Content)
- **Layout:**
  - **Sidebar**: fixed, lebar 240px, dari `top:0` ke `bottom:0`, background putih, border-right 1px. Berisi: logo mark, 4 nav item (Overview / Sales / Membership / Marketing), tombol "Keluar" di bagian bawah (margin-top:auto, border-top pemisah).
    - Desktop (≥1024px): selalu terlihat, transform none.
    - Mobile/tablet (<1024px): tersembunyi via `transform: translateX(-100%)`, jadi drawer overlay saat dibuka (class `.open` → `translateX(0)`), dengan overlay gelap semi-transparan (`rgba(0,0,0,.35)`) di belakangnya yang menutup drawer saat diklik. z-index drawer 20, overlay 15.
    - Nav item aktif: background `oklch(95% 0.03 255)` (biru sangat muda), warna teks & dot indicator `#2563eb`, font-weight 700. Nav item non-aktif: abu-abu `oklch(50% 0.01 260)`, weight 500.
    - Setiap nav item punya dot indicator kecil (9x9px) — persegi (radius 2px) untuk Overview & Marketing, bulat (radius 50%) untuk Sales & Membership (sekadar variasi visual, tidak signifikan secara semantik — boleh diganti ikon nyata).
  - **Tombol menu (hamburger)**: hanya tampil di mobile/tablet (<1024px), di atas content area. 3 garis (20x2px) + label "Menu" (13px/600). Klik → toggle sidebar drawer.
  - **Content area**: padding 16px (mobile) / 32px 40px (desktop, `margin-left:240px` untuk memberi ruang sidebar).
- **Header dalam content:** judul halaman besar (24px/700, sesuai tab aktif — "Overview" / "Analisa Sales" / "Analisa Membership" / "Marketing") + baris kecil "Data terakhir diperbarui: {timestamp}" (13px, abu-abu) — mapping ke FR-20 (last synced at).
- **Filter bar** (tampil di semua tab, di bawah header): 3 kontrol sejajar, wrap ke bawah kalau sempit:
  1. **Filter Outlet**: `<select>` — opsi "Semua Outlet" + nama tiap outlet.
  2. **Filter Kategori Produk**: `<select>` — "Semua Kategori", Makanan, Minuman, Dessert, Snack.
  3. **Filter Periode Tanggal** (custom, bukan native range input): tombol menampilkan label periode terpilih (format "13 Agu 2026 – 13 Sep 2026"), diklik membuka popover kecil (posisi absolute, `top: calc(100% + 6px)`, shadow `0 8px 24px rgba(0,0,0,.08)`, radius 12px, padding 16px, min-width 260px) berisi dua `<input type="date">` (Dari / Sampai) + tombol "Terapkan" biru yang menutup popover. Field "Sampai" dibatasi `max` = hari ini; field "Dari" dibatasi `max` = tanggal "Sampai" (validasi range wajar).
  - Semua elemen `<select>`: padding 10px 14px, radius 10px, border 1px `oklch(88% 0.005 260)`, font 13px/500.
  - Mengubah filter apapun harus langsung memperbarui seluruh tabel & chart terkait (FR-19) — di desain ini semua angka reaktif terhadap filter (lihat Data Model → State-derived calculations).

### 3. Tab: Overview
KPI grid (`grid-template-columns: repeat(auto-fit, minmax(210px,1fr))`, gap 16/20px) berisi 6 card:
Total Revenue, Total Transaksi, AOV, Total Member, Member Baru, Churn Rate.
- **KPI card:** background putih, border 1px `oklch(91% 0.005 260)`, radius 14px, padding 18px 20px. Label kecil (13px/500, abu-abu) → angka besar (24px/700) → delta text (12px/600, hijau `#16a34a` untuk positif / merah `#dc2626` untuk negatif, biru `#2563eb` untuk info neutral).

Chart grid (`repeat(auto-fit, minmax(320px,1fr))`):
- **Tren Revenue Harian** (span 2 kolom / full-width): bar chart harian, bar biru `#2563eb`, radius atas 3px, tinggi proporsional (`height:{pct}%` dari max value dalam periode), container tinggi 160px, `align-items:flex-end`, gap 4px.
- **Revenue per Outlet**: horizontal progress bar per outlet — label + value di atas (12px), track abu-abu `oklch(93% 0.005 260)` tinggi 8px radius 4px, fill biru proporsional terhadap outlet dengan revenue tertinggi.
- **Kontribusi Revenue Member**: donut chart CSS (`conic-gradient(#2563eb 0% X%, oklch(90% 0.005 260) X% 100%)`, 120px diameter, lubang putih di tengah 80px menampilkan persentase besar (20px/700) + label "Member" (10px, abu-abu).

### 4. Tab: Analisa Sales
- KPI grid 4 card: Total Revenue, Total Transaksi, AOV (`Rp{aov/1000 dibulatkan}rb`), Peak Hour (nilai jam + jumlah transaksi sebagai delta).
- **Tren Revenue**: sama seperti Overview, full-width.
- **Distribusi Peak Hour**: bar chart per jam (10:00–22:00), bar biru, label jam kecil (9px) di bawah tiap bar, tinggi proporsional terhadap jam tersibuk.
- **Revenue per Outlet**: sama seperti Overview.
- **Top Seller** & **Slow Moving** (2 card berdampingan): masing-masing daftar 5 produk — nama (13px/600) + "kategori · qty terjual" (11px, abu-abu) di kiri, revenue (13px/700) di kanan, dipisah border bawah tipis. Top Seller diurutkan revenue tertinggi; Slow Moving diurutkan qty terendah. Difilter oleh filter kategori produk.
- **Analisa Menu Underperforming** (card full-width, PRD FR-21–24): header punya slider threshold ("Threshold takeout: <{n} unit", `<input type="range" min="100" max="1000" step="50">`) yang mengatur ambang unit terjual untuk menandai menu sebagai kandidat takeout. Tabel 5 kolom: Menu, Unit Terjual, Kontribusi Revenue (% dari total revenue produk), Tren (↑ Naik hijau / ↓ Turun merah / → Stagnan abu-abu — dari data historis penjualan), Status (badge "Kandidat Takeout" merah jika unit terjual < threshold, atau "Pantau" abu-abu). Diurutkan dari unit terjual terendah.

### 5. Tab: Analisa Membership
- KPI grid 4 card: Total Member, Member Aktif (%), Retention Rate, Frekuensi Kunjungan.
- **Member Baru per Minggu**: bar chart 8 minggu terakhir, style sama seperti chart lain, label "M1..M8" di bawah tiap bar.
- **Aktif vs Churn**: donut chart CSS sama seperti pola Overview, tengah menampilkan churn rate (%), di bawah donut ada legend 2 item (dot persegi biru = Aktif, dot abu-abu = Tidak Aktif).
- **Top Member by Spending**: tabel (grid 5 kolom: Nama 2fr, Outlet 1.4fr, Tier 1fr, Kunjungan 1fr, Total Spending 1fr), header 11px/600 abu-abu dengan border-bottom, row 13px dengan border-bottom tipis per baris. Kolom Tier ditampilkan sebagai badge (background `oklch(94% 0.03 255)`, teks `#2563eb`, 11px/600, radius 6px, padding 2px 8px) — nilai: Gold/Silver/Bronze. Difilter oleh filter outlet (menampilkan member yang home outlet-nya cocok).

### 6. Tab: Marketing
- Banner info (border dashed `oklch(85% 0.005 260)`, radius 14px, padding 20px 24px, teks center 13px abu-abu): menjelaskan campaign reach/CTR dari ad platform belum terhubung API, tapi analisa promo & rekomendasi menu di bawah dihitung dari data redemption yang sudah tercatat di sistem transaksi.
- KPI grid 3 card: Total Redemption (seluruh promo), Promo Terbaik (nama promo + delta upsell%), Promo Perlu Ditinjau (nama promo dengan redemption terendah).
- **Efektivitas Promo (Lift vs Baseline & ROI)** (card full-width, PRD FR-25–29): tabel 5 kolom — Promo, Redemption, Lift (% kenaikan transaksi/revenue saat promo aktif vs baseline non-promo), ROI (estimasi incremental revenue ÷ cost diskon, ditampilkan "{n}x"), Status (badge "Efektif" hijau jika lift ≥15% dan ROI ≥2x, else "Kurang Efektif" merah). Insight penting: redemption tinggi ≠ efektif (lihat contoh "Flash Sale Jam Sepi": redemption rendah tapi ROI tinggi → tetap "Efektif", cocok dipromosikan lebih; sementara "Member Day Diskon 15%": redemption rendah dan ROI rendah → "Kurang Efektif").
- **Promo Paling Banyak Upsell** & **Promo Jarang Dipakai** (2 card berdampingan): list 3 promo teratas/terbawah — nama + jumlah redemption (atau upsell%) di kiri, angka utama (upsell% hijau untuk yang efektif, jumlah redemption merah untuk yang jarang dipakai) di kanan.
- **Rekomendasi Promo Ke Depan** (card full-width, PRD FR-30–32, rule-based bukan ML): 3 baris rekomendasi, masing-masing berlabel tipe (badge biru) + kalimat saran:
  1. **Bundling** — pasangkan menu terlaris dengan menu slow-moving/kandidat takeout untuk mendorong penjualannya.
  2. **Hentikan/Revisi Promo** — promo dengan ROI terendah di kategori "Kurang Efektif" ditandai untuk dihentikan/direvisi.
  3. **Waktu Promosi** — 2 jam dengan transaksi paling sedikit (dari data Peak Hour) disarankan sebagai waktu flash sale untuk mendorong transaksi di luar jam ramai.
- **Rekomendasi Menu & Promo**: card full-width. Untuk setiap dari 4 menu dengan volume penjualan terendah: nama menu + "kategori · qty terjual/periode" di kiri; di kanan, badge aksi ("Pertimbangkan Takeout" — merah, background `oklch(93% 0.04 25)`, jika qty < 300; atau "Pertahankan + Promo" — biru, background `oklch(93% 0.04 255)`, jika qty ≥ 300) + teks saran jenis promo berdasarkan kategori menu (contoh: Minuman → "Bundling dengan menu utama", Makanan → "Paket combo diskon jam sepi", Dessert → "Diskon dessert after 8PM", Snack → "Cross-sell add-on saat checkout").

## Interactions & Behavior
- **Login → Dashboard**: submit form → tampilkan dashboard, default tab "Overview".
- **Sidebar nav click**: ganti tab aktif; di mobile, otomatis menutup drawer sidebar setelah pilih menu.
- **Hamburger menu (mobile)**: toggle class `.open` pada sidebar + overlay. Klik overlay = tutup drawer.
- **Filter outlet/kategori**: `onChange` biasa pada `<select>`, langsung update semua angka turunan (tidak perlu tombol submit).
- **Filter periode**: klik tombol filter → toggle popover. Ubah tanggal dari/sampai → update state langsung (live), tombol "Terapkan" hanya menutup popover (state sudah reaktif dari onChange input date).
- **Logout**: klik "Keluar" di sidebar → balik ke Login, reset tab aktif ke Overview.
- Tidak ada animasi/transisi kompleks selain transform slide untuk drawer sidebar (`transition: transform .2s ease`).
- **Responsive breakpoint tunggal:** 1024px (mobile+tablet vs desktop). Di bawahnya: drawer sidebar + hamburger. Di atasnya: sidebar persistent, tanpa hamburger.

## State Management
State yang dibutuhkan (per PRD FR-16–19, ini representasi di layer front-end; sumber data asli dari Supabase views):
- `view`: 'login' | 'dashboard'
- `activeTab`: 'overview' | 'sales' | 'membership' | 'marketing'
- `outlet`: string (nama outlet terpilih, atau "Semua Outlet")
- `dateStart`, `dateEnd`: ISO date string — filter periode
- `category`: string (kategori produk terpilih, atau "Semua Kategori")
- `pickerOpen`, `sidebarOpen`: boolean, UI-only

**Data fetching (implementasi nyata):** setiap kombinasi filter (`outlet`, `dateStart/dateEnd`, `category`) memicu query ke Supabase views (misal `v_sales_daily`, `v_sales_by_outlet`, `v_sales_by_product`, `v_sales_by_hour`, `v_membership_summary`, `v_membership_new`, `v_top_members`, `v_promo_performance` — nama view menyesuaikan skema tim data) sesuai PRD §8 arsitektur. Gunakan query params/URL state supaya filter bisa di-share/refresh tanpa hilang.

## Data Model (dummy di desain — ganti dengan query Supabase)
- **Outlet**: `{ name, revenue, trans, aov, members }` — 5 outlet contoh.
- **Product**: `{ name, category, qty, revenue, trend }` (`trend`: 'naik'|'turun'|'stagnan') — untuk breakdown produk, analisa underperforming, & rekomendasi.
- **Promotion**: `{ name, redemptions, upsellPct, category, liftPct, roi }` — `liftPct` = kenaikan transaksi/revenue saat promo aktif vs baseline; `roi` = incremental revenue ÷ cost diskon. Status "Efektif"/"Kurang Efektif" dihitung dari `liftPct>=15 && roi>=2` (aturan bisa disesuaikan tim data/eksekutif).
- **Member**: `{ name, outlet, spending, visits, tier }`.
- Semua angka revenue dalam Rupiah (integer), diformat dengan singkatan "jt" (juta) atau "rb" (ribu) untuk keterbacaan card.
- Faktor skala periode: `factor = jumlah_hari_terpilih / 30`, dikalikan ke metrik agregat mentah untuk simulasi — di real app ini diganti agregasi SQL langsung berdasarkan `date_start`/`date_end`.

## Design Tokens
- **Warna:**
  - Aksen primer: `#2563eb` (biru)
  - Positif/growth: `#16a34a` (hijau)
  - Negatif/warning: `#dc2626` (merah)
  - Background halaman: `oklch(98% 0.003 260)`
  - Card/surface: `#ffffff`
  - Border halus: `oklch(91% 0.005 260)` / `oklch(88% 0.005 260)` (form controls)
  - Teks utama: `oklch(22% 0.01 260)`
  - Teks sekunder: `oklch(50% 0.01 260)` / `oklch(55% 0.01 260)`
  - Badge tier/biru muda: `oklch(94-95% 0.03 255)`
- **Tipografi:** system sans (`-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`). Skala: 24px/700 (judul halaman & KPI angka), 22px/700 (judul login), 19px/700 & 16px/700 (wordmark), 15px/600 (tombol), 14px/700 (judul chart card), 13px (body/label/select), 12px (delta/meta), 11px (baris tabel meta), 10px/9px (label kecil chart).
- **Radius:** 16px (card login), 14px (card dashboard), 10-12px (input, tombol, popover), 6-8px (badge).
- **Shadow:** `0 1px 3px rgba(0,0,0,.04)` (card login), `0 8px 24px rgba(0,0,0,.08)` (popover).
- **Spacing grid:** gap 16px mobile / 20px desktop antar card.

## Assets
Tidak ada asset gambar/icon eksternal — semua elemen visual (logo mark, dot indicator nav, donut chart, bar chart) dibuat dari CSS (div + border-radius + conic-gradient), tidak ada file SVG/PNG yang perlu disalin.

## Screenshots
Folder `screenshots/` berisi capture tiap screen untuk referensi visual cepat (selain membuka file HTML langsung):
- `01-login.png` — Login
- `02-overview.png` — Tab Overview
- `03-sales.png` — Tab Analisa Sales
- `04-membership.png` — Tab Analisa Membership
- `05-marketing.png` — Tab Marketing
- `06-mobile-drawer.png` — Sidebar drawer terbuka di viewport mobile (390px)

## Files
- `design-reference.dc.html` — file desain lengkap (semua screen dalam satu file, ganti tab/state secara interaktif). Buka langsung di browser.
- `PRD.md` — dokumen requirement produk asli (sumber kebutuhan fungsional & arsitektur).
- `screenshots/` — capture tiap screen, lihat daftar di atas.
