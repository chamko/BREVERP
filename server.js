'use strict';
// BrévERP – serveur du jeu pédagogique MGTAL43. Aucune dépendance externe.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { CATALOGUE, INJECTS, buildErpData, initialState } = require('./lib/seed');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'brevinel';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const RANSOM_PRICE = 80000;
const DURATIONS = { pra: 2, backup: 6, usb: 5, ransom: 4 }; // minutes

const ERP = buildErpData();
const byId = (list, id) => list.find((x) => x.id === id);

// --- État persistant ---------------------------------------------------------

let state = loadState();
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return initialState(); }
}

let saveTimer = null;
function writeState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state));
  fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 200);
}

const clients = new Set();
function changed(kind) {
  state.version++;
  save();
  const msg = `event: update\ndata: ${JSON.stringify({ v: state.version, kind })}\n\n`;
  for (const res of clients) res.write(msg);
}

function addHistory(team, kind, delta, reason) {
  state.history.unshift({ at: Date.now(), teamId: team.id, kind, delta, reason });
  state.history = state.history.slice(0, 300);
}

// --- Règles du jeu -----------------------------------------------------------

const jokers = (team) => new Set(team.purchases.map((p) => byId(CATALOGUE, p.itemId)?.joker).filter(Boolean));

// Fait avancer les restaurations arrivées à échéance. Renvoie true si quelque chose a changé.
function tickRestores() {
  let dirty = false;
  for (const team of state.teams) {
    const r = team.restore;
    if (!r.until || Date.now() < r.until) continue;
    if (r.status === 'restoring') {
      team.restore = { status: r.mode === 'usb' ? 'restored_old' : 'restored', mode: r.mode };
      dirty = true;
    } else if (r.status === 'decrypting') {
      team.restore = { status: r.success ? 'restored' : 'lost', mode: 'ransom' };
      dirty = true;
    }
  }
  return dirty;
}

// full | degraded | old | locked
function erpAccess(team) {
  if (!state.ransom.active) return 'full';
  const r = team.restore;
  if (r.status === 'restored') return 'full';
  if (r.status === 'restored_old') return 'old';
  if (r.status === 'restoring' && r.mode === 'pra') return 'degraded';
  return 'locked';
}

function froid(team) {
  const live = jokers(team).has('sondes');
  const jitter = () => Math.round((Math.random() - 0.5) * 4) / 10;
  if (!live) {
    return { mode: 'manuel', releve: 'Relevé manuel du jour – 07:42 (équipe du matin)', chambres: [
      { id: 'CF1', nom: 'Produits finis', temp: 3.2, alerte: false },
      { id: 'CF2', nom: 'Fromages frais', temp: 3.8, alerte: false },
      { id: 'CF3', nom: 'Matières premières', temp: 2.9, alerte: false },
    ] };
  }
  const cf2 = state.coldAlarm ? 9.1 + Math.random() * 0.6 : 3.8 + jitter();
  return { mode: 'live', releve: 'Sondes connectées – mise à jour en temps réel', chambres: [
    { id: 'CF1', nom: 'Produits finis', temp: +(3.2 + jitter()).toFixed(1), alerte: false },
    { id: 'CF2', nom: 'Fromages frais', temp: +cf2.toFixed(1), alerte: state.coldAlarm },
    { id: 'CF3', nom: 'Matières premières', temp: +(2.9 + jitter()).toFixed(1), alerte: false },
  ] };
}

function erpPayload(team) {
  const access = erpAccess(team);
  if (access === 'locked') return null;
  const old = access === 'old';
  const filesLocked = access === 'degraded';
  return {
    access,
    lots: old ? [] : ERP.lots,
    excelRows: old || filesLocked ? null : ERP.excelRows,
    producteurs: ERP.producteurs,
    camions: ERP.camions,
    fichiers: ERP.fichiers.map((f) => (filesLocked || (old && f.type === 'excel'))
      ? { nom: f.nom + '.locklait', taille: f.taille, modifie: '—', type: 'locked' }
      : f),
    froid: froid(team),
  };
}

function inbox(team) {
  return state.sent
    .filter((s) => s.to === 'all' || s.to.includes(team.id))
    .map((s) => ({ ...byId(INJECTS, s.id), at: s.at }))
    .sort((a, b) => b.at - a.at);
}

const publicTeam = (t) => ({
  id: t.id, name: t.name, color: t.color, confiance: t.confiance, budget: t.budget,
  purchases: t.purchases.length, jokers: [...jokers(t)], restore: t.restore.status,
});

function publicState() {
  return {
    v: state.version,
    teams: state.teams.map(publicTeam),
    timer: state.timer,
    ransom: state.ransom,
    coldAlarm: state.coldAlarm,
    lastInject: state.lastInject ? { ...byId(INJECTS, state.lastInject.id), at: state.lastInject.at } : null,
    now: Date.now(),
  };
}

