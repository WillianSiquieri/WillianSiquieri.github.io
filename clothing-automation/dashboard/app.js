/* Painel de vendas de roupas — app estático, sem dependências.
   Lê os JSON versionados e grava decisões (aprovar/rejeitar/config/feedback)
   de volta no repositório via API do GitHub (token guardado no navegador). */

const BASE = '..'; // relativo a dashboard/index.html
const REPO_DIR = 'clothing-automation';
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
  try { return JSON.parse(localStorage.getItem('ca_conn') || '{}'); } catch { return {}; }
}
function saveConn(c) { localStorage.setItem('ca_conn', JSON.stringify(c)); }
function isConnected() { return Boolean(conn.token && conn.repo); }

/* ---------- Leitura ---------- */
async function readFile(key) {
  if (isConnected()) {
    const url = `https://api.github.com/repos/${conn.repo}/contents/${REPO_DIR}/${FILES[key]}?ref=${conn.branch || 'master'}`;
    const res = await fetch(url, { headers: ghHeaders(), cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      shaCache[key] = j.sha;
      return JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
    }
  }
  const res = await fetch(`${BASE}/${FILES[key]}?t=${Date.now()}`, { cache: 'no-store' });
  return res.ok ? res.json() : (key === 'config' || key === 'settings' ? {} : []);
}

async function writeFile(key, value, message) {
  if (!isConnected()) { toast('Conecte um token do GitHub para salvar.', true); throw new Error('offline'); }
  if (!shaCache[key]) await readFile(key);
  const url = `https://api.github.com/repos/${conn.repo}/contents/${REPO_DIR}/${FILES[key]}`;
  const body = {
    message: message || `painel roupas: atualizar ${FILES[key]}`,
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
  document.getElementById('store-name').textContent = state.config.storeName || 'Painel de vendas';
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
  const pricing = state.settings.pricing || {};
  const potential = state.queue
    .filter((q) => q.status !== 'rejected')
    .reduce((s, q) => s + (q.price || 0), 0);
  const soldTotal = state.published.reduce((s, p) => s + (p.price || 0), 0);
  const kpis = [
    { val: state.queue.filter((q) => q.status === 'draft').length, lbl: 'Na fila (aguardando)' },
    { val: state.published.length, lbl: 'Publicados' },
    { val: (pricing.spreadPercent ?? '—') + '%', lbl: 'Spread atual' },
    { val: fmtBRL(potential), lbl: 'Valor na fila' },
    { val: fmtBRL(soldTotal), lbl: 'Total anunciado' },
    { val: state.settings.postsPerDay ?? '—', lbl: 'Meta/dia' },
  ];
  document.getElementById('kpis').innerHTML = kpis
    .map((k) => `<div class="kpi"><div class="val">${k.val}</div><div class="lbl">${k.lbl}</div></div>`)
    .join('');
}

function renderSettings() {
  const pricing = state.settings.pricing || {};
  document.getElementById('spread').value = pricing.spreadPercent ?? 30;
  document.getElementById('rounding').value = pricing.rounding || 'psychological';
  document.getElementById('per-day').value = state.settings.postsPerDay ?? 3;
  document.getElementById('guidance').value = state.settings.preferences?.guidance || '';
}

function renderQueue() {
  const list = state.queue.filter((q) => q.status !== 'rejected');
  document.getElementById('count-queue').textContent = list.length;
  const el = document.getElementById('queue-list');
  document.getElementById('queue-empty').classList.toggle('hidden', list.length > 0);
  el.innerHTML = list.map((d) => postCard(d, false)).join('');
  wireCardEvents();
}

function renderPublished() {
  const list = [...state.published].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  document.getElementById('count-published').textContent = list.length;
  const el = document.getElementById('published-list');
  document.getElementById('published-empty').classList.toggle('hidden', list.length > 0);
  el.innerHTML = list.map((d) => postCard(d, true)).join('');
  wireCardEvents();
}

function renderFeedback() {
  const log = [...state.feedback].reverse();
  document.getElementById('feedback-log').innerHTML = log
    .map((f) => `<li><div>${escapeHtml(f.text)}</div><div class="when">${new Date(f.at).toLocaleString('pt-BR')}${f.targetTitle ? ' · sobre: ' + escapeHtml(f.targetTitle) : ''}</div></li>`)
    .join('');
}

function gallery(d, isPublished) {
  const imgs = d.images || [];
  if (isPublished && d.instagram?.permalink) {
    return `<a class="preview ig-link" href="${d.instagram.permalink}" target="_blank" rel="noopener">
      <div class="ig-badge">Ver no Instagram ↗</div>
    </a>`;
  }
  if (!imgs.length) {
    return `<div class="no-preview">🖼️ ${isPublished ? 'Publicado no Instagram' : 'Sem imagem'}</div>`;
  }
  const slides = imgs.map((rel, i) => `<img loading="lazy" src="${BASE}/${rel}" alt="foto ${i + 1}" class="${i === 0 ? 'active' : ''}" data-slide="${i}">`).join('');
  const dots = imgs.length > 1
    ? `<div class="dots">${imgs.map((_, i) => `<span class="${i === 0 ? 'active' : ''}" data-dot="${i}"></span>`).join('')}</div>`
    : '';
  return `<div class="preview gallery" data-gallery>${slides}${dots}
    ${imgs.length > 1 ? '<button class="nav prev" data-nav="-1">‹</button><button class="nav next" data-nav="1">›</button>' : ''}
  </div>`;
}

function priceBlock(d) {
  const base = d.basePrice != null ? fmtBRL(d.basePrice) : '—';
  const final = d.price != null ? fmtBRL(d.price) : '—';
  return `<div class="price">
    <div class="price-line"><span class="lbl">Fornecedora</span><span class="base">${base}</span></div>
    <div class="price-line big"><span class="lbl">Venda (+${d.spreadPercent ?? '?'}%)</span><span class="final">${final}</span></div>
  </div>`;
}

function postCard(d, isPublished) {
  const stats = isPublished
    ? `<div class="stats">
         <div class="stat"><b>${fmt(d.likes || 0)}</b><span>curtidas</span></div>
         <div class="stat"><b>${fmt(d.comments || 0)}</b><span>comentários</span></div>
         <div class="stat"><b>${fmt(d.reach || 0)}</b><span>alcance</span></div>
       </div>`
    : `<div class="actions">
         <button class="btn green" data-act="approve" data-id="${d.id}">✅ Aprovar</button>
         <button class="btn danger" data-act="reject" data-id="${d.id}">✕ Rejeitar</button>
         <textarea class="fb" data-fb="${d.id}" rows="1" placeholder="Feedback sobre este post (opcional)..."></textarea>
       </div>`;

  return `<article class="post" data-card="${d.id}">
    <div class="head">
      <div class="vendor">${escapeHtml(d.vendor?.name || d.vendor?.number || 'fornecedora')}</div>
      <div class="title">${escapeHtml(d.product?.title || '')}
        ${!isPublished ? `<span class="status-chip status-${d.status}">${d.status}</span>` : ''}
      </div>
      ${d.product?.size || d.product?.color ? `<div class="attrs">${[d.product.size && ('Tam ' + d.product.size), d.product.color].filter(Boolean).map((a) => escapeHtml(a)).join(' · ')}</div>` : ''}
    </div>
    ${gallery(d, isPublished)}
    ${priceBlock(d)}
    <div class="body">
      <div class="caption" data-caption>${escapeHtml(d.caption || '')}</div>
      <button class="toggle" data-toggle>ver mais</button>
      <div class="meta">${(d.hashtags || []).slice(0, 8).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
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
  // Carrossel de imagens
  document.querySelectorAll('[data-gallery]').forEach((g) => {
    const slides = g.querySelectorAll('img');
    const dots = g.querySelectorAll('[data-dot]');
    let cur = 0;
    const show = (i) => {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('active', k === cur));
      dots.forEach((d, k) => d.classList.toggle('active', k === cur));
    };
    g.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.onclick = (e) => { e.preventDefault(); show(cur + Number(btn.dataset.nav)); };
    });
    dots.forEach((d) => { d.onclick = () => show(Number(d.dataset.dot)); });
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
    await writeFile('queue', state.queue, `painel roupas: ${act} "${state.queue[idx].product?.title || id}"`);
    if (fbText) await pushFeedback(fbText, state.queue[idx].product?.title);
    toast(act === 'approve' ? 'Aprovado ✅ — vai para o Instagram no próximo publish.' : 'Rejeitado ✕');
    await loadAll();
  } catch { /* toast já exibido */ }
}

async function pushFeedback(text, targetTitle) {
  state.feedback.push({ at: new Date().toISOString(), text, targetTitle: targetTitle || null });
  await writeFile('feedback', state.feedback, 'painel roupas: novo feedback');
}

async function saveSettings() {
  state.settings.postsPerDay = Number(document.getElementById('per-day').value);
  state.settings.pricing = state.settings.pricing || {};
  state.settings.pricing.spreadPercent = Number(document.getElementById('spread').value);
  state.settings.pricing.rounding = document.getElementById('rounding').value;
  state.settings.preferences = state.settings.preferences || {};
  state.settings.preferences.guidance = document.getElementById('guidance').value;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, 'painel roupas: configurações'); toast('Configurações salvas'); }
  catch {}
}

async function setMode(mode) {
  state.settings.mode = mode;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, `painel roupas: modo ${mode}`); renderMode(); toast('Modo: ' + mode); }
  catch {}
}

/* ---------- Utils ---------- */
function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
document.getElementById('btn-settings').onclick = () => document.getElementById('spread').scrollIntoView({ behavior: 'smooth' });
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
