import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

function fmtRelTime(str) {
  const s = (Date.now() - new Date(str).getTime()) / 1000
  if (s < 60)      return 'baru saja'
  if (s < 3600)    return `${Math.floor(s / 60)} mnt lalu`
  if (s < 86400)   return `${Math.floor(s / 3600)} jam lalu`
  if (s < 2592000) return `${Math.floor(s / 86400)} hari lalu`
  return new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
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
  const [score, setScore]     = useState(reply.vote_sum ?? 0)
  const [myVote, setMyVote]   = useState(reply.my_vote ?? null)
  const [voting, setVoting]   = useState(false)

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
      <VoteBar score={score} myVote={myVote} onVote={vote} compact />
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────
function PostCard({ post, profile, onDelete }) {
  const [score, setScore]           = useState(post.vote_sum ?? 0)
  const [myVote, setMyVote]         = useState(post.my_vote ?? null)
  const [replyCount, setReplyCount] = useState(post.reply_count ?? 0)
  const [replies, setReplies]       = useState([])
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [loadingR, setLoadingR]     = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [replyText, setReplyText]   = useState('')
  const [replyAnon, setReplyAnon]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting]         = useState(false)
  const textareaRef                 = useRef()

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
    await supabase.rpc('create_forum_post_v2', {
      p_content: txt, p_is_anon: replyAnon, p_parent_id: post.id,
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
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [sort, setSort]         = useState('hot')
  const [content, setContent]   = useState('')
  const [isAnon, setIsAnon]     = useState(false)
  const [posting, setPosting]   = useState(false)

  useEffect(() => { load() }, [])

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

  async function submitPost(e) {
    e.preventDefault()
    const txt = content.trim(); if (!txt) return
    setPosting(true)
    await supabase.rpc('create_forum_post_v2', { p_content: txt, p_is_anon: isAnon })
    setContent(''); setIsAnon(false)
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
          placeholder="Tulis postingan…"
          rows={3}
        />
        <div className="fr-compose-footer">
          <label className="fr-anon-check">
            <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)} />
            Post sebagai Anonim
          </label>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '8px 20px', fontSize: 13 }}
            disabled={posting || !content.trim()}
          >
            {posting ? 'Mengirim…' : 'Kirim'}
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
