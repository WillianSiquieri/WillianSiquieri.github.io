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

### 1. Claude API (roteiros) — recomendado
- `ANTHROPIC_API_KEY` — sem ela, o sistema usa um gerador mock simples.

### 2. Voz / TTS — opcional
- `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`) para voz de alta qualidade, **ou**
- `PIPER_MODEL` para TTS local grátis (open-source), **ou**
- nada → o vídeo sai com trilha silenciosa (útil para testar o fluxo).

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

Sem as chaves do YouTube, o sistema ainda gera e enfileira os shorts — só não publica.

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
