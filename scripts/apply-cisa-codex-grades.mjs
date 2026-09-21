import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')

const reviewedAt = new Date().toISOString()
const reviews = [
  { id: '4f4c2464-9ca1-46c7-9594-b53265c2b5ce', scores: [5,4,4,5,10,10,10,10, 2,3,4,5,10,10,9,10], summary: 'Analisis DR sangat kuat; konsep BIA serta kontrol jalur administrasi dan atribusi individual perlu dipertegas.' },
  { id: '2bd749f3-f557-4112-9fba-f57888e0ff43', scores: [5,5,5,5,10,10,9,8, 4,5,5,5,7,6,4,6], summary: 'Domain 4 kuat; respons insiden, rekomendasi berlapis, dan bukti audit Domain 5 masih terlalu umum.' },
  { id: '2fe09201-7ae9-4e49-9de9-4870b8085a98', scores: [5,4,5,5,10,6,6,9, 5,5,5,5,10,8,8,9], summary: 'Konsep dasar baik; analisis RPO dan kontrol pra-pembukaan perlu dibuat lebih lengkap dan terukur.' },
  { id: '6d7136c3-2a2b-40fa-b95d-dd192fc1d94e', scores: [5,5,5,5,10,10,8,9, 5,5,5,5,10,9,8,10], summary: 'Sangat baik; perbaiki spesifikasi kontrol awal dan bukti efektivitas akses istimewa.' },
  { id: '6394af44-df1c-49d0-aa69-22d840fa3e6c', scores: [5,5,5,5,10,10,10,10, 5,5,5,5,5,8,10,10], summary: 'Domain 4 sangat kuat; observasi risiko Domain 5 belum memisahkan bukti dan hipotesis secara memadai.' },
  { id: 'a61c87a6-a4d0-4f65-b25a-d05aee06a26d', scores: [4,5,5,3,3,6,4,3, 5,5,5,3,9,8,5,5], summary: 'Konsep dasar cukup, tetapi titik akhir RTO salah dan skenario DR serta rekomendasi audit belum terukur.' },
  { id: '38f9a25b-b762-4fc1-8106-775e7a17ff46', scores: [5,5,5,5,9,10,10,10, 5,5,5,5,10,10,10,9], summary: 'Jawaban sangat kuat dan terukur; hanya beberapa simpulan dan keterbatasan bukti perlu dibuat lebih eksplisit.' },
  { id: 'dfea2968-4d49-4bad-b553-520f444982eb', scores: [4,3,4,3,10,3,7,7, 4,5,5,4,7,7,4,8], summary: 'Dasar cukup; analisis RPO, skenario DR, prosedur respons, dan bukti audit masih kurang rinci.' },
  { id: '32be84b1-2fa7-4ffc-b303-c1bfb5c7dfac', scores: [5,5,5,5,10,10,10,10, 4,5,5,4,4,0,3,5], summary: 'Domain 4 sangat kuat; menghapus server sebelum preservasi bukti adalah respons yang keliru dan rekomendasi Domain 5 terlalu umum.' },
  { id: '10a993a3-7576-4c77-a201-2beef41459d1', scores: [5,5,5,5,10,10,10,10, 5,5,5,5,10,10,10,10], summary: 'Jawaban lengkap, akurat, proporsional, dan terukur pada kedua domain.' },
  { id: 'a334d43f-fd65-4e7b-a2f1-32d6ed0ebe66', scores: [5,5,5,5,10,10,9,10, 5,5,5,5,9,9,10,10], summary: 'Jawaban sangat kuat; sedikit pengurangan untuk atribusi yang prematur dan kelengkapan urutan respons.' },
  { id: '27470d82-0627-4f2f-8965-e8f31bdbaf73', scores: [5,5,5,4,10,5,9,7, 5,5,5,3,10,8,10,7], summary: 'Konsep baik; analisis RPO dan skenario uji perlu angka yang lebih eksplisit, sementara verifikasi transfer perlu bukti lebih lengkap.' },
]

