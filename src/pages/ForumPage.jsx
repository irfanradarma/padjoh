import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// ── Utilities ─────────────────────────────────────────────────
function fmtRelTime(str) {
  const s = (Date.now() - new Date(str).getTime()) / 1000
  if (s < 60)      return 'baru saja'
  if (s < 3600)    return `${Math.floor(s / 60)} mnt lalu`
  if (s < 86400)   return `${Math.floor(s / 3600)} jam lalu`
  if (s < 2592000) return `${Math.floor(s / 86400)} hari lalu`
  return new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function extractUrl(text) {
  const m = (text ?? '').match(/https?:\/\/[^\s<>"]+/)
  return m ? m[0].replace(/[.,;:!?)]+$/, '') : null
}

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

async function uploadForumImage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('forum').upload(path, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('forum').getPublicUrl(path)
  return publicUrl
}

// ── Link / video preview ──────────────────────────────────────
function LinkPreview({ url }) {
  const [meta, setMeta] = useState(null)
  const ytId = getYouTubeId(url)

  useEffect(() => {
    if (ytId) return
    let cancelled = false
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.status === 'success') setMeta(d.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [url, ytId])

  if (ytId) {
    return (
      <div className="fr-yt-wrap">
        <iframe
          className="fr-yt-frame"
          src={`https://www.youtube.com/embed/${ytId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  let hostname = url
  try { hostname = new URL(url).hostname } catch {}

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="fr-link-card">
      {meta?.image?.url && (
        <img
          src={meta.image.url}
          alt=""
          className="fr-link-card-img"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      <div className="fr-link-card-body">
        <div className="fr-link-card-title">{meta?.title || hostname}</div>
        {meta?.description && (
          <div className="fr-link-card-desc">{meta.description}</div>
        )}
        <div className="fr-link-card-host">{meta?.publisher || hostname}</div>
      </div>
    </a>
  )
}

// ── Vote bar ──────────────────────────────────────────────────
function VoteBar({ score, myVote, onVote, compact = false }) {
  return (
    <div className={`fr-vote-bar${compact ? ' fr-vote-bar-compact' : ''}`}>
      <button
        className={`fr-vote-btn fr-vote-up${myVote === 1 ? ' active' : ''}`}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
        title="Upvote"
      >▲</button>
      <span className={`fr-vote-score${myVote === 1 ? ' up' : myVote === -1 ? ' down' : ''}`}>
        {score}
      </span>
      <button
        className={`fr-vote-btn fr-vote-down${myVote === -1 ? ' active' : ''}`}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
        title="Downvote"
      >▼</button>
    </div>
  )
}

// ── Reply item ────────────────────────────────────────────────
function ReplyItem({ reply, profile, onDelete }) {
  const [score, setScore]   = useState(reply.vote_sum ?? 0)
  const [myVote, setMyVote] = useState(reply.my_vote ?? null)
  const [voting, setVoting] = useState(false)

  async function vote(v) {
    if (voting) return
    setVoting(true)
    const nv = myVote === v ? 0 : v
    setScore(s => s + (nv - (myVote || 0)))
    setMyVote(nv || null)
    await supabase.rpc('vote_forum_post', { p_post_id: reply.id, p_vote: nv })
    setVoting(false)
  }

  async function del() {
    await supabase.rpc('delete_forum_post', { p_id: reply.id })
    onDelete(reply.id)
  }

  const initial = (reply.author_name ?? reply.author_npm ?? '?')[0].toUpperCase()

  return (
    <div className="fr-reply">
      <div className="fr-reply-meta">
        <div className="fr-avatar fr-avatar-sm">{initial}</div>
        <span className="fr-author fr-author-sm">{reply.author_name ?? reply.author_npm}</span>
        {reply.is_anon && <span className="fr-anon-badge">anonim</span>}
        {!reply.is_anon && reply.author_class && (
          <span className="fr-class-badge">· {reply.author_class}</span>
        )}
        <span className="fr-time">{fmtRelTime(reply.created_at)}</span>
        {(reply.is_own || profile.is_admin) && (
          <button className="fr-del-btn" onClick={del}>Hapus</button>
        )}
      </div>
      <div className="fr-reply-content">{reply.content}</div>
      {reply.image_url && (
        <img
          src={reply.image_url}
          alt="lampiran"
          className="fr-post-img"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      {reply.link_url && !reply.image_url && (
        <div style={{ marginTop: 6 }}><LinkPreview url={reply.link_url} /></div>
      )}
      <VoteBar score={score} myVote={myVote} onVote={vote} compact />
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────
function PostCard({ post, profile, onDelete }) {
  const [score, setScore]             = useState(post.vote_sum ?? 0)
  const [myVote, setMyVote]           = useState(post.my_vote ?? null)
  const [replyCount, setReplyCount]   = useState(post.reply_count ?? 0)
  const [replies, setReplies]         = useState([])
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [loadingR, setLoadingR]       = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [replyText, setReplyText]     = useState('')
  const [replyAnon, setReplyAnon]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [voting, setVoting]           = useState(false)
  const textareaRef                   = useRef()

  async function vote(v) {
    if (voting) return
    setVoting(true)
    const nv = myVote === v ? 0 : v
    setScore(s => s + (nv - (myVote || 0)))
    setMyVote(nv || null)
    await supabase.rpc('vote_forum_post', { p_post_id: post.id, p_vote: nv })
    setVoting(false)
  }

  async function loadReplies() {
    setLoadingR(true)
    const { data } = await supabase.rpc('get_forum_replies', { p_post_id: post.id })
    setReplies(data ?? [])
    setLoadingR(false)
  }

  function toggleReplies() {
    const next = !repliesOpen
    setRepliesOpen(next)
    if (next && replyCount > 0) loadReplies()
  }

  function openReplyForm() {
    setShowForm(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function submitReply(e) {
    e.preventDefault()
    const txt = replyText.trim(); if (!txt) return
    setSubmitting(true)
    const linkUrl = extractUrl(txt) || null
    await supabase.rpc('create_forum_post_v2', {
      p_content: txt, p_is_anon: replyAnon, p_parent_id: post.id, p_link_url: linkUrl,
    })
    setReplyText(''); setReplyAnon(false); setShowForm(false)
    setReplyCount(n => n + 1)
    setRepliesOpen(true)
    loadReplies()
    setSubmitting(false)
  }

  async function del() {
    await supabase.rpc('delete_forum_post', { p_id: post.id })
    onDelete(post.id)
  }

  const initial = (post.author_name ?? post.author_npm ?? '?')[0].toUpperCase()

  return (
    <div className="fr-post">
      <div className="fr-post-body">
        {/* Vote column */}
        <div className="fr-vote-col">
          <button
            className={`fr-vote-btn fr-vote-up${myVote === 1 ? ' active' : ''}`}
            onClick={() => vote(1)} title="Upvote"
          >▲</button>
          <span className={`fr-vote-score${myVote === 1 ? ' up' : myVote === -1 ? ' down' : ''}`}>
            {score}
          </span>
          <button
            className={`fr-vote-btn fr-vote-down${myVote === -1 ? ' active' : ''}`}
            onClick={() => vote(-1)} title="Downvote"
          >▼</button>
        </div>

        {/* Content */}
        <div className="fr-content-col">
          <div className="fr-meta">
            <div className="fr-avatar">{initial}</div>
            <span className="fr-author">{post.author_name ?? post.author_npm}</span>
            {post.is_anon && <span className="fr-anon-badge">anonim</span>}
            {!post.is_anon && post.author_class && (
              <span className="fr-class-badge">· {post.author_class}</span>
            )}
            <span className="fr-time">{fmtRelTime(post.created_at)}</span>
            {(post.is_own || profile.is_admin) && (
              <button className="fr-del-btn" onClick={del}>Hapus</button>
            )}
          </div>

          <div className="fr-post-content">{post.content}</div>
          {post.image_url && (
            <img
              src={post.image_url}
              alt="lampiran"
              className="fr-post-img"
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          {post.link_url && !post.image_url && (
            <LinkPreview url={post.link_url} />
          )}

          <div className="fr-actions">
            <button
              className={`fr-action-btn${repliesOpen ? ' active' : ''}`}
              onClick={toggleReplies}
            >
              💬 {replyCount > 0 ? `${replyCount} balasan` : 'Balasan'}{repliesOpen ? ' ▲' : ' ▼'}
            </button>
            <button
              className={`fr-action-btn${showForm ? ' active' : ''}`}
              onClick={showForm ? () => setShowForm(false) : openReplyForm}
            >
              ↩ Balas
            </button>
          </div>
        </div>
      </div>

      {/* Inline reply form */}
      {showForm && (
        <form className="fr-reply-form" onSubmit={submitReply}>
          <textarea
            ref={textareaRef}
            className="fr-compose-input"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Tulis balasan…"
            rows={2}
          />
          <div className="fr-compose-footer">
            <label className="fr-anon-check">
              <input type="checkbox" checked={replyAnon} onChange={e => setReplyAnon(e.target.checked)} />
              Balas sebagai Anonim
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-sm" onClick={() => { setShowForm(false); setReplyText('') }}>Batal</button>
              <button className="btn-sm btn-sm-primary" disabled={submitting || !replyText.trim()}>
                {submitting ? '…' : 'Kirim'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Replies section */}
      {repliesOpen && (
        <div className="fr-replies">
          {loadingR
            ? <div className="fr-loading">Memuat balasan…</div>
            : replies.length === 0
              ? <div className="fr-loading">Belum ada balasan.</div>
              : replies.map(r => (
                  <ReplyItem
                    key={r.id}
                    reply={r}
                    profile={profile}
                    onDelete={id => setReplies(prev => prev.filter(x => x.id !== id))}
                  />
                ))
          }
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function ForumPage({ profile }) {
  const [posts, setPosts]                = useState([])
  const [loading, setLoading]            = useState(true)
  const [sort, setSort]                  = useState('hot')
  const [content, setContent]            = useState('')
  const [isAnon, setIsAnon]              = useState(false)
  const [posting, setPosting]            = useState(false)
  const [uploading, setUploading]        = useState(false)
  const [imageFile, setImageFile]        = useState(null)
  const [imagePreviewUrl, setImgPreview] = useState(null)
  const [detectedUrl, setDetectedUrl]    = useState(null)
  const fileRef                          = useRef()
  const debounceRef                      = useRef()

  useEffect(() => { load() }, [])

  // Debounce URL detection from compose text (600ms after user stops typing)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDetectedUrl(extractUrl(content) || null)
    }, 600)
    return () => clearTimeout(debounceRef.current)
  }, [content])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_forum_posts_v2')
    setPosts(data ?? [])
    setLoading(false)
  }

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) =>
      sort === 'hot'
        ? (b.vote_sum - a.vote_sum) || (new Date(b.created_at) - new Date(a.created_at))
        : new Date(b.created_at) - new Date(a.created_at)
    )
  }, [posts, sort])

  function handleImageSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.'); e.target.value = ''; return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 5 MB.'); e.target.value = ''; return
    }
    setImageFile(file)
    setImgPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null); setImgPreview(null)
  }

  async function submitPost(e) {
    e.preventDefault()
    const txt = content.trim()
    if (!txt && !imageFile) return
    setPosting(true)

    let imgUrl = null
    if (imageFile) {
      setUploading(true)
      try {
        imgUrl = await uploadForumImage(imageFile)
      } catch (err) {
        alert('Gagal upload gambar: ' + err.message)
        setPosting(false); setUploading(false); return
      }
      setUploading(false)
    }

    // Don't store a link_url when an image is attached — image takes priority
    const linkUrl = !imgUrl ? (extractUrl(txt) || null) : null

    await supabase.rpc('create_forum_post_v2', {
      p_content:   txt,
      p_is_anon:   isAnon,
      p_image_url: imgUrl,
      p_link_url:  linkUrl,
    })

    setContent(''); setIsAnon(false)
    removeImage(); setDetectedUrl(null)
    await load()
    setPosting(false)
  }

  function removePost(id) { setPosts(prev => prev.filter(p => p.id !== id)) }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Forum Diskusi</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Ruang diskusi bersama — semua kelas
        </p>
      </div>

      {/* Compose box */}
      <form className="fr-compose" onSubmit={submitPost}>
        <div className="fr-compose-label">Apa yang ada di pikiranmu?</div>
        <textarea
          className="fr-compose-input"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Tulis postingan… (URL video/link akan otomatis jadi preview)"
          rows={3}
        />

        {imagePreviewUrl && (
          <div className="fr-compose-attachment">
            <img src={imagePreviewUrl} alt="preview" className="fr-compose-img" />
            <button type="button" className="fr-compose-remove" onClick={removeImage}>×</button>
          </div>
        )}

        {!imageFile && detectedUrl && (
          <div className="fr-compose-link-preview">
            <LinkPreview url={detectedUrl} />
          </div>
        )}

        <div className="fr-compose-footer">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="fr-attach-btn"
              onClick={() => fileRef.current.click()}
              title="Lampirkan gambar (maks. 5 MB)"
            >
              📷
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            <label className="fr-anon-check">
              <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)} />
              Post sebagai Anonim
            </label>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '8px 20px', fontSize: 13 }}
            disabled={posting || (!content.trim() && !imageFile)}
          >
            {uploading ? 'Upload…' : posting ? 'Mengirim…' : 'Kirim'}
          </button>
        </div>
      </form>

      {/* Sort + count bar */}
      <div className="fr-bar">
        <button className={`fr-sort-btn${sort === 'hot' ? ' active' : ''}`} onClick={() => setSort('hot')}>
          🔥 Terpanas
        </button>
        <button className={`fr-sort-btn${sort === 'new' ? ' active' : ''}`} onClick={() => setSort('new')}>
          ⏰ Terbaru
        </button>
        <span style={{ flex: 1 }} />
        <button className="fr-sort-btn" onClick={load} title="Muat ulang">↺ Muat ulang</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{posts.length} postingan</span>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="empty-state"><p>Memuat forum…</p></div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="icon">💬</div>
          <p>Belum ada postingan. Jadilah yang pertama!</p>
        </div>
      ) : (
        <div className="fr-feed">
          {sorted.map(post => (
            <PostCard key={post.id} post={post} profile={profile} onDelete={removePost} />
          ))}
        </div>
      )}
    </div>
  )
}
