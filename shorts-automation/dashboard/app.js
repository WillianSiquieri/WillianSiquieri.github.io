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

// Traduz o erro da API do GitHub em algo acionável.
function ghErrorMessage(status, body) {
  const extra = body?.message ? ` (${body.message})` : '';
  if (status === 401) return 'Token inválido ou expirado — gere um novo em 🔌 Conectar.';
  if (status === 403)
    return 'Token sem permissão de escrita. Ele precisa de "Contents: Read and write" neste repositório' + extra;
  if (status === 404) return 'Repositório ou branch não encontrado — ou o token não tem acesso a este repo.';
  return `Erro ${status} ao salvar${extra}`;
}

async function writeFile(key, value, message, _retry = 0) {
  if (!isConnected()) throw new Error('Conecte um token do GitHub para salvar (🔌 Conectar).');
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
  if (res.ok) {
    const j = await res.json();
    shaCache[key] = j.content.sha;
    return;
  }
  let errBody = null;
  try { errBody = await res.json(); } catch { /* resposta sem JSON */ }

  // Conflito de versão: o robô commitou enquanto você revisava. Recarrega o sha
  // e tenta de novo — quem chama já releu os dados frescos antes de montar o valor.
  if ((res.status === 409 || res.status === 422) && _retry < 1) {
    delete shaCache[key];
    await readFile(key);
    return writeFile(key, value, message, _retry + 1);
  }
  const err = new Error(ghErrorMessage(res.status, errBody));
  err.status = res.status;
  throw err;
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
  // Restaura rascunho pendente do feedback geral.
  const box = document.getElementById('global-feedback');
  const draft = getFbDraft('_global');
  if (box && draft && !box.value) box.value = draft;
  if (box && !box.oninput) box.oninput = () => saveFbDraft('_global', box.value.trim());

  const log = [...state.feedback].reverse();
  document.getElementById('feedback-log').innerHTML = log
    .map((f) => `<li><div>${escapeHtml(f.text)}</div><div class="when">${new Date(f.at).toLocaleString('pt-BR')}${f.targetTitle ? ' · sobre: ' + escapeHtml(f.targetTitle) : ''}</div></li>`)
    .join('');
}

function shortCard(d, isPublished) {
  let preview;
  if (d.youtubeId && !String(d.youtubeId).startsWith('DEMO')) {
    // Vídeo já enviado (não listado) → player do YouTube.
    preview = `<div class="preview"><iframe src="https://www.youtube.com/embed/${d.youtubeId}" allowfullscreen></iframe></div>`;
  } else if (d.video?.previewFile) {
    // Preview leve auto-hospedado no repo → player HTML5.
    preview = `<div class="preview"><video controls preload="metadata" playsinline src="${BASE}/${d.video.previewFile}"></video></div>`;
  } else {
    preview = `<div class="no-preview">🎬 ${d.video?.rendered ? 'Vídeo renderizado (preview indisponível)' : 'Preview aparece após o motor renderizar'} · ${d.video?.durationSec || '?'}s</div>`;
  }

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
         <div class="fb-row">
           <textarea class="fb" data-fb="${d.id}" rows="1" placeholder="Feedback sobre este short (texto ou voz)..."></textarea>
           <button class="mic" data-mic="${d.id}" title="Gravar feedback por voz" aria-label="Gravar feedback por voz">🎤</button>
         </div>
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
  document.querySelectorAll('[data-mic]').forEach((btn) => {
    btn.onclick = () => dictate(document.querySelector(`[data-fb="${btn.dataset.mic}"]`), btn);
  });
  // Restaura o que ficou pendente (ex.: falha ao salvar) e guarda a cada digitação/ditado.
  document.querySelectorAll('[data-fb]').forEach((box) => {
    const id = box.dataset.fb;
    const draft = getFbDraft(id);
    if (draft && !box.value) box.value = draft;
    box.oninput = () => saveFbDraft(id, box.value.trim());
  });
}

