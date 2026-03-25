# CYBERVERSE — MongoDB Setup Guide

## Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

---

## 1. Install dependencies

```bash
cd CYBER_VERSE
npm install
```

## 2. Configure MongoDB

### Option A — Local MongoDB
MongoDB default connection is `mongodb://localhost:27017`.
Just run `mongod` and skip to Step 3.

### Option B — MongoDB Atlas (cloud)
Create a `.env` file in the `CYBER_VERSE` folder:

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
PORT=3000
```

Then add `dotenv` support at the top of `server.js`:
```js
require('dotenv').config();
```
And install: `npm install dotenv`

---

## 3. Start the server

```bash
node server.js
```

You should see:
```
✅  MongoDB connected → mongodb://localhost:27017/cyberverse
🚀  CYBERVERSE server running → http://localhost:3000
    Open http://localhost:3000/auth.html to play
```

---

## 4. Play the game

Open: **http://localhost:3000/auth.html**

---

## MongoDB Collections

### `users` collection
Each document stores:
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "age": 22,
  "phone": "9876543210",
  "sessions": 5,
  "totalScore": 1250,
  "trustLevel": 78,
  "securityHealth": 82,
  "badges": ["🛡", "🏆", "🔍"],
  "riskProfile": "LOW RISK",
  "modeStats": {
    "mode1": { "sessions": 2, "totalScore": 400, "totalHealth": 180, "totalTrust": 190, "badges": ["🛡"] },
    "mode2": { "sessions": 1, "totalScore": 300, "totalHealth": 90,  "totalTrust": 85,  "badges": ["🔍"] },
    "mode3": { "sessions": 1, "totalScore": 350, "totalHealth": 95,  "totalTrust": 90,  "badges": ["🤖"] },
    "mode4": { "sessions": 1, "totalScore": 200, "totalHealth": 80,  "totalTrust": 70,  "badges": ["📱"] }
  },
  "createdAt": 1711234567890
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login by email |
| GET | `/api/user/:email` | Get user by email |
| POST | `/api/session` | Save game session (updates scores/health/trust/badges) |
| GET | `/api/leaderboard` | Fetch top 100 players sorted by score |

---

## How scores / health / trust update

After every completed level, `ending.html` calls `POST /api/session` with:
- `mode` — which mode was played (1–4)
- `score` — points earned this session
- `health` — final security health (0–100)
- `trust` — final trust level (0–100)
- `badges` — array of badge emojis earned
- `good` / `bad` — correct / wrong decisions

The server:
1. Merges new badges into the user's badge list (no duplicates)
2. Computes a **rolling average** of health and trust across all sessions
3. Recomputes the **AI risk profile** (LOW / MODERATE / HIGH)
4. Updates per-mode stats in `modeStats`
5. Returns the fully updated user document

The dashboard fetches the latest data from MongoDB on every load.
