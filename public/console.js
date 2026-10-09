'use strict';
// Console animateur.

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const hhmm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const RESTORE_LABELS = { none: '', restoring: '⏳ restauration', decrypting: '⏳ déchiffrement (rançon payée)', restored: '✅ restauré', restored_old: '⚠ restauré (USB, 3 semaines)', lost: '💀 données perdues' };

let key = sessionStorage.getItem('brevinel.admin') || '';
let S = null;
let offset = 0;

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur'), { status: res.status });
  return data;
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2500);
}

async function act(name, body = {}) {
  try { await api(`/api/admin/${name}`, body); } catch (err) { toast(err.message); }
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  key = $('#pwd').value;
  try { await start(); sessionStorage.setItem('brevinel.admin', key); } catch (err) { $('#login-error').textContent = err.message; }
});

async function start() {
  await refresh();
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  new EventSource('/events').addEventListener('update', () => refresh().catch(() => {}));
  setInterval(tickTimer, 1000);
}

async function refresh() {
  S = await api('/api/admin/state');
  offset = S.now - Date.now();
  render();
}

function tickTimer() {
  const t = S?.timer;
  const left = t ? t.endsAt - (Date.now() + offset) : 0;
  const s = Math.max(0, Math.round(left / 1000));
  $('#timer-view').textContent = t && left > 0 ? `${t.label || 'Chrono'} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Pas de chrono';
}

function render() {
  const toggle = (el, on, onText, offText, cls) => { el.textContent = on ? onText : offText; el.className = on ? cls : ''; };
  toggle($('#ransom-btn'), S.ransom.active, '☠ Ransomware ACTIF (cliquer pour arrêter)', '☠ Déclencher le ransomware', 'on-red');
  toggle($('#cold-btn'), S.coldAlarm, '❄️ Alarme CF2 ACTIVE', '❄️ Alarme chambre froide', 'on-red');
  toggle($('#shop-btn'), S.shopOpen, '🛒 Boutique OUVERTE', '🛒 Boutique fermée', 'on-green');
  $('#timer-presets').innerHTML = [3, 5, 10, 15, 20, 30, 45].map((m) => `<button data-timer="${m}">${m} min</button>`).join(' ');
  tickTimer();
  if (!$('#teams').contains(document.activeElement)) renderTeams();
  renderInjects();
  renderFeeds();
}

function renderTeams() {
  const cat = Object.fromEntries(S.catalogue.map((i) => [i.id, i]));
  $('#teams').innerHTML = S.teams.map((t) => `
    <div class="team" style="border-top-color:${esc(t.color)}" data-team="${t.id}">
      <input class="name" value="${esc(t.name)}" data-field="name">
      <div class="muted">Code : <input value="${esc(t.code)}" data-field="code" size="8"> · couleur <input type="color" value="${esc(t.color)}" data-field="color"></div>
      <div class="big">${t.confiance}<small>/100</small></div>
      <div class="btns">${[-10, -5, -1, 1, 5, 10].map((d) => `<button class="small" data-score="${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}</div>
      <div><b>${eur(t.budget)}</b> <button class="small" data-budget="10000">+10 k€</button> <button class="small" data-budget="-10000">−10 k€</button></div>
      <div class="muted">${RESTORE_LABELS[t.restore.status] || ''} ${S.ransom.active && t.restore.status !== 'restored' ? '<button class="small" data-unlock>Débloquer</button>' : ''}</div>
      <ul>${t.purchases.map((p) => `<li>${esc(cat[p.itemId]?.name)} ${cat[p.itemId]?.joker ? `<span class="tag">${cat[p.itemId].joker}</span>` : ''} <a href="#" data-refund="${p.itemId}" title="Rembourser">×</a></li>`).join('') || '<li class="muted">Aucun achat</li>'}</ul>
    </div>`).join('');
}

function renderInjects() {
  const sent = Object.fromEntries(S.sent.map((s) => [s.id, s.at]));
  const days = [...new Set(S.injects.map((i) => i.day))];
  $('#injects').innerHTML = days.map((d) => `<div class="inj-group"><h3>${d}</h3>${S.injects.filter((i) => i.day === d).map((i) => `
    <div class="inj ${sent[i.id] ? 'sent' : ''}">
      <span class="lbl">${esc(i.label)} ${i.audio ? '🔊' : ''} ${sent[i.id] ? `<span class="muted">${hhmm(sent[i.id])}</span>` : ''}</span>
      <button class="small primary" data-inject="${i.id}">${sent[i.id] ? 'Renvoyer' : 'Envoyer'}</button>
      ${sent[i.id] ? `<button class="small" data-unsend="${i.id}">Retirer</button>` : ''}
    </div>`).join('')}</div>`).join('');
}

function renderFeeds() {
  const teams = Object.fromEntries(S.teams.map((t) => [t.id, t]));
  const entries = S.teams.flatMap((t) => t.log.map((e) => ({ ...e, team: t }))).sort((a, b) => b.at - a.at);
  $('#feed').innerHTML = entries.map((e) => `<div><b style="color:${esc(e.team.color)}">■</b> <b>${esc(e.team.name)}</b> · ${hhmm(e.at)} · ${esc(e.role)} · <i>${esc(e.type)}</i><br>${esc(e.text)}</div>`).join('') || '<p class="muted">Rien pour le moment.</p>';
  $('#history').innerHTML = S.history.map((h) => `<div>${hhmm(h.at)} · <b>${esc(teams[h.teamId]?.name)}</b> · ${h.kind === 'budget' ? eur(h.delta) : (h.delta > 0 ? '+' : '') + h.delta + ' confiance'} · ${esc(h.reason)}</div>`).join('') || '<p class="muted">Rien pour le moment.</p>';
}

// --- Événements -------------------------------------------------------------------

$('#ransom-btn').addEventListener('click', () => {
  if (!S.ransom.active && !confirm('Déclencher le ransomware pour toutes les équipes ?')) return;
  act('ransom', { active: !S.ransom.active });
});
$('#cold-btn').addEventListener('click', () => act('cold', { active: !S.coldAlarm }));
$('#shop-btn').addEventListener('click', () => act('shop', { open: !S.shopOpen }));
$('#clear-btn').addEventListener('click', () => act('clearScreen'));
$('#reset').addEventListener('click', () => {
  if (confirm('Tout remettre à zéro (scores, budgets, achats, mains courantes) ?') && confirm('Vraiment ? Cette action est définitive.')) act('reset');
});

document.addEventListener('click', (e) => {
  const timer = e.target.closest('[data-timer]');
  if (timer) return act('timer', { minutes: Number(timer.dataset.timer), label: $('#timer-label').value });
  const inj = e.target.closest('[data-inject]');
  if (inj) return act('inject', { id: inj.dataset.inject });
  const uns = e.target.closest('[data-unsend]');
  if (uns) return act('unsend', { id: uns.dataset.unsend });

  const card = e.target.closest('[data-team]');
  if (!card) return;
  const teamId = card.dataset.team;
  const reason = $('#reason').value;
  if (e.target.dataset.score) act('score', { teamId, delta: Number(e.target.dataset.score), reason });
  if (e.target.dataset.budget) act('budget', { teamId, delta: Number(e.target.dataset.budget), reason: reason || 'Ajustement animateur' });
  if (e.target.matches('[data-unlock]')) act('unlock', { teamId });
  if (e.target.dataset.refund) { e.preventDefault(); if (confirm('Rembourser cet achat ?')) act('refund', { teamId, itemId: e.target.dataset.refund }); }
});

$('#teams').addEventListener('change', (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  act('team', { teamId: e.target.closest('[data-team]').dataset.team, [field]: e.target.value }).then(() => e.target.blur());
});

if (key) start().catch(() => $('#login').classList.remove('hidden')); else $('#login').classList.remove('hidden');
