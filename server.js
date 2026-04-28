import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { randomUUID } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const { Pool } = pg
const __dir = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'hirehunt_dev_secret_replace_before_deploying'
const SUBREDDITS = 'forhire+jobs+hiring+freelance+remotework+jobsearchhacks'

app.use(express.json())

// ── Database ─────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_URL && { ssl: { rejectUnauthorized: false } }),
})

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT   PRIMARY KEY,
      name          TEXT   NOT NULL,
      email         TEXT   UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      created_at    BIGINT NOT NULL
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_jobs (
      id       TEXT   NOT NULL,
      user_id  TEXT   NOT NULL,
      job_data JSONB  NOT NULL,
      saved_at BIGINT NOT NULL,
      PRIMARY KEY (id, user_id)
    )
  `)
}

// ── Async route wrapper (Express 4 doesn't catch async throws) ──
const h = fn => (req, res, next) => fn(req, res, next).catch(next)

// ── Auth middleware ──────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Auth: register ───────────────────────────────────
app.post('/api/auth/register', h(async (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const id = randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1,$2,$3,$4,$5)',
      [id, name.trim(), email.toLowerCase(), passwordHash, Date.now()]
    )
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' })
    throw err
  }

  const token = jwt.sign(
    { id, email: email.toLowerCase(), name: name.trim() },
    JWT_SECRET, { expiresIn: '7d' }
  )
  res.status(201).json({ token, user: { id, name: name.trim(), email: email.toLowerCase() } })
}))

// ── Auth: login ──────────────────────────────────────
app.post('/api/auth/login', h(async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET, { expiresIn: '7d' }
  )
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
}))

// ── Auth: me ─────────────────────────────────────────
app.get('/api/auth/me', requireAuth, h(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email FROM users WHERE id = $1', [req.user.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json(rows[0])
}))

// ── Saved jobs ───────────────────────────────────────
app.get('/api/saved', requireAuth, h(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT job_data, saved_at FROM saved_jobs WHERE user_id = $1 ORDER BY saved_at DESC',
    [req.user.id]
  )
  res.json(rows.map(r => ({ ...r.job_data, savedAt: Number(r.saved_at) })))
}))

app.post('/api/saved', requireAuth, h(async (req, res) => {
  const job = req.body
  if (!job?.id) return res.status(400).json({ error: 'Invalid job data' })

  try {
    await pool.query(
      'INSERT INTO saved_jobs (id, user_id, job_data, saved_at) VALUES ($1,$2,$3,$4)',
      [job.id, req.user.id, JSON.stringify(job), Date.now()]
    )
    res.status(201).json({ success: true })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already saved' })
    throw err
  }
}))

app.delete('/api/saved/:id', requireAuth, h(async (req, res) => {
  await pool.query(
    'DELETE FROM saved_jobs WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  )
  res.json({ success: true })
}))

// ── Jobs search ──────────────────────────────────────
app.get('/api/jobs', h(async (req, res) => {
  const q = req.query.q || 'I am looking for'
  const sort = req.query.sort || 'new'
  const limit = Math.min(parseInt(req.query.limit) || 25, 50)

  const url =
    `https://www.reddit.com/r/${SUBREDDITS}/search.json` +
    `?q=${encodeURIComponent(q)}&restrict_sr=1&sort=${sort}&limit=${limit}&t=month`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'HireHunt/1.0 (job search aggregator)' },
  })

  if (response.status === 429) {
    return res.status(429).json({ error: 'Reddit rate limit reached — try again in a moment.' })
  }
  if (!response.ok) {
    return res.status(502).json({ error: `Reddit API returned ${response.status}` })
  }

  const data = await response.json()
  const posts = data.data.children
    .map(c => c.data)
    .filter(p => p.selftext !== '[deleted]' && p.selftext !== '[removed]')
    .map(p => ({
      id: p.id,
      title: p.title,
      selftext: p.selftext,
      author: p.author,
      subreddit: p.subreddit,
      score: p.score,
      num_comments: p.num_comments,
      permalink: p.permalink,
      created_utc: p.created_utc,
      url: p.url,
    }))

  res.json(posts)
}))

// ── Global error handler ─────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Serve built frontend (production) ────────────────
const distPath = join(__dir, 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')))
}

// ── Start ────────────────────────────────────────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`\n  HireHunt → http://localhost:${PORT}\n`)))
  .catch(err => { console.error('DB init failed:', err.message); process.exit(1) })