/* ---------- Ditado por voz (feedback falado) ---------- */
let activeRec = null;
// Rede de segurança para texto ditado que já veio em escada (igual a
// collapseRepeats em src/util.js — o painel é estático e não importa do Node).
function collapseRepeats(text, maxLen = 600) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= 400) return t;
  const words = t.split(' ');
  const out = [];
  let i = 0;
  while (i < words.length) {
    let rep = 0;
    for (let k = Math.min(out.length, words.length - i); k >= 1; k--) {
      let same = true;
      for (let j = 0; j < k; j++) {
        if (out[out.length - k + j] !== words[i + j]) { same = false; break; }
      }
      if (same) { rep = k; break; }
    }
    if (rep) i += rep;
    else out.push(words[i++]);
  }
  const s = out.join(' ');
  if (s.length < t.length) return collapseRepeats(s, maxLen);
  return s.length > maxLen ? s.slice(0, maxLen).replace(/\s\S*$/, '') + '…' : s;
}

function dictate(textarea, btn) {
  if (!textarea) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Ditado por voz não suportado neste navegador. Use Chrome ou Edge.', true);
    return;
  }
  // Já gravando → para.
  if (activeRec) {
    activeRec.stop();
    return;
  }
  const rec = new SR();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  const base = textarea.value ? textarea.value.trim() + ' ' : '';
  // Guarda o texto POR ÍNDICE de resultado, nunca concatenando: o navegador
  // reemite o mesmo trecho várias vezes enquanto refina, e concatenar gerava
  // uma escada ("Esse / Esse é / Esse é um / ...") de dezenas de KB.
  const parts = [];
  const join = () => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      parts[i] = e.results[i][0].transcript.trim();
    }
    textarea.value = (base + join()).trim();
  };
  rec.onerror = (e) => toast('Erro no ditado: ' + (e.error || 'desconhecido'), true);
  rec.onend = () => {
    activeRec = null;
    btn.classList.remove('rec');
    btn.textContent = '🎤';
    textarea.value = collapseRepeats((base + join()).trim());
    textarea.focus();
  };
  activeRec = rec;
  btn.classList.add('rec');
  btn.textContent = '⏺';
  toast('Gravando… fale o feedback. Clique no microfone de novo para parar.');
  rec.start();
}

/* ---------- Rascunhos de feedback (sobrevivem a erro de rede/token) ---------- */
const FB_KEY = 'sa_fb_drafts';
function loadFbDrafts() {
  try { return JSON.parse(localStorage.getItem(FB_KEY) || '{}'); } catch { return {}; }
}
function saveFbDraft(id, text) {
  const d = loadFbDrafts();
  if (text) d[id] = text; else delete d[id];
  try { localStorage.setItem(FB_KEY, JSON.stringify(d)); } catch { /* storage cheio/bloqueado */ }
}
function getFbDraft(id) { return loadFbDrafts()[id] || ''; }

/* ---------- Ações ---------- */
async function decide(id, act) {
  const fbBox = document.querySelector(`[data-fb="${id}"]`);
  const fbText = (fbBox?.value || '').trim();
  // Guarda ANTES de tentar salvar: se der erro, o que você ditou não se perde.
  if (fbText) saveFbDraft(id, fbText);

  const local = state.queue.find((q) => q.id === id);
  const title = local?.title || id;

  try {
    // Relê a fila do servidor para não sobrescrever shorts gerados nesse meio-tempo.
    const fresh = await readFile('queue');
    const i = fresh.findIndex((q) => q.id === id);
    if (i === -1) { toast('Esse short não está mais na fila.', true); await loadAll(); return; }
    fresh[i].status = act === 'approve' ? 'approved' : 'rejected';
    fresh[i].decidedAt = new Date().toISOString();
    if (act === 'reject' && fbText) fresh[i].rejectReason = collapseRepeats(fbText);

    await writeFile('queue', fresh, `painel: ${act} "${title}"`);
    if (fbText) await pushFeedback(fbText, title);
    saveFbDraft(id, ''); // só limpa depois que tudo gravou
    toast(act === 'approve' ? 'Aprovado ✅' : 'Rejeitado ✕');
    await loadAll();
  } catch (e) {
    if (fbBox) fbBox.value = fbText; // mantém o texto na tela
    toast((e.message || 'Falha ao salvar') + ' — seu feedback foi guardado, tente de novo.', true);
  }
}

