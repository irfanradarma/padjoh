import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { rubric, submission_context, section_title } = await req.json()

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const maxTotal = rubric.criteria.reduce(
      (s: number, c: { max_score: number }) => s + Number(c.max_score || 0), 0
    )
    const rubricText = rubric.criteria
      .map((c: { name: string; max_score: number; description: string }) =>
        `• ${c.name} (maks ${c.max_score} poin): ${c.description}`)
      .join('\n')

    const prompt = `Kamu adalah dosen penilai untuk mata kuliah IS Audit di PKN STAN.
Nilailah submission latihan mahasiswa berikut berdasarkan rubrik yang diberikan.

TUGAS: ${section_title || 'Latihan IS Audit'}

RUBRIK (Total maks ${maxTotal} poin):
${rubricText}

DESKRIPSI SUBMISSION (ditulis oleh dosen yang sudah membaca file):
${submission_context}

Berikan penilaian HANYA dalam format JSON berikut, tanpa teks lain:
{
  "scores": [
    { "criterion": "<nama kriteria>", "score": <angka>, "max_score": <angka>, "comment": "<komentar singkat dalam bahasa Indonesia>" }
  ],
  "total_score": <angka 0-${maxTotal}>,
  "summary": "<ringkasan penilaian 2-3 kalimat dalam bahasa Indonesia>"
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`AI tidak mengembalikan JSON valid: ${text.slice(0, 200)}`)

    const result = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