function teamState(team) {
  return {
    team: { ...publicTeam(team), purchases: team.purchases, log: team.log, restore: team.restore },
    jokers: [...jokers(team)],
    access: erpAccess(team),
    ransom: state.ransom,
    ransomPrice: RANSOM_PRICE,
    shopOpen: state.shopOpen,
    catalogue: CATALOGUE,
    inbox: inbox(team),
    timer: state.timer,
    now: Date.now(),
  };
}

// --- Actions ------------------------------------------------------------------

const teamActions = {
  buy(team, { itemId }) {
    if (!state.shopOpen) throw httpError(409, 'La boutique est fermée pour le moment.');
    const item = byId(CATALOGUE, itemId);
    if (!item) throw httpError(404, 'Article inconnu.');
    if (team.purchases.some((p) => p.itemId === itemId)) throw httpError(409, 'Déjà acheté.');
    if (team.budget < item.price) throw httpError(409, 'Budget insuffisant.');
    team.budget -= item.price;
    team.purchases.push({ itemId, at: Date.now() });
    addHistory(team, 'budget', -item.price, `Achat : ${item.name}`);
    return 'buy';
  },
  log(team, { role, type, text }) {
    text = String(text || '').trim().slice(0, 1000);
    if (!text) throw httpError(400, 'Texte vide.');
    team.log.unshift({ at: Date.now(), role: String(role || '').slice(0, 40), type: String(type || 'info').slice(0, 20), text });
    return 'log';
  },
  restore(team, { mode }) {
    if (!state.ransom.active) throw httpError(409, "Il n'y a rien à restaurer.");
    if (!['none', 'lost'].includes(team.restore.status)) throw httpError(409, 'Une procédure est déjà en cours.');
    const j = jokers(team);
    if (mode === 'pra' && !j.has('pra')) throw httpError(403, "Vous n'avez pas de PRA.");
    if (mode === 'backup' && !j.has('backup')) throw httpError(403, "Vous n'avez pas de sauvegarde externalisée.");
    if (!['pra', 'backup', 'usb'].includes(mode)) throw httpError(400, 'Mode inconnu.');
    team.restore = { status: 'restoring', mode, until: Date.now() + DURATIONS[mode] * 60000 };
    return 'restore';
  },
  payRansom(team) {
    if (!state.ransom.active) throw httpError(409, 'Aucune rançon en cours.');
    if (team.restore.status !== 'none') throw httpError(409, 'Une procédure est déjà en cours.');
    if (team.budget < RANSOM_PRICE) throw httpError(409, 'Budget insuffisant pour payer.');
    team.budget -= RANSOM_PRICE;
    addHistory(team, 'budget', -RANSOM_PRICE, 'Rançon payée aux pirates');
    team.restore = { status: 'decrypting', mode: 'ransom', until: Date.now() + DURATIONS.ransom * 60000, success: Math.random() < 0.5 };
    return 'restore';
  },
};

const adminActions = {
  score({ teamId, delta, reason }) {
    const team = mustTeam(teamId);
    delta = Math.trunc(Number(delta) || 0);
    team.confiance = Math.max(0, Math.min(100, team.confiance + delta));
    addHistory(team, 'confiance', delta, String(reason || '').slice(0, 120));
    return 'score';
  },
  budget({ teamId, delta, reason }) {
    const team = mustTeam(teamId);
    delta = Math.trunc(Number(delta) || 0);
    team.budget += delta;
    addHistory(team, 'budget', delta, String(reason || 'Ajustement animateur').slice(0, 120));
    return 'budget';
  },
  team({ teamId, name, code, color }) {
    const team = mustTeam(teamId);
    if (name) team.name = String(name).slice(0, 40);
    if (code) team.code = String(code).toUpperCase().slice(0, 12);
    if (color) team.color = String(color).slice(0, 9);
    return 'team';
  },
  refund({ teamId, itemId }) {
    const team = mustTeam(teamId);
    const idx = team.purchases.findIndex((p) => p.itemId === itemId);
    if (idx < 0) throw httpError(404, 'Achat introuvable.');
    const item = byId(CATALOGUE, itemId);
    team.purchases.splice(idx, 1);
    team.budget += item.price;
    addHistory(team, 'budget', item.price, `Remboursement : ${item.name}`);
    return 'buy';
  },
  inject({ id, to }) {
    const inj = byId(INJECTS, id);
    if (!inj) throw httpError(404, 'Inject inconnu.');
    const at = Date.now();
    state.sent = state.sent.filter((s) => s.id !== id);
    state.sent.push({ id, at, to: Array.isArray(to) && to.length ? to : 'all' });
    state.lastInject = { id, at };
    if (inj.effect === 'ransom_on') setRansom(true);
    if (inj.effect === 'cold_on') state.coldAlarm = true;
    return 'inject';
  },
  unsend({ id }) {
    state.sent = state.sent.filter((s) => s.id !== id);
    if (state.lastInject?.id === id) state.lastInject = null;
    return 'inject';
  },
  ransom({ active }) { setRansom(!!active); return 'ransom'; },
  cold({ active }) { state.coldAlarm = !!active; return 'cold'; },
  shop({ open }) { state.shopOpen = !!open; return 'shop'; },
  timer({ minutes, label }) {
    const m = Number(minutes);
    state.timer = m > 0 ? { endsAt: Date.now() + m * 60000, label: String(label || '').slice(0, 60) } : null;
    return 'timer';
  },
  unlock({ teamId }) { mustTeam(teamId).restore = { status: 'restored', mode: 'admin' }; return 'restore'; },
  clearScreen() { state.lastInject = null; return 'inject'; },
  reset() { state = { ...initialState(), version: state.version }; return 'reset'; },
};