async function pushFeedback(text, targetTitle) {
  // Relê antes de gravar para não descartar feedbacks enviados de outro lugar.
  const fresh = await readFile('feedback');
  // Último filtro: o que for gravado aqui entra no prompt da IA no próximo ciclo.
  fresh.push({ at: new Date().toISOString(), text: collapseRepeats(text), targetTitle: targetTitle || null });
  await writeFile('feedback', fresh, 'painel: novo feedback');
  state.feedback = fresh;
}

async function saveSettings() {
  state.settings.shortsPerDay = Number(document.getElementById('per-day').value);
  state.settings.preferences = state.settings.preferences || {};
  state.settings.preferences.guidance = document.getElementById('guidance').value;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, 'painel: configurações'); toast('Configurações salvas'); }
  catch (e) { toast(e.message || 'Falha ao salvar configurações', true); }
}

async function setMode(mode) {
  state.settings.mode = mode;
  state.settings.updatedAt = new Date().toISOString();
  try { await writeFile('settings', state.settings, `painel: modo ${mode}`); renderMode(); toast('Modo: ' + mode); }
  catch (e) { toast(e.message || 'Falha ao mudar o modo', true); }
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

/* ---------- Geração sob demanda ---------- */
const GEN_WORKFLOW = 'shorts-daily.yml';

function genBusy(busy, label) {
  const btn = document.getElementById('btn-generate');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = label || '✨ Gerar short agora';
}

// Dispara o ciclo de geração (1 short) e acompanha até terminar.
async function generateNow() {
  if (!isConnected()) {
    toast('Conecte um token do GitHub para gerar (🔌 Conectar).', true);
    return;
  }
  genBusy(true, '⏳ Iniciando…');
  const startedAt = Date.now();
  try {
    const url = `https://api.github.com/repos/${conn.repo}/actions/workflows/${GEN_WORKFLOW}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      // force=true para funcionar mesmo com a geração pausada; sem no_upload,
      // então segue o fluxo normal: sobe como não listado e entra em aprovação.
      body: JSON.stringify({ ref: conn.branch || 'master', inputs: { count: '1', force: 'true' } }),
    });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch { /* sem JSON */ }
      if (res.status === 403) {
        throw new Error('Token sem permissão de Actions — edite o token e marque "Actions: Read and write".');
      }
      if (res.status === 404) throw new Error('Workflow não encontrado ou token sem acesso a Actions.');
      throw new Error(`Erro ${res.status}${body?.message ? ': ' + body.message : ''}`);
    }
    toast('Geração iniciada — leva cerca de 2 minutos.');
    await watchGeneration(startedAt);
  } catch (e) {
    toast(e.message || 'Falha ao iniciar a geração', true);
    genBusy(false);
  }
}

// Acompanha o run no GitHub Actions até concluir e recarrega a fila.
async function watchGeneration(startedAt) {
  let runId = null;
  // Um ciclo leva ~1-2 min, mas a instalação do ffmpeg no runner às vezes
  // arrasta (já levou 18 min num mirror lento). Acompanha por até 20 min.
  const MAX_POLLS = 240;
  const elapsed = () => {
    const s = Math.round((Date.now() - startedAt) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  };
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      if (!runId) {
        const r = await fetch(
          `https://api.github.com/repos/${conn.repo}/actions/workflows/${GEN_WORKFLOW}/runs?event=workflow_dispatch&per_page=1`,
          { headers: ghHeaders(), cache: 'no-store' }
        );
        if (r.ok) {
          const run = (await r.json()).workflow_runs?.[0];
          // Só aceita um run começado a partir do clique (margem de 1 min).
          if (run && new Date(run.created_at).getTime() >= startedAt - 60000) {
            runId = run.id;
          }
        }
        genBusy(true, `⏳ Gerando… ${elapsed()}`);
        continue;
      }
      const r = await fetch(`https://api.github.com/repos/${conn.repo}/actions/runs/${runId}`, {
        headers: ghHeaders(), cache: 'no-store',
      });
      if (!r.ok) continue;
      const run = await r.json();
      if (run.status !== 'completed') {
        genBusy(true, `⏳ Gerando… ${elapsed()}`);
        continue;
      }
      genBusy(false);
      if (run.conclusion === 'success') {
        toast(`Short gerado em ${elapsed()} ✅ — está na fila de aprovação.`);
        shaCache.queue = null; // força releitura
        await loadAll();
      } else {
        toast('A geração falhou — confira os logs em Actions no GitHub.', true);
      }
      return;
    } catch { /* rede instável: tenta de novo no próximo ciclo */ }
  }
  genBusy(false);
  toast(`Já são ${elapsed()} e o run não terminou — clique em ↻ Atualizar daqui a pouco.`, true);
}

