'use strict';
// BrévERP – interface équipes.

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const hhmm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const ERP_VIEWS = ['lots', 'collecte', 'froid', 'fichiers'];
const ROLES = ['DG', 'DAF', 'DSI', 'RSSI', 'DPO', 'Responsable QSE'];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* navigation privée */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

// Connexion directe par lien ou QR code : /?code=CAMB
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) { store.set('brevinel.code', urlCode.toUpperCase()); history.replaceState(null, '', location.pathname); }
let code = urlCode ? urlCode.toUpperCase() : store.get('brevinel.code');
let me = null;
let erp = null;
let view = 'accueil';
let selectedLot = null;
let openFile = null;
let clockOffset = 0;
const seen = new Set(JSON.parse(store.get('brevinel.seen') || '[]'));

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-team-code': code || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur'), { status: res.status });
  return data;
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// --- Connexion ----------------------------------------------------------------

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('/api/team/login', { code: $('#login-code').value });
    code = r.code;
    store.set('brevinel.code', code);
    start();
  } catch (err) { $('#login-error').textContent = err.message; }
});

$('#logout').addEventListener('click', () => { store.del('brevinel.code'); location.reload(); });

function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }

async function start() {
  try { await refresh(); } catch (err) {
    if (err.status === 401) { store.del('brevinel.code'); return showLogin(); }
    throw err;
  }
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const es = new EventSource('/events');
  es.addEventListener('update', () => refresh().catch(() => {}));
  setInterval(tick, 1000);
  setInterval(() => { if (view === 'froid' && erp?.froid.mode === 'live') loadErp().then(render); }, 5000);
}

// --- Données ------------------------------------------------------------------

async function refresh() {
  me = await api('/api/team/me');
  clockOffset = me.now - Date.now();
  if (ERP_VIEWS.includes(view)) await loadErp();
  renderHeader();
  renderRansom();
  render();
}

async function loadErp() {
  if (me.access === 'locked') { erp = null; return; }
  try { erp = await api('/api/team/erp'); } catch (err) { if (err.status === 423) erp = null; else throw err; }
}

const now = () => Date.now() + clockOffset;
function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function tick() {
  const t = me?.timer;
  const el = $('#timer');
  if (t && t.endsAt > now()) { el.classList.remove('hidden'); el.textContent = `⏱ ${t.label ? t.label + ' ' : ''}${mmss(t.endsAt - now())}`; } else el.classList.add('hidden');
  if (me?.ransom.active) {
    const left = me.ransom.since + 72 * 3600000 - now();
    const h = Math.floor(left / 3600000);
    $('#ransom-countdown').textContent = `${h}h ${mmss(left - h * 3600000)}`;
    const r = me.team.restore;
    if (r.until) $('#ransom-status-time') && ($('#ransom-status-time').textContent = mmss(r.until - now()));
  }
}

// --- Bandeau et rançon --------------------------------------------------------

function renderHeader() {
  const t = me.team;
  $('#team-name').textContent = t.name;
  $('#team-dot').style.background = t.color;
  $('#team-budget').textContent = eur(t.budget);
  $('#team-confiance').textContent = `${t.confiance}/100`;
  const unseen = me.inbox.filter((m) => !seen.has(m.id + m.at)).length;
  $('#badge').textContent = unseen;
  $('#badge').classList.toggle('hidden', !unseen);
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  tick();
}

