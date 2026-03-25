/* ═══════════════════════════════════════════════════
   CYBERVERSE — shared.js  (MongoDB edition)
   Loaded by every page. Handles: theme, font size,
   high contrast, DB (API + localStorage cache),
   AI engine, navigation.
═══════════════════════════════════════════════════ */

/* ── API BASE URL
   In production replace with your actual server URL.
   When running locally with server.js this is correct. ── */
const API_BASE = window.location.origin;

/* ════════════════════════════════════════════════
   DATABASE LAYER
   All persistent state lives in MongoDB (via the
   Express API).  localStorage is used ONLY as a
   session-level cache for the current user object
   so pages can work offline between API calls.
   ════════════════════════════════════════════════ */
const DB = {

  /* ── cache helpers ── */
  _cache(u)   { localStorage.setItem('cv_current', JSON.stringify(u)); },
  _clearCache(){ localStorage.removeItem('cv_current'); },
  _cached()   { try{ return JSON.parse(localStorage.getItem('cv_current')||'null'); }catch(e){return null;} },

  getCurrent()  { return this._cached(); },
  setCurrent(u) { this._cache(u); },
  clearCurrent(){ this._clearCache(); },

  findByEmail(email){
    const u = this._cached();
    return u && u.email === email.toLowerCase().trim() ? u : null;
  },

  /* ── ASYNC API CALLS ── */

  async register({ name, age, phone, email }){
    const res  = await fetch(API_BASE + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age, phone, email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data.user;
  },

  async login(email){
    const res  = await fetch(API_BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data.user;
  },

  async refresh(email){
    try {
      const res  = await fetch(API_BASE + '/api/user/' + encodeURIComponent(email));
      if (!res.ok) return null;
      const data = await res.json();
      this._cache(data.user);
      return data.user;
    } catch(e){ return null; }
  },

  async saveSession({ email, mode, score, health, trust, good, bad, badges }){
    const res  = await fetch(API_BASE + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mode, score, health, trust, good, bad, badges })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    this._cache(data.user);
    return data.user;
  },

  async leaderboard(){
    const res  = await fetch(API_BASE + '/api/leaderboard');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Leaderboard fetch failed');
    return data.leaderboard;
  }
};

/* ════════════════════════════════════════════════
   AI ENGINE
   ════════════════════════════════════════════════ */
const AI = {
  riskProfile(user){
    if(!user||user.sessions===0)
      return {label:'UNASSESSED',color:'var(--muted)',text:'No gameplay data yet. Complete at least one simulation run to receive your AI-generated behavioural risk assessment.'};
    const ratio = user.totalScore / Math.max(user.sessions*50,1);
    if(ratio>6) return {label:'LOW RISK',   color:'var(--green)', text:'Strong threat-detection patterns observed. You consistently verify before acting and recognise urgency manipulation.'};
    if(ratio>3) return {label:'MODERATE RISK',color:'var(--amber)',text:'You identify most threats but show occasional susceptibility to authority-based social engineering and time-pressure tactics.'};
    return {label:'HIGH RISK',color:'var(--red)',text:'Multiple high-risk decisions detected. You are statistically vulnerable to phishing and voice-cloning attacks. Replay Level 1 and Level 3 before real-world exposure.'};
  },
  recommend(user){
    if(!user||user.sessions===0) return 'Starting with Level 1 is recommended for all new players regardless of background.';
    const score=user.totalScore/Math.max(user.sessions,1);
    if(score>55) return `Strong performance detected (avg ${score.toFixed(0)} pts/session). AI engine recommends Level 3 — Deepfake SOS for maximum challenge.`;
    if(score>30) return `Moderate performance (avg ${score.toFixed(0)} pts/session). AI engine recommends Level 2 — QR Trap Hunt to build on your foundation.`;
    return `Lower performance patterns detected (avg ${score.toFixed(0)} pts/session). AI engine recommends replaying Level 1 to reinforce threat recognition fundamentals.`;
  },
  postGame(good,bad,health,score){
    const acc=good/Math.max(good+bad,1);
    if(acc>=0.75) return `Accuracy: ${(acc*100).toFixed(0)}% — Excellent decision-making under simulated pressure. AI model projects a ${Math.round(acc*60+20)}% reduction in real-world phishing susceptibility after this session.`;
    if(acc>=0.5)  return `Accuracy: ${(acc*100).toFixed(0)}% — Adequate performance. ${bad} decision(s) created exploitable vulnerabilities. Your weak point: time-pressure scenarios.`;
    return `Accuracy: ${(acc*100).toFixed(0)}% — High-risk profile confirmed. ${bad} poor decision(s) recorded. AI model flags your response to urgency-based manipulation as a critical vulnerability.`;
  }
};

/* ════════════════════════════════════════════════
   THEME
   ════════════════════════════════════════════════ */
function applyTheme(){
  const t=localStorage.getItem('cv_theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent=t==='dark'?'🌙':'🌞';
}
function toggleTheme(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme',isDark?'light':'dark');
  localStorage.setItem('cv_theme',isDark?'light':'dark');
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent=isDark?'🌞':'🌙';
}

/* ════════════════════════════════════════════════
   FONT SIZE
   ════════════════════════════════════════════════ */
function applyFont(){
  const fs=localStorage.getItem('cv_fontsize')||'sm';
  if(fs&&fs!=='sm') document.documentElement.setAttribute('data-fontsize',fs);
  document.querySelectorAll('.a11y-btn[data-action^="font"]').forEach(b=>{
    b.classList.toggle('active',b.getAttribute('data-action')==='font-'+fs);
  });
}
function setFont(size){
  if(size==='sm') document.documentElement.removeAttribute('data-fontsize');
  else document.documentElement.setAttribute('data-fontsize',size);
  localStorage.setItem('cv_fontsize',size);
  document.querySelectorAll('.a11y-btn[data-action^="font"]').forEach(b=>{
    b.classList.toggle('active',b.getAttribute('data-action')==='font-'+size);
  });
}

/* ════════════════════════════════════════════════
   HIGH CONTRAST
   ════════════════════════════════════════════════ */
function applyContrast(){
  if(localStorage.getItem('cv_contrast')==='high'){
    document.documentElement.setAttribute('data-contrast','high');
    const btn=document.querySelector('.a11y-btn[data-action="contrast"]');
    if(btn) btn.classList.add('active');
  }
}
function toggleContrast(){
  const on=document.documentElement.hasAttribute('data-contrast');
  if(on){ document.documentElement.removeAttribute('data-contrast'); localStorage.removeItem('cv_contrast'); }
  else  { document.documentElement.setAttribute('data-contrast','high'); localStorage.setItem('cv_contrast','high'); }
  const btn=document.querySelector('.a11y-btn[data-action="contrast"]');
  if(btn) btn.classList.toggle('active',!on);
}

/* ════════════════════════════════════════════════
   KEYBOARD HELP MODAL
   ════════════════════════════════════════════════ */
function showKbdHelp(){
  const existing=document.getElementById('kbd-modal');
  if(existing){existing.remove();return;}
  const modal=document.createElement('div');
  modal.id='kbd-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-label','Keyboard shortcuts');
  modal.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--rim);border-radius:10px;max-width:420px;width:100%;box-shadow:var(--shadow);">
      <div style="padding:18px 22px;border-bottom:1px solid var(--rim);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.18em;color:var(--accent);">⌨ KEYBOARD SHORTCUTS</div>
        <button onclick="document.getElementById('kbd-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;" aria-label="Close">✕</button>
      </div>
      <div style="padding:20px 22px;">
        ${[['1–4','Select choice during gameplay'],['Tab','Move between interactive elements'],['Enter / Space','Activate focused button'],['Escape','Close this modal']].map(([k,v])=>`
          <div style="display:flex;align-items:center;gap:14px;padding:8px 0;border-bottom:1px solid var(--rim);">
            <kbd style="font-family:var(--font-mono);font-size:0.72rem;background:var(--rim);color:var(--hi);padding:4px 10px;border-radius:4px;min-width:70px;text-align:center;">${k}</kbd>
            <span style="font-size:0.86rem;color:var(--body);">${v}</span>
          </div>`).join('')}
      </div>
    </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){modal.remove();document.removeEventListener('keydown',esc);}});
  document.body.appendChild(modal);
  modal.querySelector('button').focus();
}

/* ════════════════════════════════════════════════
   SCREEN READER LIVE ANNOUNCE
   ════════════════════════════════════════════════ */
function announceToSR(msg){
  let live=document.getElementById('sr-live');
  if(!live){
    live=document.createElement('div');live.id='sr-live';
    live.setAttribute('aria-live','assertive');live.setAttribute('aria-atomic','true');
    live.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
    document.body.appendChild(live);
  }
  live.textContent='';setTimeout(()=>{live.textContent=msg;},50);
}

/* ── APPLY ALL PREFS on load ── */
document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(); applyFont(); applyContrast();
});