/* ---------- Eventos globais ---------- */
document.getElementById('btn-refresh').onclick = () => loadAll();
document.getElementById('btn-generate').onclick = generateNow;
document.getElementById('btn-save-settings').onclick = saveSettings;
document.getElementById('btn-add-feedback').onclick = async () => {
  const box = document.getElementById('global-feedback');
  const text = box.value.trim();
  if (!text) return;
  saveFbDraft('_global', text);
  try {
    await pushFeedback(text);
    saveFbDraft('_global', '');
    box.value = '';
    toast('Feedback enviado');
    await loadAll();
  } catch (e) {
    toast((e.message || 'Falha ao enviar') + ' — seu texto foi guardado.', true);
  }
};
document.getElementById('mic-global').onclick = (e) =>
  dictate(document.getElementById('global-feedback'), e.currentTarget);
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
// Confere na hora se o token serve para escrever neste repositório.
async function checkConn() {
  try {
    const res = await fetch(`https://api.github.com/repos/${conn.repo}`, { headers: ghHeaders() });
    if (res.status === 401) return 'Token inválido ou expirado.';
    if (res.status === 404) return 'Repositório não encontrado, ou o token não tem acesso a ele.';
    if (!res.ok) return `Erro ${res.status} ao validar o token.`;
    const j = await res.json();
    if (!j.permissions?.push) {
      return 'Token conectado, mas SEM permissão de escrita — precisa de "Contents: Read and write".';
    }
    return null;
  } catch {
    return 'Não foi possível falar com o GitHub (rede/bloqueio).';
  }
}

// Actions é opcional: só o botão "Gerar short agora" depende dela.
async function canUseActions() {
  try {
    const res = await fetch(`https://api.github.com/repos/${conn.repo}/actions/workflows?per_page=1`, {
      headers: ghHeaders(), cache: 'no-store',
    });
    return res.ok;
  } catch { return false; }
}

document.getElementById('btn-save-connect').onclick = async () => {
  conn.repo = document.getElementById('cfg-repo').value.trim();
  conn.branch = document.getElementById('cfg-branch').value.trim() || 'master';
  conn.token = document.getElementById('cfg-token').value.trim();
  saveConn(conn);
  const problem = await checkConn();
  if (problem) {
    toast(problem, true);
    return; // mantém o modal aberto para você corrigir
  }
  modal.classList.add('hidden');
  if (await canUseActions()) {
    toast('Conectado — escrita e geração sob demanda liberadas ✅');
  } else {
    toast('Conectado, mas sem permissão de Actions: o botão "Gerar short agora" não vai funcionar.', true);
  }
  await loadAll();
};
document.getElementById('btn-disconnect').onclick = async () => {
  conn.token = ''; saveConn(conn); modal.classList.add('hidden'); toast('Desconectado'); await loadAll();
};
modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

/* Start */
loadAll().catch((e) => toast('Erro ao carregar: ' + e.message, true));
