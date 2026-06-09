import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

function fmtTime(str) {
  return new Date(str).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ForumPost({ post, profile, onDelete }) {
  const [open, setOpen]           = useState(false)
  const [comments, setComments]   = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingC, setLoadingC]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function loadComments() {
    setLoadingC(true)
    const { data } = await supabase.rpc('get_forum_comments', { p_post_id: post.id })
    setComments(data ?? [])
    setLoadingC(false)
  }

  function toggle() {
    if (!open) loadComments()
    setOpen(x => !x)
  }

  async function submitComment(e) {
    e.preventDefault()
    const txt = newComment.trim()
    if (!txt) return
    setSubmitting(true)
    await supabase.rpc('add_forum_comment', { p_post_id: post.id, p_content: txt })
    setNewComment('')
    await loadComments()
    setSubmitting(false)
  }

  async function deleteComment(id) {
    await supabase.rpc('delete_forum_comment', { p_id: id })
    setComments(prev => prev.filter(c => c.id !== id))
  }

  const initials = (post.author_name ?? post.author_npm ?? '?')[0].toUpperCase()

  return (
    <div className="forum-post">
      <div className="forum-post-header">
        <div className="forum-author-avatar">{initials}</div>
        <div className="forum-post-meta">
          <span className="forum-author">{post.author_name ?? post.author_npm}</span>
          <span className="forum-time">{fmtTime(post.created_at)}</span>
        </div>
        {(post.is_own || profile.is_admin) && (
          <button className="btn-sm btn-danger" onClick={() => onDelete(post.id)}>Hapus</button>
        )}
      </div>

      <div className="forum-post-content">{post.content}</div>

      <div className="forum-post-footer">
        <button className="forum-comment-toggle" onClick={toggle}>
          💬 {Number(post.comment_count)} komentar {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="forum-comments">
          {loadingC ? (
            <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>Memuat…</div>
          ) : (
            <>
              {comments.map(c => (
                <div key={c.id} className="forum-comment">
                  <div className="forum-comment-meta">
                    <span className="forum-author">{c.author_name ?? c.author_npm}</span>
                    <span className="forum-time">{fmtTime(c.created_at)}</span>
                    {(c.is_own || profile.is_admin) && (
                      <button
                        className="btn-sm btn-danger"
                        style={{ marginLeft: 'auto', padding: '2px 8px' }}
                        onClick={() => deleteComment(c.id)}
                      >×</button>
                    )}
                  </div>
                  <div className="forum-comment-content">{c.content}</div>
                </div>
              ))}
              <form className="forum-reply-form" onSubmit={submitComment}>
                <input
                  className="forum-reply-input"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Tulis komentar…"
                />
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '7px 16px', fontSize: 13 }}
                  disabled={submitting || !newComment.trim()}
                >
                  {submitting ? '…' : 'Kirim'}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ForumPage({ profile }) {
  const [posts, setPosts]               = useState([])
  const [loading, setLoading]           = useState(false)
  const [classes, setClasses]           = useState([])
  const [selectedClass, setSelectedClass] = useState(
    profile.is_admin ? '' : (profile.class ?? '')
  )
  const [newPost, setNewPost]           = useState('')
  const [posting, setPosting]           = useState(false)

  // Admin: fetch class list from students
  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => {
      const cls = [...new Set((data ?? []).map(s => s.class).filter(Boolean))].sort()
      setClasses(cls)
      if (!selectedClass && cls.length) setSelectedClass(cls[0])
    })
  }, [profile.is_admin])

  useEffect(() => {
    if (selectedClass) loadPosts()
    else setPosts([])
  }, [selectedClass])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase.rpc('get_forum_posts', { p_class: selectedClass })
    setPosts(data ?? [])
    setLoading(false)
  }

  async function submitPost(e) {
    e.preventDefault()
    const txt = newPost.trim()
    if (!txt || !selectedClass) return
    setPosting(true)
    await supabase.rpc('create_forum_post', { p_class: selectedClass, p_content: txt })
    setNewPost('')
    await loadPosts()
    setPosting(false)
  }

  async function deletePost(id) {
    await supabase.rpc('delete_forum_post', { p_id: id })
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Forum Diskusi</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {profile.is_admin
            ? 'Forum diskusi per kelas'
            : `Kelas ${selectedClass} — ruang diskusi bersama`}
        </p>
      </div>

      {profile.is_admin && classes.length > 0 && (
        <div className="class-tabs">
          {classes.map(cls => (
            <button
              key={cls}
              className={`class-tab${selectedClass === cls ? ' active' : ''}`}
              onClick={() => setSelectedClass(cls)}
            >{cls}</button>
          ))}
        </div>
      )}

      {selectedClass ? (
        <>
          <form className="forum-new-post" onSubmit={submitPost}>
            <textarea
              className="forum-new-post-input"
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              placeholder="Tulis sesuatu untuk kelas ini…"
              rows={3}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                style={{ width: 'auto', padding: '8px 20px', fontSize: 13 }}
                disabled={posting || !newPost.trim()}
              >
                {posting ? 'Mengirim…' : 'Kirim'}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="empty-state"><p>Memuat forum…</p></div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="icon">💬</div>
              <p>Belum ada postingan. Jadilah yang pertama!</p>
            </div>
          ) : (
            <div className="forum-posts-list">
              {posts.map(post => (
                <ForumPost key={post.id} post={post} profile={profile} onDelete={deletePost} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="icon">💬</div>
          <p>Pilih kelas untuk melihat forum.</p>
        </div>
      )}
    </div>
  )
}
