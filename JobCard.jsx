function timeAgo(utc) {
  const s = Math.floor(Date.now() / 1000 - utc)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function JobCard({ job, isSaved, onSave, isLoggedIn }) {
  const preview = job.selftext?.trim()
  const clipped = preview ? preview.slice(0, 230) + (preview.length > 230 ? '…' : '') : null

  return (
    <article className="job-card">
      <div className="job-card-header">
        <span className="subreddit">r/{job.subreddit}</span>
        <span className="meta-pill">💬 {job.num_comments}</span>
        <span className="meta-time">{timeAgo(job.created_utc)}</span>
      </div>

      <h3 className="job-title">{job.title}</h3>

      {clipped && <p className="job-preview">{clipped}</p>}

      <div className="job-card-footer">
        <span className="author">u/{job.author}</span>
        <span className="score">▲ {job.score}</span>

        <div className="card-actions">
          <button
            className={`save-btn${isSaved ? ' saved' : ''}`}
            onClick={() => onSave(job)}
            title={!isLoggedIn ? 'Sign in to save jobs' : isSaved ? 'Remove bookmark' : 'Save job'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {isSaved ? 'Saved' : 'Save'}
          </button>

          <a
            href={`https://reddit.com${job.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="view-btn"
          >
            View on Reddit →
          </a>
        </div>
      </div>
    </article>
  )
}
