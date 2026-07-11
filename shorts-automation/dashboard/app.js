/* Painel de controle — app estático, sem dependências.
   Lê os JSON versionados e grava decisões (aprovar/rejeitar/config/feedback)
   de volta no repositório via API do GitHub (token guardado no navegador). */

const BASE = '..'; // relativo a dashboard/index.html
const REPO_DIR = 'shorts-automation';
const FILES = {
  config: 'config/config.json',
  settings: 'data/settings.json',
  queue: 'data/queue.json',
  published: 'data/published.json',
  feedback: 'data/feedback.json',
};

const conn = loadConn();
let state = { config: {}, settings: {}, queue: [], published: [], feedback: [] };
const shaCache = {}; // path -> sha (para writes na API do GitHub)

/* ---------- Conexão / persistência ---------- */
function loadConn() {
  try { return JSON.parse(localStorage.getItem('sa_conn') || '{}'); } catch { return {}; }
}
function saveConn(c) { localStorage.setItem('sa_conn', JSON.stringify(c)); }
function isConnected() { return Boolean(conn.token && conn.repo); }

/* ---------- Leitura ---------- */
async function readFile(key) {
  if (isConnected()) {
    // Via API do GitHub: garante dados frescos + sha para escrita.
    const url = `https://api.github.com/repos/${conn.repo}/contents/${REPO_DIR}/${FILES[key]}?ref=${conn.branch || 'master'}`;
    const res = await fetch(url, { headers: ghHeaders(), cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      shaCache[key] = j.sha;
      return JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
    }
  }
  // Fallback somente-leitura: arquivo servido pelo próprio site.
  const res = await fetch(`${BASE}/${FILES[key]}?t=${Date.now()}`, { cache: 'no-store' });
  return res.ok ? res.json() : (key === 'config' || key === 'settings' ? {} : []);
}

async function writeFile(key, value, message) {
  if (!isConnected()) { toast('Conecte um token do GitHub para salvar.', true); throw new Error('offline'); }
  // Garante sha atual.
  if (!shaCache[key]) await readFile(key);
  const url = `https://api.github.com/repos/${conn.repo}/contents/${REPO_DIR}/${FILES[key]}`;
  const body = {
    message: message || `painel: atualizar ${FILES[key]}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2) + '\n'))),
    sha: shaCache[key],
    branch: conn.branch || 'master',
  };
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { toast('Erro ao salvar: ' + res.status, true); throw new Error('write failed'); }
  const j = await res.json();
  shaCache[key] = j.content.sha;
}

function ghHeaders() {
  return { Authorization: `Bearer ${conn.token}`, Accept: 'application/vnd.github+json' };
}

/* ---------- Carregar tudo ---------- */
async function loadAll() {
  const [config, settings, queue, published, feedback] = await Promise.all([
    readFile('config'), readFile('settings'), readFile('queue'), readFile('published'), readFile('feedback'),
  ]);
  state = { config, settings, queue, published, feedback };
  render();
}

/* ---------- Render ---------- */
function render() {
  document.getElementById('channel-name').textContent = state.config.channelName || 'Painel de controle';
  renderBanner();
  renderMode();
  renderKpis();
  renderSettings();
  renderQueue();
  renderPublished();
  renderFeedback();
}

function renderBanner() {
  const b = document.getElementById('banner');
  if (isConnected()) { b.classList.add('hidden'); }
  else {
    b.classList.remove('hidden');
    b.innerHTML = '👀 Modo somente-leitura. Clique em <strong>🔌 Conectar</strong> para aprovar, rejeitar e configurar pelo painel.';
  }
}

function renderMode() {
  const mode = state.settings.mode || 'approval';
  const pill = document.getElementById('mode-pill');
  const label = { paused: '⏸ Pausado', approval: '✅ Aprovação', auto: '⚡ Automático' }[mode] || mode;
  pill.textContent = label;
  pill.className = 'mode-pill ' + mode;
  document.querySelectorAll('#mode-switch button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function renderKpis() {
  const totViews = state.published.reduce((s, p) => s + (p.views || 0), 0);
  const avgScore = state.published.length
    ? Math.round(state.published.reduce((s, p) => s + (p.score || 0), 0) / state.published.length)
    : 0;
  const kpis = [
    { val: state.queue.filter((q) => q.status === 'draft').length, lbl: 'Na fila (aguardando)' },
    { val: state.published.length, lbl: 'Publicados' },
    { val: fmt(totViews), lbl: 'Views totais' },
    { val: fmt(avgScore), lbl: 'Score médio' },
    { val: state.settings.shortsPerDay ?? '—', lbl: 'Meta/dia' },
  ];
  document.getElementById('kpis').innerHTML = kpis
    .map((k) => `<div class="kpi"><div class="val">${k.val}</div><div class="lbl">${k.lbl}</div></div>`)
    .join('');
}

function renderSettings() {
  document.getElementById('per-day').value = state.settings.shortsPerDay ?? 2;
  document.getElementById('guidance').value = state.settings.preferences?.guidance || '';
}

function renderQueue() {
  const list = state.queue.filter((q) => q.status !== 'rejected');
  document.getElementById('count-queue').textContent = list.length;
  const el = document.getElementById('queue-list');
  document.getElementById('queue-empty').classList.toggle('hidden', list.length > 0);
  el.innerHTML = list.map((d) => shortCard(d, false)).join('');
  wireCardEvents();
}

function renderPublished() {
  const list = [...state.published].sort((a, b) => (b.score || 0) - (a.score || 0));
  document.getElementById('count-published').textContent = list.length;
  const el = document.getElementById('published-list');
  document.getElementById('published-empty').classList.toggle('hidden', list.length > 0);
  el.innerHTML = list.map((d) => shortCard(d, true)).join('');
  wireCardEvents();
}

function renderFeedback() {
  const log = [...state.feedback].reverse();
  document.getElementById('feedback-log').innerHTML = log
    .map((f) => `<li><div>${escapeHtml(f.text)}</div><div class="when">${new Date(f.at).toLocaleString('pt-BR')}${f.targetTitle ? ' · sobre: ' + escapeHtml(f.targetTitle) : ''}</div></li>`)
    .join('');
}

function shortCard(d, isPublished) {
  const preview = d.youtubeId && !String(d.youtubeId).startsWith('DEMO')
    ? `<div class="preview"><iframe src="https://www.youtube.com/embed/${d.youtubeId}" allowfullscreen></iframe></div>`
    : `<div class="no-preview">🎬 ${d.video?.rendered ? 'Vídeo renderizado' : 'Sem preview de vídeo'} · ${d.video?.durationSec || '?'}s</div>`;

  const stats = isPublished
    ? `<div class="stats">
         <div class="stat"><b>${fmt(d.views || 0)}</b><span>views</span></div>
         <div class="stat"><b>${fmt(d.likes || 0)}</b><span>likes</span></div>
         <div class="stat"><b>${fmt(d.comments || 0)}</b><span>comentários</span></div>
         <div class="stat"><b>${fmt(d.score || 0)}</b><span>score</span></div>
       </div>`
    : `<div class="actions">
         <button class="btn green" data-act="approve" data-id="${d.id}">✅ Aprovar</button>
         <button class="btn danger" data-act="reject" data-id="${d.id}">✕ Rejeitar</button>
         <a class="btn ghost" href="${d.previewUrl || d.sourceLink || '#'}" target="_blank" rel="noopener">↗ Fonte</a>
         <textarea class="fb" data-fb="${d.id}" rows="1" placeholder="Feedback sobre este short (opcional)..."></textarea>
       </div>`;

  return `<article class="short" data-card="${d.id}">
    <div class="head">
      <div class="theme">${escapeHtml(d.theme || 'tema')}</div>
      <div class="title">${escapeHtml(d.title || '')}
        ${!isPublished ? `<span class="status-chip status-${d.status}">${d.status}</span>` : ''}
      </div>
      <div class="hook">${escapeHtml(d.hook || '')}</div>
    </div>
    ${preview}
    <div class="body">
      <div class="script" data-script>${escapeHtml(d.script || '')}</div>
      <button class="toggle" data-toggle>ver mais</button>
      <div class="meta">${(d.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
      ${d.rationale ? `<div class="meta"><span class="muted small">💡 ${escapeHtml(d.rationale)}</span></div>` : ''}
    </div>
    ${stats}
  </article>`;
}

function wireCardEvents() {
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.onclick = () => {
      const s = btn.previousElementSibling;
      s.classList.toggle('expanded');
      btn.textContent = s.classList.contains('expanded') ? 'ver menos' : 'ver mais';
    };
  });
  document.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = () => decide(btn.dataset.id, btn.dataset.act);
  });
}

/* ---------- Ações ---------- */
async function decide(id, act) {
  const idx = state.queue.findIndex((q) => q.id === id);
  if (idx === -1) return;
  const fbBox = document.querySelector(`[data-fb="${id}"]`);
  const fbText = fbBox?.value?.trim();
  state.queue[idx].status = act === 'approve' ? 'approved' : 'rejected';
  state.queue[idx].decidedAt = new Date().toISOString();
  try {
    await writeFile('queue', state.queue, `painel: ${act} "${state.queue[idx].title}"`);
    if (fbText) await pushFeedback(fbText, state.queue[idx].title);
    toast(act === 'approve' ? 'Aprovado ✅' : 'Rejeitado ✕');
    await loadAll();
  } catch { /* toast já exibido */ }
}

async function pushFeedback(text, targetTitle) {
  state.feedback.push({ at: new Date().toISOString(), text, targetTitle: targetTitle || null });
  await writeFile('feedback', state.feedback, 'painel: novo feedback');
}

async function saveSettings() {
  state.settings.shortsPerDay = Number(document.getElementById('per-day').value);
  state.settings.preferences = state.settings.preferences || {};
  state.settings.preferences.guidance = document.getElementById('guidance').value;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, 'painel: configurações'); toast('Configurações salvas'); }
  catch {}
}

async function setMode(mode) {
  state.settings.mode = mode;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, `painel: modo ${mode}`); renderMode(); toast('Modo: ' + mode); }
  catch {}
}

/* ---------- Utils ---------- */
function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : '');
  setTimeout(() => t.classList.add('hidden'), 2600);
  t.classList.remove('hidden');
}

/* ---------- Eventos globais ---------- */
document.getElementById('btn-refresh').onclick = () => loadAll();
document.getElementById('btn-save-settings').onclick = saveSettings;
document.getElementById('btn-add-feedback').onclick = async () => {
  const box = document.getElementById('global-feedback');
  const text = box.value.trim();
  if (!text) return;
  try { await pushFeedback(text); box.value = ''; toast('Feedback enviado'); await loadAll(); } catch {}
};
document.querySelectorAll('#mode-switch button').forEach((btn) => {
  btn.onclick = () => setMode(btn.dataset.mode);
});
document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  };
});

/* Modal conectar */
const modal = document.getElementById('modal-connect');
document.getElementById('btn-connect').onclick = () => {
  document.getElementById('cfg-repo').value = conn.repo || 'williansiquieri/williansiquieri.github.io';
  document.getElementById('cfg-branch').value = conn.branch || 'master';
  document.getElementById('cfg-token').value = conn.token || '';
  modal.classList.remove('hidden');
};
document.getElementById('btn-settings').onclick = () => document.getElementById('per-day').scrollIntoView({ behavior: 'smooth' });
document.getElementById('btn-save-connect').onclick = async () => {
  conn.repo = document.getElementById('cfg-repo').value.trim();
  conn.branch = document.getElementById('cfg-branch').value.trim() || 'master';
  conn.token = document.getElementById('cfg-token').value.trim();
  saveConn(conn);
  modal.classList.add('hidden');
  toast('Conectado');
  await loadAll();
};
document.getElementById('btn-disconnect').onclick = async () => {
  conn.token = ''; saveConn(conn); modal.classList.add('hidden'); toast('Desconectado'); await loadAll();
};
modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

/* Start */
loadAll().catch((e) => toast('Erro ao carregar: ' + e.message, true));