function renderRansom() {
  const locked = me.access === 'locked';
  $('#ransom').classList.toggle('hidden', !(locked && ERP_VIEWS.includes(view)));
  if (!me.ransom.active) return;
  $('#ransom-price').textContent = eur(me.ransomPrice);
  const r = me.team.restore;
  const j = new Set(me.jokers);
  const labels = {
    pra: 'Activation du PRA : mode dégradé disponible, restauration complète dans',
    backup: 'Restauration de la sauvegarde externalisée… fin dans',
    usb: 'Restauration du disque USB de Karim… fin dans',
  };
  let status = '';
  if (r.status === 'restoring') status = `⏳ ${labels[r.mode]} <b id="ransom-status-time"></b>`;
  if (r.status === 'decrypting') status = '⏳ Rançon payée. Les pirates envoient la clé… <b id="ransom-status-time"></b>';
  if (r.status === 'lost') status = '💀 La clé fournie par les pirates ne fonctionne pas. Les données sont perdues et les 80 000 € aussi.';
  $('#ransom-status').innerHTML = status;

  const can = r.status === 'none' || r.status === 'lost';
  const actions = [];
  if (j.has('pra')) actions.push(['pra', '🛟 Déclencher le PRA (mode dégradé immédiat, retour complet en 2 min)']);
  if (j.has('backup')) actions.push(['backup', '💾 Restaurer la sauvegarde externalisée 3-2-1 (6 min)']);
  actions.push(['usb', '🔌 Restaurer le disque USB de Karim (5 min)']);
  if (r.status === 'none') actions.push(['pay', `💸 Payer la rançon (${eur(me.ransomPrice)})`]);
  $('#ransom-actions').innerHTML = actions.map(([k, l]) => `<button data-restore="${k}" ${can ? '' : 'disabled'}>${l}</button>`).join('');
  tick();
}

$('#ransom').addEventListener('click', async (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) return go(goto.dataset.goto);
  const btn = e.target.closest('[data-restore]');
  if (!btn) return;
  const mode = btn.dataset.restore;
  const confirmText = mode === 'pay'
    ? 'Payer 80 000 € aux pirates ? Rien ne garantit qu\'ils tiendront parole. Décision à noter dans la main courante.'
    : 'Lancer cette procédure de restauration ?';
  if (!confirm(confirmText)) return;
  try {
    me = mode === 'pay' ? await api('/api/team/payRansom', {}) : await api('/api/team/restore', { mode });
    renderHeader(); renderRansom();
  } catch (err) { toast(err.message); }
});

// --- Navigation ---------------------------------------------------------------

$('#nav').addEventListener('click', (e) => { const a = e.target.closest('a[data-view]'); if (a) go(a.dataset.view); });

async function go(v) {
  view = v; selectedLot = null; openFile = null;
  if (ERP_VIEWS.includes(v)) await loadErp();
  renderHeader(); renderRansom(); render(true);
  window.scrollTo(0, 0);
}

function render(force) {
  // Ne pas redessiner pendant la saisie dans la main courante.
  const active = document.activeElement;
  if (!force && view === 'courante' && active?.form?.id === 'log-form' && active.value) return;
  const html = { accueil, messages, lots, collecte, froid, fichiers, boutique, courante }[view]();
  $('#view').innerHTML = html;
  if (view === 'messages') markSeen();
}

function accessBanner() {
  if (!erp) return '';
  if (erp.access === 'degraded') return '<div class="banner warn">🛟 <b>Mode dégradé (PRA)</b> : ERP en lecture seule, fichiers partagés en cours de restauration.</div>';
  if (erp.access === 'old') return '<div class="banner bad">🔌 Données restaurées depuis le disque USB de Karim : <b>sauvegarde d\'il y a 3 semaines</b>. Aucun lot d\'octobre n\'existe dans cette sauvegarde.</div>';
  return '';
}

// --- Vues ---------------------------------------------------------------------

function accueil() {
  const t = me.team;
  return `
    <h2>Bienvenue, équipe ${esc(t.name)}</h2>
    <div class="banner warn">⚠ Dernière sauvegarde du serveur : <b>inconnue</b> · Responsable informatique : <b>Karim Benali (préavis en cours)</b></div>
    <div class="grid">
      <div class="card"><div class="muted">Production d'hier</div><div class="kpi">38 200 pots</div></div>
      <div class="card"><div class="muted">Lait collecté hier</div><div class="kpi">92 400 L</div></div>
      <div class="card"><div class="muted">Taux de service GMS</div><div class="kpi">97,1 %</div></div>
      <div class="card"><div class="muted">Votre budget restant</div><div class="kpi">${eur(t.budget)}</div></div>
    </div>
    <div class="card">
      <b>Votre mission</b>
      <p>Hélène Marchal, PDG, vous confie la reprise en main du système d'information de la Laiterie Brévinel.
      Explorez l'ERP, repérez les failles, dépensez votre budget avec discernement et tenez votre main courante à jour.</p>
      <p class="small muted">Jokers actifs : ${me.jokers.length ? me.jokers.map((j) => `<span class="tag">${esc(j)}</span>`).join(' ') : 'aucun'}</p>
    </div>`;
}

