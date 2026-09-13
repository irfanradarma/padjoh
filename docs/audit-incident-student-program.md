# Program Audit: Investigasi Insiden Akses dan Kebocoran Data

## Latar belakang

Pada 21 Agustus 2026, manajemen menerima laporan mengenai aktivitas tidak biasa pada sistem perusahaan. Tim TI belum dapat memastikan apakah aktivitas tersebut merupakan serangan, pekerjaan administratif yang sah, atau false positive.

Anda bertindak sebagai auditor SI. Gunakan data pada enam tabel berikut untuk mengumpulkan dan menghubungkan bukti:

- `users`
- `assets`
- `login_logs`
- `database_activity`
- `network_traffic`
- `incident_reports`

Seluruh nama, alamat, peristiwa, dan pengenal pada dataset bersifat fiktif.

## Tujuan audit

1. Menentukan apakah terjadi akses tidak sah.
2. Menentukan akun dan sesi yang terdampak.
3. Mengidentifikasi waktu serta sumber aktivitas.
4. Menentukan data yang mungkin diakses atau dikeluarkan.
5. Membedakan insiden nyata dari aktivitas sah yang terlihat mencurigakan.
6. Menyusun kesimpulan berdasarkan bukti, bukan hanya satu anomali.

## Ketentuan pengerjaan

- Simpan setiap query yang digunakan.
- Jangan mengubah atau menghapus data.
- Mayoritas prosedur cukup menggunakan satu tabel atau `JOIN` dua tabel.
- Gunakan nama kolom pada instruksi sebagai struktur output.
- Jika menemukan petunjuk tidak biasa pada kolom teks, catat sebagai bukti tambahan.

## Prosedur audit

### A. Memahami perilaku normal — 15 menit

#### Prosedur 1 — Profil traffic harian

Buat ringkasan aktivitas jaringan untuk setiap tanggal. Hitung jumlah traffic event, rata-rata `bytes_sent`, dan total `bytes_sent`.

Output: `activity_date`, `traffic_events`, `avg_bytes_sent`, `total_bytes_sent`.

Urutkan berdasarkan tanggal. Amati perbedaan hari kerja dan akhir pekan, kemudian catat tanggal yang volumenya tidak mengikuti pola umum.

#### Prosedur 2 — Rush hour dan anomali per jam

Kelompokkan seluruh network traffic berdasarkan jam. Hitung jumlah event, rata-rata byte terkirim, dan total byte terkirim.

Output: `activity_hour`, `traffic_events`, `avg_bytes_sent`, `total_bytes_sent`.

Urutkan berdasarkan jumlah event terbesar. Tentukan jam operasional yang biasanya paling sibuk. Setelah itu, periksa apakah jam dengan total byte terbesar sama dengan jam yang memiliki event terbanyak.

#### Prosedur 3 — Pola autentikasi harian

Kelompokkan `login_logs` berdasarkan tanggal dan `login_status`. Hitung jumlah event untuk setiap kelompok.

Output: `activity_date`, `login_status`, `login_events`.

Urutkan berdasarkan tanggal dan status. Catat tanggal dengan peningkatan login gagal dibandingkan hari kerja lainnya.

#### Prosedur 4 — Pengguna dan aset Finance

Gunakan `JOIN` untuk menampilkan pengguna Finance beserta perangkat yang terdaftar atas namanya.

Output: `username`, `full_name`, `asset_tag`, `hostname`.

Urutkan berdasarkan `username`.

### B. Mengidentifikasi anomali login — 15 menit

#### Prosedur 5 — Sumber kegagalan login

Cari alamat IP eksternal (alamat yang tidak dimulai dengan `10.`) yang menghasilkan sedikitnya lima login gagal. Hitung juga berapa akun berbeda yang menjadi target.

Output: `source_ip`, `country_code`, `failed_attempts`, `targeted_users`.

Urutkan dari jumlah kegagalan terbesar.

> Catatan auditor: IP dengan banyak kegagalan belum tentu merupakan penyerang. Cari bukti tambahan.

#### Prosedur 6 — Login berhasil di luar jam kerja

Hubungkan `login_logs` dengan `users`. Cari login berhasil yang waktunya berada sebelum `work_start` atau setelah `work_end` pengguna.

Output: `login_id`, `username`, `attempted_at`, `source_ip`, `country_code`.

Urutkan berdasarkan waktu.

#### Prosedur 7 — Login tanpa aset terdaftar

Cari login berhasil yang tidak memiliki `asset_id`. Hubungkan hasilnya dengan nama pengguna.

Output: `login_id`, `username`, `attempted_at`, `source_ip`.

### C. Menilai aktivitas setelah login — 13 menit

#### Prosedur 8 — Aktivitas database dari sumber mencurigakan

Gunakan alamat IP yang paling perlu diselidiki berdasarkan Prosedur 5–7. Hubungkan `database_activity`, `login_logs`, dan `users` untuk melihat aktivitas database yang berasal dari sesi tersebut.

Output: `username`, `executed_at`, `database_name`, `target_table`, `returned_rows`, `exported`.

Urutkan berdasarkan waktu eksekusi.

#### Prosedur 9 — Ringkasan ekspor data

Cari seluruh aktivitas database dengan `exported = 1`. Hitung jumlah kegiatan ekspor dan total baris untuk setiap pengguna.

Output: `username`, `export_events`, `total_rows`.

Urutkan dari total baris terbesar.

> Catatan auditor: ekspor terbesar belum tentu merupakan insiden. Periksa tujuan, waktu, dan laporan pendukung.

### D. Menguji indikasi eksfiltrasi — 7 menit

#### Prosedur 10 — Transfer keluar berukuran besar

Hubungkan `network_traffic` dengan `users`. Cari transfer lebih dari 10.000.000 byte menuju alamat yang bukan jaringan internal `10.%`.

Output: `username`, `captured_at`, `destination_ip`, `bytes_sent`.

Urutkan dari ukuran transfer terbesar.

### E. Mengevaluasi konteks dan menyimpulkan — 10 menit

#### Prosedur 11 — Telaah laporan insiden

Hubungkan `incident_reports` dengan pengguna yang membuat laporan.

Output: `report_id`, `opened_at`, `username`, `report_type`, `severity`, `report_status`.

Urutkan berdasarkan waktu laporan. Setelah query dijalankan, baca kolom `description` dan `resolution_notes` pada laporan yang relevan untuk membedakan insiden, aktivitas resmi, dan petunjuk historis.

#### Prosedur 12 — Kesimpulan auditor

Susun kesimpulan singkat yang menjawab:

1. Apakah terjadi insiden keamanan?
2. Akun siapa yang digunakan? Apakah pemilik akun otomatis merupakan pelaku?
3. Kapan akses tidak sah pertama berhasil?
4. Dari IP dan negara mana akses tersebut berasal?
5. Tabel serta perkiraan jumlah record apa yang diekspor?
6. Ke mana data diduga dikirim?
7. Apa kemungkinan modus awal serangannya?
8. Aktivitas mencurigakan mana yang ternyata sah atau merupakan false positive?
9. Kontrol apa yang gagal dan apa rekomendasi perbaikannya?

Untuk setiap kesimpulan utama, cantumkan minimal dua bukti yang berasal dari tabel berbeda.

## Format penyerahan

1. Query untuk Prosedur 1–11.
2. Hasil utama dari setiap query.
3. Kesimpulan Prosedur 12 sepanjang 100–150 kata.
4. Daftar bukti dengan format: `waktu — sumber tabel — fakta — interpretasi`.
