# Shorts Automation

Sistema que **gera YouTube Shorts de forma autônoma** a partir de temas atuais
(notícias, política, atualidades), com **painel de controle** para revisar,
aprovar, dar feedback e acompanhar a performance.

> Estado atual: **fundação funcional (MVP)**. Roda ponta-a-ponta em modo *mock*
> sem nenhuma chave. Para produção, configure as chaves de API (abaixo).

## Como funciona

```
Fontes (RSS/API)  ─▶  IA seleciona temas + escreve roteiro  ─▶  Monta vídeo
   (config.json)        (Claude API, guiado por feedback)         (TTS + ffmpeg)
                                                                       │
        Painel  ◀── data/*.json (fila, publicados, feedback) ◀────────┤
     (aprovar/                                                         ▼
      feedback)                                            Upload YouTube (Data API)
        │                                                             │
        └────────────▶ publish.js publica aprovados ◀── Analytics (performance)
                                                          realimenta a seleção
```

- **Modo `approval`** (padrão): gera os shorts, envia como *não listados* (preview) e
  espera você aprovar no painel. Só então ficam públicos.
- **Modo `auto`**: publica sozinho X shorts/dia.
- **Modo `paused`**: não gera nada.

O estado inteiro vive em arquivos JSON versionados (`data/`), então o GitHub
Actions consegue rodar tudo de graça e o painel estático lê/escreve esses arquivos.

## Estrutura

| Caminho | O quê |
|---|---|
| `config/config.json` | Fontes de notícia, nicho, formato do vídeo, modelo de IA |
| `data/settings.json` | Modo, shorts/dia, preferências/feedback |
| `data/queue.json` | Shorts gerados aguardando aprovação |
| `data/published.json` | Publicados + métricas de performance |
| `data/feedback.json` | Seu feedback (vira instrução para a IA) |
| `src/` | Motor: fontes, IA, vídeo, YouTube, ciclo |
| `dashboard/` | Painel estático (servido pelo GitHub Pages) |
| `.github/workflows/` | Cron diário + publicação |

## Rodar localmente

```bash
cd shorts-automation
npm install

# Ciclo em modo mock (sem chaves, sem render): popula a fila
npm run seed

# Ciclo real (precisa das chaves em .env):
cp .env.example .env   # preencha
node src/cycle.js

# Abrir o painel:
npx serve .            # e acesse /dashboard/  (ou qualquer servidor estático)
```

## Configurar as chaves (produção)

Defina como **GitHub Secrets** (Settings → Secrets → Actions) ou no `.env` local:

> **A pilha padrão é 100% gratuita:** Gemini (free tier) para roteiro + edge-tts
> (sem chave) para voz. A única chave a criar é a do Gemini (2 min, grátis).

### 1. Roteiro (IA) — grátis (defina UMA chave)
Prioridade no modo `auto`: **Groq → Gemini → Claude → mock**.
- `GROQ_API_KEY` — **recomendado** (grátis e confiável, Llama 3.3 70B):
  https://console.groq.com/keys
- `GEMINI_API_KEY` — grátis, mas a quota do free tier **depende da conta/região**
  (pode retornar 429 sem quota): https://aistudio.google.com/apikey
- `ANTHROPIC_API_KEY` — alternativa paga (Claude).
- Sem nenhuma chave, cai para um gerador mock simples.
- Provedor e modelos ficam em `config/config.json → llm` (`provider: "auto"`).

### 2. Voz / TTS — edge-tts grátis (padrão, sem chave)
- **Nada a configurar:** por padrão usa **edge-tts** (vozes neurais da Microsoft,
  gratuitas). Troque a voz em `config/config.json → tts.voice`
  (ex.: `pt-BR-AntonioNeural`, `pt-BR-FranciscaNeural`, `pt-BR-ThalitaNeural`).
- Opcional (pago, premium): `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`).
- Opcional (offline): `PIPER_MODEL`.
- Se o edge-tts falhar (rede), o vídeo sai com trilha silenciosa como fallback.

### 3. Fundo em vídeo (b-roll) — Pexels grátis
- `PEXELS_API_KEY` — https://www.pexels.com/api/ (grátis). Com ela, o fundo passa a
  ser um **vídeo real** relacionado ao tema (escurecido, com a legenda por cima),
  o que deixa o Short com cara profissional. Sem ela, usa um fundo gradiente.
- Controle em `config/config.json → video.backgroundStyle`: `auto` (b-roll se houver
  chave), `gradient` (força gradiente) ou `stock` (força b-roll).

