/**
 * CYBERVERSE — Backend Server
 * Node.js + Express + MongoDB
 * Run: node server.js  (default port 3000)
 */

const express    = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors       = require('cors');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME   = 'cyberverse';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // serve all HTML/CSS/JS/images

/* ─── DB connection ─── */
let db;
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log(`✅  MongoDB connected → ${MONGO_URI}/${DB_NAME}`);

    /* Ensure indexes */
    db.collection('users').createIndex({ email: 1 }, { unique: true });
    db.collection('users').createIndex({ totalScore: -1 });
  })
  .catch(err => { console.error('❌  MongoDB connection failed:', err.message); process.exit(1); });

/* ════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════ */

/**
 * POST /api/register
 * Body: { name, age, phone, email }
 * Returns: { user }
 */
app.post('/api/register', async (req, res) => {
  try {
    const { name, age, phone, email } = req.body;
    if (!name || !age || !phone || !email)
      return res.status(400).json({ error: 'All fields required' });

    const normalEmail = email.toLowerCase().trim();
    const existing = await db.collection('users').findOne({ email: normalEmail });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = {
      name, age, phone,
      email: normalEmail,
      sessions:   0,
      totalScore: 0,
      trustLevel: 100,        // 0–100 aggregate trust level
      securityHealth: 100,    // 0–100 aggregate security health
      badges: [],             // array of emoji strings
      riskProfile: 'UNASSESSED',
      modeStats: {            // per-mode aggregates
        mode1: { sessions:0, totalScore:0, totalHealth:0, totalTrust:0, badges:[] },
        mode2: { sessions:0, totalScore:0, totalHealth:0, totalTrust:0, badges:[] },
        mode3: { sessions:0, totalScore:0, totalHealth:0, totalTrust:0, badges:[] },
        mode4: { sessions:0, totalScore:0, totalHealth:0, totalTrust:0, badges:[] },
      },
      createdAt: Date.now()
    };

    const result = await db.collection('users').insertOne(user);
    user._id = result.insertedId;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/login
 * Body: { email }
 * Returns: { user }
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: 'No account found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════
   SAVE GAME SESSION  (called from ending.html)
   ════════════════════════════════════════════════ */

/**
 * POST /api/session
 * Body: {
 *   email,
 *   mode,         // 1|2|3|4
 *   score,        // pts earned this session
 *   health,       // 0-100 final health
 *   trust,        // 0-100 final trust
 *   good,         // correct choices
 *   bad,          // wrong choices
 *   badges        // array of emoji earned this session e.g. ['🛡','🏆']
 * }
 * Returns: { user }   ← full updated user doc
 */
app.post('/api/session', async (req, res) => {
  try {
    const { email, mode, score, health, trust, good, bad, badges } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const modeKey = `mode${mode || 1}`;

    /* ── Merge badges (no duplicates) ── */
    const allBadges = Array.from(new Set([...(user.badges || []), ...(badges || [])]));

    /* ── Per-mode stats ── */
    const oldMode = (user.modeStats || {})[modeKey] || { sessions:0, totalScore:0, totalHealth:0, totalTrust:0, badges:[] };
    const modeBadges = Array.from(new Set([...(oldMode.badges || []), ...(badges || [])]));
    const newModeStats = {
      ...oldMode,
      sessions:    oldMode.sessions + 1,
      totalScore:  oldMode.totalScore + Math.max(0, score || 0),
      totalHealth: oldMode.totalHealth + Math.max(0, health || 0),
      totalTrust:  oldMode.totalTrust  + Math.max(0, trust  || 0),
      badges:      modeBadges
    };

    /* ── Global aggregate health / trust ──
       Rolling average across ALL sessions:
       newAvg = ((oldAvg * oldSessions) + thisValue) / newSessions
    ── */
    const newSessions   = (user.sessions || 0) + 1;
    const newTotalScore = (user.totalScore || 0) + Math.max(0, score || 0);

    const newHealth = Math.round(
      (((user.securityHealth || 100) * (user.sessions || 0)) + Math.max(0, health || 0)) / newSessions
    );
    const newTrust = Math.round(
      (((user.trustLevel || 100) * (user.sessions || 0)) + Math.max(0, trust || 0)) / newSessions
    );

    /* ── AI Risk profile ── */
    const ratio = newTotalScore / Math.max(newSessions * 50, 1);
    const riskProfile = ratio > 6 ? 'LOW RISK' : ratio > 3 ? 'MODERATE RISK' : 'HIGH RISK';

    const patch = {
      sessions:       newSessions,
      totalScore:     newTotalScore,
      securityHealth: newHealth,
      trustLevel:     newTrust,
      badges:         allBadges,
      riskProfile,
      lastLevel:  mode,
      lastHealth: health,
      lastTrust:  trust,
      [`modeStats.${modeKey}`]: newModeStats
    };

    await db.collection('users').updateOne(
      { email: email.toLowerCase().trim() },
      { $set: patch }
    );

    const updated = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════
   GET USER
   ════════════════════════════════════════════════ */
app.get('/api/user/:email', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ email: req.params.email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════
   LEADERBOARD
   Returns top 100 users sorted by totalScore DESC
   ════════════════════════════════════════════════ */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await db.collection('users')
      .find({}, { projection: { name:1, email:1, totalScore:1, badges:1, sessions:1, riskProfile:1, securityHealth:1, trustLevel:1 } })
      .sort({ totalScore: -1 })
      .limit(100)
      .toArray();
    res.json({ leaderboard: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── start ─── */
app.listen(PORT, () => {
  console.log(`🚀  CYBERVERSE server running → http://localhost:${PORT}`);
  console.log(`    Open http://localhost:${PORT}/auth.html to play`);
});