function setRansom(active) {
  state.ransom = { active, since: active ? Date.now() : null };
  if (active) for (const t of state.teams) t.restore = { status: 'none' };
}

function mustTeam(id) {
  const t = byId(state.teams, id);
  if (!t) throw httpError(404, 'Équipe inconnue.');
  return t;
}

// --- HTTP ---------------------------------------------------------------------

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(httpError(400, 'JSON invalide.')); } });
    req.on('error', reject);
  });
}

function authTeam(req) {
  const code = String(req.headers['x-team-code'] || '').toUpperCase();
  const team = code && state.teams.find((t) => t.code === code);
  if (!team) throw httpError(401, 'Code équipe invalide.');
  return team;
}

function authAdmin(req) {
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD) throw httpError(401, 'Mot de passe animateur invalide.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const PAGES = { '/': 'index.html', '/console': 'console.html', '/ecran': 'ecran.html' };

function serveStatic(req, res, pathname) {
  const rel = PAGES[pathname] || pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'Introuvable' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Introuvable' });
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    // Safari et iOS ne lisent un fichier audio que si le serveur répond aux requêtes partielles (Range).
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0;
    let end = st.size - 1;
    let status = 200;
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
  });
}

async function route(req, res) {
  const { pathname } = new URL(req.url, 'http://x');
  const method = req.method;

  if (pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: update\ndata: ${JSON.stringify({ v: state.version, kind: 'hello' })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (pathname === '/health') return send(res, 200, { ok: true });
  if (pathname === '/api/state' && method === 'GET') return send(res, 200, publicState());

  if (pathname === '/api/team/login' && method === 'POST') {
    const { code } = await readBody(req);
    const team = state.teams.find((t) => t.code === String(code || '').toUpperCase().trim());
    if (!team) throw httpError(401, 'Code équipe invalide.');
    return send(res, 200, { id: team.id, name: team.name, code: team.code });
  }
  if (pathname === '/api/team/me' && method === 'GET') return send(res, 200, teamState(authTeam(req)));
  if (pathname === '/api/team/erp' && method === 'GET') {
    const team = authTeam(req);
    const data = erpPayload(team);
    if (!data) return send(res, 423, { error: 'Données chiffrées par LockLait.' });
    return send(res, 200, data);
  }
  const teamMatch = pathname.match(/^\/api\/team\/(buy|log|restore|payRansom)$/);
  if (teamMatch && method === 'POST') {
    const team = authTeam(req);
    const kind = teamActions[teamMatch[1]](team, await readBody(req));
    changed(kind);
    return send(res, 200, teamState(team));
  }

  if (pathname === '/api/admin/state' && method === 'GET') {
    authAdmin(req);
    return send(res, 200, { ...state, catalogue: CATALOGUE, injects: INJECTS, now: Date.now() });
  }
  const adminMatch = pathname.match(/^\/api\/admin\/(\w+)$/);
  if (adminMatch && method === 'POST' && Object.hasOwn(adminActions, adminMatch[1])) {
    authAdmin(req);
    const kind = adminActions[adminMatch[1]](await readBody(req));
    changed(kind);
    return send(res, 200, { ok: true });
  }

  if ((method === 'GET' || method === 'HEAD') && !pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  send(res, 404, { error: 'Introuvable' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => send(res, err.status || 500, { error: err.status ? err.message : 'Erreur serveur' }));
});

setInterval(() => { if (tickRestores()) changed('restore'); }, 2000);
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

server.listen(PORT, () => console.log(`BrévERP en écoute sur http://localhost:${PORT}`));

// Arrêt propre (redéploiement Coolify / docker stop) : on écrit l'état tout de suite.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearTimeout(saveTimer);
    writeState();
    for (const res of clients) res.end();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