### 3. YouTube (publicar + medir performance)
1. No [Google Cloud Console](https://console.cloud.google.com): crie um projeto,
   ative **YouTube Data API v3** e **YouTube Analytics API**.
2. Crie credenciais **OAuth 2.0 (App Desktop)** → guarde *Client ID* e *Client Secret*.
3. Gere o refresh token uma vez:
   ```bash
   YT_CLIENT_ID=... YT_CLIENT_SECRET=... npm run auth
   ```
   Autorize no navegador e copie o `YT_REFRESH_TOKEN` impresso.
4. Salve `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` como secrets.

> **Escopo:** autorize na conta **do canal** (não no perfil pessoal) e aceite os três
> escopos pedidos. `youtube.upload` sozinho só permite **enviar** — tornar público
> (`videos.update`) e apagar um rejeitado (`videos.delete`) exigem o escopo
> `https://www.googleapis.com/auth/youtube`. Com o token errado o upload funciona e a
> aprovação falha com **`Insufficient Permission`**: o vídeo fica para sempre *não
> listado*. Se mudar a lista de escopos em `src/youtube/auth.js`, **gere o token de novo**
> — um refresh token antigo carrega os escopos de quando foi criado.

Sem as chaves do YouTube, o sistema ainda gera e enfileira os shorts — só não publica.

#### Regerar o `YT_REFRESH_TOKEN` pelo OAuth Playground

Use quando a aprovação falhar com `Insufficient Permission`, quando os escopos
mudarem, ou quando o token for revogado. Não precisa de nada instalado.

**a) Liberar o Playground como destino do login** (uma vez só)

No [Console → APIs e serviços → Credenciais](https://console.cloud.google.com/apis/credentials),
abra o cliente OAuth do projeto:

- Se o tipo for **Aplicativo da Web**: em *URIs de redirecionamento autorizados*
  adicione `https://developers.google.com/oauthplayground` e salve.
- Se for **App para computador**: ele não aceita esse redirect. Crie um cliente novo
  do tipo *Aplicativo da Web* com esse URI (o *Client ID* e o *Secret* mudam, então
  atualize também os secrets `YT_CLIENT_ID` e `YT_CLIENT_SECRET`), ou pule o
  Playground e use `npm run auth` localmente.

Confira em *Tela de permissão OAuth* se o app está **Em produção**. Em **Teste**, o
Google expira o refresh token em **7 dias** — o pipeline quebra toda semana.

**b) Autorizar**

1. Abra <https://developers.google.com/oauthplayground/>.
2. Clique na **engrenagem** (canto superior direito) e marque
   **Use your own OAuth credentials**; cole *Client ID* e *Client secret*.
   Deixe *OAuth flow* em **Server-side** e **Force prompt** em **Consent screen**
   (sem isso o Google pode devolver só o access token, sem refresh token).
3. Em **Step 1**, no campo *Input your own scopes*, cole os três escopos numa linha:
   ```
   https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly
   ```
4. **Authorize APIs** → escolha a conta Google **do canal**. Se aparecer a lista de
   canais, selecione o canal certo — escolher o perfil pessoal aqui é o que já fez
   os vídeos subirem no canal errado. Aceite as permissões.
5. Em **Step 2**, clique **Exchange authorization code for tokens** e copie o
   **`refresh_token`** (começa com `1//`).

**c) Atualizar o secret**

Em *Settings → Secrets and variables → Actions* do repositório, no secret
**`YT_REFRESH_TOKEN`** clique no lápis, cole o valor novo e **Update secret**.
O valor antigo não é exibido; sobrescrever é o normal.

**d) Conferir**

Em *Actions → Shorts · Publicar aprovados → Run workflow*. O log deve dizer
`Aprovado e publicado: <id>` em vez de `Insufficient Permission`. Shorts que já
estavam aprovados na fila publicam sozinhos — não precisa aprovar de novo.

## Usar o painel

Publicado em `https://<seu-usuario>.github.io/shorts-automation/dashboard/`.

- **Somente leitura** por padrão (mostra fila, publicados, performance).
- Clique em **🔌 Conectar** e cole um **GitHub token** (fine-grained, permissão
  *Contents: Read/Write* neste repo). Aí você pode **aprovar/rejeitar**, mudar o
  **modo** (pausar/retomar), ajustar **shorts/dia** e enviar **feedback** — tudo
  isso grava nos JSON e o motor obedece no próximo ciclo.

### Preview dos shorts pendentes

Cada short na fila mostra um player para você assistir antes de aprovar:

- **Sem YouTube conectado:** o motor gera um preview leve (540×960) em
  `data/previews/<id>.mp4`, versionado no repo, e o painel toca via player HTML5.
  O arquivo é **apagado automaticamente** ao aprovar ou rejeitar (não incha o repo).
- **Com YouTube conectado:** o short sobe como **não listado** e o painel embute o
  player do YouTube diretamente.

O preview só aparece depois que o motor **renderiza** o vídeo (precisa de `ffmpeg` —
o workflow já instala no CI).

## Adicionar fontes de notícia

Edite `config/config.json` → array `sources`. Hoje há suporte a `rss`. Para
adicionar um novo tipo (NewsAPI, GNews, scraping), crie um adaptador em
`src/sources/` e registre em `src/sources/index.js`.

```json
{ "id": "minha-fonte", "type": "rss", "url": "https://...", "label": "Minha Fonte", "enabled": true }
```

## Loop de feedback / aprendizado

A cada ciclo, o motor:
1. Atualiza a performance dos vídeos publicados (YouTube Analytics).
2. Passa os **top performers** + seu **feedback** + suas **preferências** para a IA,
   que prioriza temas parecidos com o que funciona e evita o que você não quer.

## Próximos passos sugeridos

- Fundos com imagens/vídeos reais (Pexels/Unsplash API) em vez de gradiente.
- Legendas sincronizadas por palavra (transcrição do áudio TTS).
- Agendamento por horário ótimo (baseado no analytics de audiência).
- Métricas avançadas (retenção, CTR) via YouTube Analytics API `reports`.