function messages() {
  if (!me.inbox.length) return '<h2>Messagerie</h2><p class="muted">Aucun message pour le moment.</p>';
  return `<h2>Messagerie <small class="muted">(Microsoft 365)</small></h2>` + me.inbox.map((m, i) => `
    <details class="msg ${seen.has(m.id + m.at) ? '' : 'new'}" ${i === 0 ? 'open' : ''}>
      <summary><b>${esc(m.subject)}</b><span>${esc(m.from)}</span><span class="muted">${hhmm(m.at)}</span></summary>
      ${m.audio ? `<audio controls preload="none" src="audio/${esc(m.audio)}"></audio>` : ''}
      <div class="body">${esc(m.body)}</div>
    </details>`).join('');
}

function markSeen() {
  me.inbox.forEach((m) => seen.add(m.id + m.at));
  store.set('brevinel.seen', JSON.stringify([...seen]));
  setTimeout(renderHeader, 1500);
}

const prodName = (id) => erp.producteurs.find((p) => p.id === id)?.nom || id;

function lots() {
  if (!erp) return '<h2>Traçabilité lots</h2>';
  if (selectedLot) return lotDetail(erp.lots.find((l) => l.code === selectedLot));
  return `
    <h2>Traçabilité lots</h2>${accessBanner()}
    <label>Rechercher un lot ou un produit <input id="lot-search" placeholder="ex : L0610-B" value="${esc(lots.q || '')}"></label>
    <div class="table-wrap"><table>
      <tr><th>Lot</th><th>Produit</th><th>Production</th><th>DLC</th><th>Quantité</th><th>Statut labo</th></tr>
      ${erp.lots.filter((l) => !lots.q || (l.code + l.produit).toLowerCase().includes(lots.q.toLowerCase())).map((l) => `
        <tr class="clickable" data-lot="${esc(l.code)}"><td><b>${esc(l.code)}</b></td><td>${esc(l.produit)}</td><td>${l.dateProduction}</td>
        <td>${l.dlc}</td><td>${l.quantite.toLocaleString('fr-FR')}</td><td>${esc(l.statutLabo)}</td></tr>`).join('') || '<tr><td colspan="6">Aucun lot.</td></tr>'}
    </table></div>`;
}

function lotDetail(l) {
  const shipped = l.expeditions.reduce((s, e) => s + e.quantite, 0);
  return `
    <p><button data-action="back">← Retour</button></p>
    <h2>Lot ${esc(l.code)} – ${esc(l.produit)}</h2>${accessBanner()}
    <div class="grid">
      <div class="card"><div class="muted">Production</div><b>${l.dateProduction}</b> · DLC ${l.dlc}</div>
      <div class="card"><div class="muted">Quantité produite</div><b>${l.quantite.toLocaleString('fr-FR')} unités</b></div>
      <div class="card"><div class="muted">Statut labo</div><b>${esc(l.statutLabo)}</b></div>
    </div>
    <div class="card"><b>Amont : origine du lait</b>
      <p>Citerne <b>${esc(l.citerne)}</b>, collecte du ${l.dateCollecte}</p>
      <p class="small">${l.origine.map((id) => `${esc(id)} – ${esc(prodName(id))}`).join(' · ')}</p></div>
    <b>Aval : expéditions enregistrées dans l'ERP</b>
    <div class="table-wrap"><table>
      <tr><th>Client</th><th>Quantité</th><th>Date</th><th>BL</th></tr>
      ${l.expeditions.map((e) => `<tr><td>${esc(e.client)}</td><td>${e.quantite.toLocaleString('fr-FR')}</td><td>${e.date}</td><td>${esc(e.bl)}</td></tr>`).join('') || '<tr><td colspan="4">Aucune expédition.</td></tr>'}
    </table></div>
    <p class="small">Total expédié dans l'ERP : <b>${shipped.toLocaleString('fr-FR')}</b> / ${l.quantite.toLocaleString('fr-FR')} unités.</p>
    ${l.excel ? '<div class="banner warn">⚠ Note de Karim : « certaines expéditions de la semaine 41 sont saisies dans <b>Expeditions_S41_v3_FINAL.xlsx</b> (Fichiers partagés), l\'ERP plantait ».</div>' : ''}`;
}