const guidance = [
  'definisi RTO sebagai batas waktu pemulihan proses dan RPO sebagai batas kehilangan data berdasarkan titik pemulihan',
  'fungsi BIA dalam menentukan proses kritis, dampak, prioritas, dependensi, dan target pemulihan',
  'backup harus dibuktikan dengan restore test yang memvalidasi kelengkapan, integritas, dan waktu pemulihan',
  'idempotensi memastikan replay tidak menghasilkan efek transaksi ganda',
  'gunakan pemulihan end-to-end pukul 19.10: 6 jam 10 menit, sehingga RTO 4 jam tidak tercapai',
  'lag replika 44 menit melampaui RPO 30 menit, tanpa menyimpulkan kehilangan atau debit ganda sebelum rekonsiliasi',
  'kontrol pra-pembukaan harus mencakup idempotensi, rekonsiliasi mitra, uji end-to-end, dan persetujuan pemilik proses',
  'uji DR harus menetapkan titik ukur, melibatkan mitra, dan memiliki kriteria RTO, RPO, serta integritas yang terukur',
  'segmentasi dan jump host membatasi jalur administrasi serta menyediakan titik kontrol dan pemantauan',
  'akun bersama menghalangi atribusi individual dan akuntabilitas',
  'chain of custody mencatat asal, penguasaan, perpindahan, penanganan, dan integritas bukti',
  'bedakan enkripsi at rest dan in transit serta akui bahwa kredensial sah yang disalahgunakan tetap berisiko',
  'pisahkan tiga fakta berisiko dari hipotesis; 420 MB belum membuktikan kebocoran data pasien',
  'isolasi dan preservasi bukti volatil harus mendahului eradikasi; jangan menghapus server terlebih dahulu',
  'berikan tiga rekomendasi berbeda lapisan dengan bukti efektivitas yang spesifik dan dapat diuji',
  'verifikasi klaim update melalui change, proses, tujuan, volume, hash, dan log cloud sambil mengakui keterbatasan isi transfer',
]

function feedback(score, max, criterion) {
  if (score === max) return `Memenuhi kriteria. Jawaban tepat mengenai ${criterion}.`
  if (score === 0) return `Tidak memenuhi kriteria. Jawaban perlu dikoreksi: ${criterion}.`
  if (score / max >= 0.7) return `Sebagian besar tepat. Perlu memperjelas ${criterion}.`
  return `Kredit parsial. Jawaban belum cukup membahas ${criterion}.`
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const ids = reviews.map(review => review.id)
const { data: rows, error: readError } = await supabase.from('cisa_case_submissions')
  .select('id,round,class_name,team_key,assessment').in('id', ids)
if (readError) throw readError
if (rows.length !== reviews.length) throw new Error(`Expected ${reviews.length} submissions, found ${rows.length}.`)

for (const review of reviews) {
  const row = rows.find(candidate => candidate.id === review.id)
  if (!row || row.round !== 2 || row.class_name !== 'Audit-2') throw new Error(`Submission scope mismatch: ${review.id}`)
  const oldScores = row.assessment?.cases?.flatMap(item => item.scores) || []
  if (oldScores.length !== 16 || review.scores.length !== 16) throw new Error(`Assessment shape mismatch: ${review.id}`)
  const cases = row.assessment.cases.map((item, caseIndex) => {
    const scores = item.scores.map((itemScore, questionIndex) => {
      const flatIndex = caseIndex * 8 + questionIndex
      const score = review.scores[flatIndex]
      return { id: itemScore.id, score, max_score: itemScore.max_score, feedback: feedback(score, itemScore.max_score, guidance[flatIndex]) }
    })
    return { ...item, scores, total: scores.reduce((sum, itemScore) => sum + itemScore.score, 0), max_score: 60 }
  })
  const assessment = {
    version: 2,
    reviewer_status: 'reviewed_by_codex',
    reviewer: 'OpenAI Codex',
    review_method: 'Independent rubric-based review of the submitted answers',
    reviewed_at: reviewedAt,
    summary: review.summary,
    cases,
    total: cases.reduce((sum, item) => sum + item.total, 0),
    max_score: 120,
  }
  const { error } = await supabase.from('cisa_case_submissions').update({
    status: 'graded', assessment, grading_error: null, graded_at: reviewedAt,
  }).eq('id', review.id)
  if (error) throw error
  console.log(`${review.id}: ${assessment.total}/120`)
}

console.log(`Updated ${reviews.length} independently reviewed submissions.`)
