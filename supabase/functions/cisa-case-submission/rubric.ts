export const CASE_RUBRICS: Record<string, { title: string; facts: string; criteria: string[] }> = {
  'r1-d4': {
    title: 'KRS: operasi, job scheduling, kapasitas, dan insiden',
    facts: 'Portal gagal menyimpan 09.00–12.10 (190 menit). RTO internal 60 menit; SLA 99,5% untuk 09.00–17.00. Job rekonsiliasi dipindah tanpa persetujuan dan bertepatan dengan CPU 96% serta lock wait 42 detik. Traffic 15% di bawah proyeksi. Ada 146 transaksi belum cocok, bukan kehilangan data terkonfirmasi.',
    criteria: [
      'Definisi job scheduling serta pentingnya pengendalian waktu dan beban job produksi.',
      'Incident management memulihkan layanan; problem management mengidentifikasi akar masalah dan mencegah pengulangan.',
      'Dua log/metrik relevan, misalnya job scheduler, DB lock/CPU, aplikasi, atau antrean, beserta kegunaan.',
      'Perubahan terencana versus darurat; perubahan darurat tetap perlu otorisasi dan tinjau ulang.',
      'Menghitung 190 menit; target pemulihan 60 menit gagal. Jika membahas availability, jendela 480 menit memberi 60,4%, di bawah 99,5%.',
      'Dua kelemahan material masing-masing dihubungkan fakta, risiko bisnis, dan bukti audit tambahan.',
      'Menolak kepastian akar masalah prematur; memprioritaskan pemulihan/rekonsiliasi serta kontrol permanen yang spesifik.',
      'Tiga prosedur audit lanjutan dengan populasi/sampel, bukti, dan kriteria lulus yang dapat diuji.'
    ]
  },
  'r1-d5': {
    title: 'Akun vendor: IAM, DLP, dan respons insiden',
    facts: 'Kontrak berakhir 31 Agustus; akses wajib dicabut 24 jam tetapi masih aktif 15 September. MFA wajib, pengecualian maksimal 7 hari dengan persetujuan CISO, namun pengecualian sejak 1 Juni tanpa akhir. Ekspor 6.240 record 38 MB dan upload eksternal 38 MB terekam, isi transfer/pelaku belum dipastikan. Alert 10.16, akun dinonaktifkan 11.02. Log proxy hanya disimpan 7 hari.',
    criteria: [
      'Least privilege membatasi hak sesuai kebutuhan tugas; hak ekspor seluruh data vendor patut diuji.',
      'Fungsi MFA dan perlunya pengecualian berbatas waktu, disetujui, serta dimonitor.',
      'Alert DLP adalah indikasi; penerimaan/isi data dan pihak penerima belum terkonfirmasi.',
      'Review akses periodik memastikan kebutuhan akses masih sah; pemilik aplikasi/data mengonfirmasi.',
      'Dua kelemahan kontrol terbukti serta kontrol semestinya dan bukti pengujiannya.',
      'Tidak menunggu kepastian kebocoran untuk respons; containment, preservasi bukti, investigasi proporsional tanpa mengklaim pelaku.',
      'Temuan kondisi–kriteria–risiko–rekomendasi dengan keterbatasan kesimpulan yang eksplisit.',
      'Prioritaskan log proxy yang volatil lalu korelasikan aplikasi, DLP, identitas, endpoint, dan tujuan eksternal; hindari atribusi prematur.'
    ]
  },
  'r2-d4': {
    title: 'Failover pembayaran: BIA, RTO/RPO, DRP, dan integritas',
    facts: 'Gangguan 13.00. Login cadangan 15.20, tetapi pembayaran end-to-end baru tersedia 19.10, yaitu 6 jam 10 menit. RTO 4 jam, RPO 30 menit. Replika terakhir 12.16 berarti lag 44 menit saat gangguan. Backup penuh 00.00; replay 2.800 pesan, 82 ID muncul dua kali namun status final belum diketahui. Uji DR terakhir memakai data statis tanpa mitra.',
    criteria: [
      'RTO adalah batas waktu pemulihan proses bisnis; RPO adalah batas kehilangan data berdasarkan titik pemulihan.',
      'BIA menentukan proses kritis, dampak, prioritas, dependensi, dan target pemulihan.',
      'Backup ada belum membuktikan restore lengkap/tepat waktu; perlu uji restore yang memverifikasi data.',
      'Idempotent berarti replay berulang tidak menciptakan efek transaksi ganda.',
      'Menggunakan pemulihan pembayaran end-to-end 19.10, menghitung 6 jam 10 menit, menyatakan RTO 4 jam tidak tercapai.',
      'Lag replika 44 menit melampaui RPO 30 menit pada titik failover, tetapi kehilangan final belum pasti karena replay/rekonsiliasi.',
      'Kontrol pra-pembukaan: rekonsiliasi lintas mitra, deduplikasi/idempotensi, persetujuan pemilik bisnis; perbaikan DRP konkret.',
      'Uji DR end-to-end dengan batas pengukuran, sistem mitra, dan kriteria RTO/RPO/integritas yang jelas.'
    ]
  },
  'r2-d5': {
    title: 'Server integrasi: jaringan, akses istimewa, cloud, dan bukti digital',
    facts: 'Port administrasi internet terbuka tiga pekan meski hanya VPN+jump host diizinkan. Review perubahan darurat wajib 48 jam. Login akun admin bersama dari IP luar 04.12, konfigurasi dibaca 04.15, transfer 420 MB ke cloud tidak disetujui 04.18–04.27. Log firewall tidak menunjukkan isi. Server masih hidup; EDR aktif; log cloud belum ditarik; penggunaan secret belum terbukti.',
    criteria: [
      'Segmentasi/jump host membatasi jalur administrasi dan menyediakan titik kontrol/monitoring.',
      'Akun bersama menghalangi atribusi individual dan akuntabilitas.',
      'Chain of custody mencatat asal, penguasaan, perpindahan, integritas, dan penanganan bukti.',
      'At rest melindungi data tersimpan, in transit data bergerak; tidak otomatis mencegah penyalahgunaan kredensial sah.',
      'Tiga observasi berisiko dengan pemisahan bukti dari hipotesis; 420 MB bukan bukti final data pasien bocor.',
      'Tidak langsung menghapus server; isolasi proporsional dan preservasi memori/log/artefak volatil dengan chain of custody.',
      'Tiga rekomendasi berbeda lapisan beserta bukti audit efektivitas yang terukur.',
      'Verifikasi klaim update normal dengan change/vendor/update logs, hash/tujuan, waktu/volume; tetap akui keterbatasan isi transfer.'
    ]
  }
};

export const questionIds = (round: number) =>
  [`r${round}-d4`, `r${round}-d5`].flatMap(caseId =>
    Array.from({ length: 8 }, (_, i) => `${caseId}-q${String(i + 1).padStart(2, '0')}`)
  );