function collecte() {
  if (!erp) return '<h2>Collecte lait</h2>';
  return `
    <h2>Collecte lait</h2>${accessBanner()}
    <div class="banner warn">ℹ Module accessible à <b>tous les utilisateurs</b> de BrévERP (140 comptes).</div>
    <b>Producteurs</b>
    <div class="table-wrap"><table>
      <tr><th>Code</th><th>Exploitation</th><th>Commune</th><th>Téléphone</th><th>IBAN</th><th>Volume moyen (L/j)</th></tr>
      ${erp.producteurs.map((p) => `<tr><td>${p.id}</td><td>${esc(p.nom)}</td><td>${esc(p.commune)}</td><td>${p.telephone}</td><td>${p.iban}</td><td>${p.volumeMoyen.toLocaleString('fr-FR')}</td></tr>`).join('')}
    </table></div>
    <b>Géolocalisation des camions-citernes</b> <span class="small muted">(enregistrement continu 24h/24, conservation illimitée)</span>
    <div class="table-wrap"><table>
      <tr><th>Camion</th><th>Chauffeur</th><th>Horodatage</th><th>Position</th></tr>
      ${erp.camions.flatMap((c) => c.historique.map((h, i) => `<tr><td>${i ? '' : c.id}</td><td>${i ? '' : esc(c.chauffeur)}</td><td>${h.quand}</td><td>${esc(h.lieu)}</td></tr>`)).join('')}
    </table></div>`;
}

function froid() {
  if (!erp) return '<h2>Chambres froides</h2>';
  const f = erp.froid;
  return `
    <h2>Chambres froides</h2>${accessBanner()}
    <div class="banner ${f.mode === 'live' ? 'ok' : 'warn'}">${esc(f.releve)}</div>
    <div class="grid">${f.chambres.map((c) => `
      <div class="card cold ${c.alerte ? 'alert' : ''}"><div class="muted">${c.id} – ${esc(c.nom)}</div>
      <div class="temp">${String(c.temp).replace('.', ',')} °C</div><div class="small">Consigne : 0 à +4 °C</div>
      ${c.alerte ? '<b>🚨 ALERTE TEMPÉRATURE</b>' : ''}</div>`).join('')}</div>
    ${f.mode === 'manuel' ? '<p class="small muted">Les relevés sont saisis à la main deux fois par jour (7h et 19h).</p>' : ''}`;
}

function fichiers() {
  if (!erp) return '<h2>Fichiers partagés</h2>';
  if (openFile) {
    const f = erp.fichiers.find((x) => x.nom === openFile);
    const content = f.type === 'excel'
      ? `<div class="table-wrap"><table><tr><th>Lot</th><th>Client</th><th>Quantité</th><th>Date</th><th>Saisi par</th></tr>
          ${erp.excelRows.map((r) => `<tr><td>${r.lot}</td><td>${esc(r.client)}</td><td>${r.quantite.toLocaleString('fr-FR')}</td><td>${r.date}</td><td>${esc(r.saisiPar)}</td></tr>`).join('')}
        </table></div>`
      : `<pre class="file">${esc(f.contenu)}</pre>`;
    return `<p><button data-action="close-file">← Retour</button></p><h2>📄 ${esc(f.nom)}</h2>${content}`;
  }
  return `
    <h2>Fichiers partagés <small class="muted">(\\\\SRV-BREVINEL\\Commun)</small></h2>${accessBanner()}
    <div class="table-wrap"><table>
      <tr><th>Nom</th><th>Taille</th><th>Modifié le</th></tr>
      ${erp.fichiers.map((f) => `<tr class="${f.type === 'locked' ? '' : 'clickable'}" data-file="${f.type === 'locked' ? '' : esc(f.nom)}">
        <td>${f.type === 'locked' ? '🔒' : '📄'} ${esc(f.nom)}</td><td>${f.taille}</td><td>${f.modifie}</td></tr>`).join('')}
    </table></div>`;
}

