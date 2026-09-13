# Instructor Solution: Investigasi Insiden Akses dan Kebocoran Data

> Dokumen ini berisi kunci jawaban. Jangan dibagikan bersama audit program mahasiswa.

## Ringkasan jawaban kasus

Terjadi pengambilalihan akun `nina.santoso` pada 20 Agustus 2026 pukul 22:26:41. Sesi berhasil berasal dari `203.0.113.77` dengan kode negara `SG`, berlangsung di luar jam kerja, dan tidak terkait dengan aset terdaftar. Sebelum keberhasilan tersebut, IP yang sama melakukan 17 kegagalan login terhadap lima akun.

Melalui sesi `900001`, pelaku membaca data Finance dan HR, kemudian mengekspor 84 record `vendor_bank_accounts` dan 1.260 record `employee_payroll`, total sedikitnya 1.344 record. Setelah itu terdapat dua transfer keluar ke `203.0.113.88` dengan total 61.652.578 byte.

Nina adalah pemilik akun yang menjadi korban dan tidak boleh otomatis dinyatakan sebagai pelaku. Bukti mengarah pada aktor eksternal yang memperoleh kredensial melalui phishing atau password spraying. MFA pada akun Nina tidak aktif.

## Query dan hasil yang diharapkan

### Prosedur 1

```sql
SELECT DATE(captured_at) AS activity_date,
       COUNT(*) AS traffic_events,
       ROUND(AVG(bytes_sent), 0) AS avg_bytes_sent,
       SUM(bytes_sent) AS total_bytes_sent
FROM network_traffic
GROUP BY DATE(captured_at)
ORDER BY activity_date;
```

Pola normal:

- Hari kerja memiliki 1.062 event per hari.
- Akhir pekan hanya memiliki sekitar 118–160 event.
- Rata-rata normal `bytes_sent` berada di kisaran 179–230 ribu byte.
- 20 Agustus memiliki 1.065 event tetapi rata-rata 1.103.624 byte dan total 1.175.359.284 byte. Volume, bukan jumlah event, merupakan anomalinya.

### Prosedur 2

```sql
SELECT HOUR(captured_at) AS activity_hour,
       COUNT(*) AS traffic_events,
       ROUND(AVG(bytes_sent), 0) AS avg_bytes_sent,
       SUM(bytes_sent) AS total_bytes_sent
FROM network_traffic
GROUP BY HOUR(captured_at)
ORDER BY traffic_events DESC, activity_hour;
```

Jam tersibuk berdasarkan jumlah event adalah pukul 09, 13, 14, dan 10. Pukul 23 hanya memiliki 16 event tetapi total transfer sekitar 893 MB. Pukul 22 hanya memiliki 10 event tetapi rata-ratanya sekitar 6,31 MB. Kedua jam ini perlu diperiksa, tetapi belum dapat langsung dinyatakan sebagai insiden.

### Prosedur 3

```sql
SELECT DATE(attempted_at) AS activity_date,
       login_status,
       COUNT(*) AS login_events
FROM login_logs
GROUP BY DATE(attempted_at), login_status
ORDER BY activity_date, login_status;
```

Hari kerja normal memiliki sekitar 11–17 login gagal. Pada 20 Agustus terdapat 50 login gagal, sehingga tanggal tersebut menjadi prioritas pemeriksaan.

### Prosedur 4

```sql
SELECT u.username, u.full_name, a.asset_tag, a.hostname
FROM users u
JOIN assets a ON a.owner_user_id = u.user_id
WHERE u.department = 'Finance'
ORDER BY u.username;
```

Hasil: enam pengguna Finance. Aset Nina adalah `LT-004` / `WKS-NINA`.

### Prosedur 5

```sql
SELECT source_ip,
       country_code,
       COUNT(*) AS failed_attempts,
       COUNT(DISTINCT user_id) AS targeted_users
FROM login_logs
WHERE login_status = 'FAILED'
  AND source_ip NOT LIKE '10.%'
GROUP BY source_ip, country_code
HAVING COUNT(*) >= 5
ORDER BY failed_attempts DESC;
```

| source_ip | country_code | failed_attempts | targeted_users |
|---|---:|---:|---:|
| 203.0.113.77 | SG | 17 | 5 |
| 192.0.2.44 | ID | 15 | 15 |

`192.0.2.44` adalah red herring: vulnerability scan resmi tanpa login berhasil.

### Prosedur 6

```sql
SELECT l.login_id, u.username, l.attempted_at, l.source_ip, l.country_code
FROM login_logs l
JOIN users u ON u.user_id = l.user_id
WHERE l.login_status = 'SUCCESS'
  AND (TIME(l.attempted_at) < u.work_start
       OR TIME(l.attempted_at) > u.work_end)
ORDER BY l.attempted_at;
```

Hasil:

- `900001`, `nina.santoso`, 20 Agustus 22:26:41, `203.0.113.77`, SG.
- `800001`, `sita.maharani`, 20 Agustus 23:04:12, `10.20.1.22`, ID.

Login Sita terlihat anomali tetapi merupakan pekerjaan DBA yang disetujui.

### Prosedur 7

```sql
SELECT l.login_id, u.username, l.attempted_at, l.source_ip
FROM login_logs l
JOIN users u ON u.user_id = l.user_id
WHERE l.login_status = 'SUCCESS'
  AND l.asset_id IS NULL
ORDER BY l.attempted_at;
```

Hanya sesi `900001` milik `nina.santoso` yang ditemukan.

### Prosedur 8

