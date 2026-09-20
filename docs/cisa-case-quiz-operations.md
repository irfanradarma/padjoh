# Kuis studi kasus Domain 4–5: alur lokal dan rencana aktivasi

## Kertas kerja mahasiswa

- Buka `docs/cisa-domain-4-5-case-quiz.html` langsung di Chrome/Edge; halaman tidak mengambil data atau library dari internet.
- Mahasiswa hanya melihat satu kolom kata sandi; masing-masing sandi berupa satu kata dan menentukan paket soal di balik layar. Kedua sandi dibagikan dosen secara terpisah dan tidak ditulis di dokumen ini. Di dalam paket, tombol **Rubrik penilaian** memperlihatkan faktor penilaian umum tanpa kunci jawaban.
- Setelah masuk, pilih `Audit-2` atau `Audit-BL`, lalu 2–3 anggota. Snapshot roster di HTML berasal dari profil Supabase tanggal 20 September 2026: masing-masing 26 dan 19 mahasiswa.
- Jawaban tersimpan otomatis di penyimpanan browser perangkat tersebut. Untuk cadangan dan pengumpulan, ekspor satu file `.cisaenc` per paket. File berisi identitas tim dan 16 jawaban paket itu, dienkripsi dengan AES-256-GCM; kunci AES dibungkus dengan RSA-OAEP-SHA-256.
- Bila roster berubah, HTML harus dibuat ulang sebelum didistribusikan. Server tetap membandingkan anggota dengan profil Supabase saat upload.

## Jurnal (kode sudah lokal; belum dideploy)

- `Post-UTS → UAS Prep → Exercise` menerima `.cisaenc` dari akun salah satu anggota tim. Fitur Exercise yang sudah ada tetap dipertahankan.
- Edge Function `cisa-case-submission` mendekripsi di server, memvalidasi kelas dan anggota terhadap `profiles`, menyimpan setiap upload sebagai versi tersendiri, lalu memanggil AI untuk penilaian draf.
- Admin dapat melihat identitas tim, waktu upload, jawaban, skor per butir, komentar AI, dan meminta penilaian ulang. Skor ditandai `needs_instructor_review`; belum otomatis menjadi nilai final.
- Tabel migrasi `20260920010000_cisa_case_submissions.sql` memiliki RLS aktif dan tidak memberikan akses langsung kepada `anon`/`authenticated`; akses melalui Edge Function yang mengecek sesi dan peran.

## Kunci dan aktivasi

- Kunci publik ada di HTML. Kunci privat ada hanya dalam `.env.cisa.local` yang diabaikan Git. **Cadangkan kunci privat secara aman.** Jika hilang, file ekspor lama tidak dapat dibuka kembali.
- Sebelum fungsi dapat menerima upload di aplikasi online, terapkan migrasi, set secret server-only `CISA_CASE_PRIVATE_JWK` dari `.env.cisa.local` serta `ANTHROPIC_API_KEY`, dan deploy Edge Function bersama build aplikasi.
- Jangan menaruh kunci privat di HTML, `VITE_*`, repository, atau browser. Jangan membagikan `.env.cisa.local` kepada mahasiswa.
- Sandi di HTML offline adalah pengunci antarmuka; pengguna yang mengubah file HTML dapat melewatinya. Karena itu jangan menganggapnya sebagai kontrol pengamanan ujian yang kuat. Pembukaan paket dapat dikendalikan secara operasional dengan waktu pembagian file/sandi.
- File ekspor terenkripsi menjaga kerahasiaan isi saat dipindahkan. Karena kunci publik memang tersedia untuk mahasiswa, enkripsi **bukan** bukti bahwa isi jawaban autentik; validasi identitas uploader dan review dosen tetap diperlukan.