function boutique() {
  const owned = new Set(me.team.purchases.map((p) => p.itemId));
  const cats = [...new Set(me.catalogue.map((i) => i.cat))];
  return `
    <h2>Achats &amp; budget</h2>
    <div class="banner ${me.shopOpen ? 'ok' : 'warn'}">Budget restant : <b>${eur(me.team.budget)}</b> · ${me.shopOpen ? 'Les achats sont ouverts.' : 'Les achats sont fermés pour le moment.'}</div>
    ${cats.map((cat) => `<h3>${esc(cat)}</h3><div class="grid">${me.catalogue.filter((i) => i.cat === cat).map((i) => `
      <div class="card shop-item ${owned.has(i.id) ? 'owned' : ''}">
        <b>${esc(i.name)}</b><span class="small">${esc(i.desc)}</span>
        <span class="price">${eur(i.price)}</span>
        ${owned.has(i.id) ? '<span>✅ Acquis</span>' : `<button data-buy="${i.id}" ${me.shopOpen && me.team.budget >= i.price ? '' : 'disabled'}>Acheter</button>`}
      </div>`).join('')}</div>`).join('')}`;
}

function courante() {
  const log = me.team.log;
  return `
    <h2>Main courante</h2>
    <form id="log-form" class="card">
      <div class="row">
        <label>Rôle<select name="role">${ROLES.map((r) => `<option>${r}</option>`).join('')}</select></label>
        <label>Type<select name="type"><option value="info">Information</option><option value="decision">Décision</option><option value="action">Action</option><option value="communication">Communication</option></select></label>
      </div>
      <label>Entrée<textarea name="text" rows="3" required placeholder="ex : 14h12 – Décision : on ne paie pas la rançon, on lance la restauration…"></textarea></label>
      <button class="primary" type="submit">Enregistrer</button>
    </form>
    ${log.map((e) => `<div class="log-entry ${esc(e.type)}"><div class="meta">${hhmm(e.at)} · ${esc(e.role)} · ${esc(e.type)}</div>${esc(e.text)}</div>`).join('') || '<p class="muted">Aucune entrée.</p>'}`;
}

// --- Événements de la zone principale ----------------------------------------------

$('#view').addEventListener('click', async (e) => {
  const lot = e.target.closest('[data-lot]');
  if (lot) { selectedLot = lot.dataset.lot; return render(); }
  const file = e.target.closest('[data-file]');
  if (file && file.dataset.file) { openFile = file.dataset.file; return render(); }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'back') { selectedLot = null; return render(); }
  if (action === 'close-file') { openFile = null; return render(); }
  const buy = e.target.closest('[data-buy]');
  if (buy) {
    const item = me.catalogue.find((i) => i.id === buy.dataset.buy);
    if (!confirm(`Acheter « ${item.name} » pour ${eur(item.price)} ?`)) return;
    try { me = await api('/api/team/buy', { itemId: item.id }); renderHeader(); render(); toast('Achat enregistré.'); } catch (err) { toast(err.message); }
  }
});

$('#view').addEventListener('input', (e) => {
  if (e.target.id !== 'lot-search') return;
  lots.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const input = $('#lot-search');
  input.focus(); input.setSelectionRange(pos, pos);
});

$('#view').addEventListener('submit', async (e) => {
  if (e.target.id !== 'log-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    me = await api('/api/team/log', Object.fromEntries(fd));
    render(true);
  } catch (err) { toast(err.message); }
});

if (code) start(); else showLogin();