```sql
SELECT u.username,
       d.executed_at,
       d.database_name,
       d.target_table,
       d.returned_rows,
       d.exported
FROM database_activity d
JOIN login_logs l ON l.login_id = d.login_id
JOIN users u ON u.user_id = d.user_id
WHERE l.source_ip = '203.0.113.77'
ORDER BY d.executed_at;
```

Hasil sesi Nina:

| waktu | database | tabel | rows | exported |
|---|---|---|---:|---:|
| 22:31:08 | corp_main | finance_payments | 312 | 0 |
| 22:34:19 | corp_main | vendor_bank_accounts | 84 | 1 |
| 22:38:55 | hr_core | employee_payroll | 1260 | 1 |
| 22:42:06 | corp_main | users | 30 | 0 |

### Prosedur 9

```sql
SELECT u.username,
       COUNT(*) AS export_events,
       SUM(d.returned_rows) AS total_rows
FROM database_activity d
JOIN users u ON u.user_id = d.user_id
WHERE d.exported = 1
GROUP BY u.username
ORDER BY total_rows DESC;
```

| username | export_events | total_rows |
|---|---:|---:|
| sita.maharani | 1 | 15000 |
| nina.santoso | 2 | 1344 |

Ekspor Sita lebih besar, tetapi query berisi change reference `CHG-2026-0820`, memakai IP internal dan memiliki laporan maintenance yang disetujui. Ini adalah red herring kedua.

### Prosedur 10

```sql
SELECT u.username, n.captured_at, n.destination_ip, n.bytes_sent
FROM network_traffic n
JOIN users u ON u.user_id = n.user_id
WHERE n.bytes_sent > 10000000
  AND n.destination_ip NOT LIKE '10.%'
ORDER BY n.bytes_sent DESC;
```

Hasil: dua transfer milik akun Nina ke `203.0.113.88`, masing-masing 48.762.134 dan 12.890.444 byte.

### Prosedur 11

```sql
SELECT r.report_id,
       r.opened_at,
       u.username,
       r.report_type,
       r.severity,
       r.report_status
FROM incident_reports r
JOIN users u ON u.user_id = r.reported_by_user_id
ORDER BY r.opened_at;
```

Laporan yang perlu dibaca lebih lanjut:

- Report 1: Nina melaporkan email phishing dua hari sebelum insiden.
- Report 2: mengonfirmasi `192.0.2.44` sebagai vulnerability scan resmi.
- Report 3: mengonfirmasi pekerjaan DBA Sita sebagai aktivitas yang disetujui.
- Report 4: alert transfer data terkait sesi `900001`.
- Report 5: pemilik akun menyangkal melakukan aktivitas tersebut.

Untuk membaca detail:

```sql
SELECT report_id, description, resolution_notes
FROM incident_reports
ORDER BY report_id;
```

### Prosedur 12 — Kesimpulan auditor

Kesimpulan yang memenuhi bukti:

- Insiden terjadi pada 20 Agustus 2026.
- Akun `nina.santoso` diambil alih; Nina adalah korban, bukan otomatis pelaku.
- Login pertama yang berhasil terjadi pukul 22:26:41 dari `203.0.113.77` / SG tanpa aset terdaftar.
- Pelaku mengekspor sedikitnya 1.344 record sensitif dari `vendor_bank_accounts` dan `employee_payroll`.
- Sekitar 61,65 MB dikirim ke `203.0.113.88` setelah aktivitas database tersebut.
- Kemungkinan jalur awal adalah phishing yang diikuti password spraying; akun tidak dilindungi MFA.
- Vulnerability scan, pekerjaan DBA malam, dan backup internal tidak boleh dimasukkan sebagai aktivitas pelaku.

## Easter egg

String `ORCHID-47` muncul pada dua sumber yang tampaknya terpisah:

```sql
SELECT activity_id, query_text
FROM database_activity
WHERE query_text LIKE '%ORCHID-47%';

SELECT report_id, description
FROM incident_reports
WHERE description LIKE '%ORCHID47%';
```

Attachment phishing bernama `Payment_Adjustment_ORCHID47.xlsm`, sedangkan dua query ekspor mengandung komentar `/* ORCHID-47 */`. Ini menjadi petunjuk bonus yang menghubungkan email phishing dengan tooling atau campaign pelaku. Mahasiswa tidak harus menemukannya untuk lulus, tetapi dapat memperoleh nilai bonus.

## Red herrings

1. `192.0.2.44`: menghasilkan 15 login gagal, tetapi berasal dari vulnerability scan resmi dan tidak pernah berhasil login.
2. `sita.maharani`: login pukul 23:04 dan mengekspor 15.000 record, tetapi berasal dari aset serta IP internal, memiliki change reference, dan didukung laporan maintenance.
3. Backup service mengirim data hampir 900 MB, tetapi tujuan `10.20.40.10` merupakan jaringan internal.

## Kesimpulan kontrol

Kontrol yang gagal:

- MFA tidak diwajibkan untuk akun dengan akses data keuangan.
- Laporan phishing ditutup tanpa investigasi lanjutan.
- Password spraying tidak diblokir sebelum satu login berhasil.
- Akses dari negara dan perangkat baru tidak meminta verifikasi tambahan.
- Akun Finance dapat membaca data payroll yang tidak sesuai kebutuhan tugas.
- Transfer keluar berukuran besar tidak diblokir secara otomatis.

Rekomendasi: wajibkan MFA, terapkan rate limiting dan account lockout adaptif, gunakan conditional access, perbaiki least privilege, korelasikan alert phishing dengan autentikasi, serta terapkan pembatasan dan alert Data Loss Prevention.
