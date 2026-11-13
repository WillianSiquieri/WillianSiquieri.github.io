# Clothing Automation (Roupas → Instagram)

Sistema que **transforma fotos de roupa recebidas no WhatsApp em posts de venda no
Instagram**, de forma autônoma, com **painel de controle** para revisar, ajustar o
preço, aprovar, dar feedback e acompanhar os resultados.

Irmão do [`shorts-automation`](../shorts-automation/) — mesmo repositório, mesma
mecânica (estado em JSON versionado + painel estático + GitHub Actions), outro negócio.

> Para testar sem nenhuma chave: `npm run seed` (usa fotos de exemplo e exige
> `llm.allowMockFallback: true` no `config.json`). Em produção, configure as chaves
> abaixo — sem elas, o motor **não inventa anúncio**.

## Como funciona

```
Você encaminha a foto  ─▶  bot do Telegram  ─▶  IA descreve a peça OLHANDO A FOTO
do WhatsApp p/ o bot        (getUpdates)          (Gemini com visão)
  + preço na legenda              │                        │
                                  ▼                        ▼
                     baixa as imagens p/ data/media   preço de venda = custo
                     (hospedadas pelo GitHub Pages)    + spread %, subindo
                                  │                     p/ terminar em 9,99
        Painel  ◀── data/*.json ◀─┤                        │
     (aprovar /                   └────────────────────────┤
      feedback /                                           ▼
      spread)                                   Publica no Instagram
                                                (Graph API, aprovados)
```

O trabalho manual é só este: na foto que a fornecedora mandou → **Compartilhar** →
**Telegram** → seu bot → escrever o **preço de custo** na legenda → enviar.
Várias fotos enviadas juntas viram **um único anúncio em carrossel**.

- **Modo `approval`** (padrão): gera os posts e espera você aprovar no painel.
- **Modo `auto`**: já marca como aprovado e publica sozinho até X posts/dia.
- **Modo `paused`**: não gera nada.

### Preço: custo + spread, terminando em 9,99

O preço de venda = **preço de custo** (o que você escreveu na legenda) **+ um spread
percentual** configurável no painel, sempre arredondado **para cima**. Padrão
`nine99`: sobe até o próximo valor terminado em **9,99**.

| Custo | +30% | Vai ao ar por |
|---|---|---|
| R$ 79,90 | 103,87 | **R$ 109,99** |
| R$ 49,90 | 64,87 | **R$ 69,99** |
| R$ 119,90 | 155,87 | **R$ 159,99** |

> ⚠️ Como os preços só podem cair em 9,99 / 19,99 / 29,99…, peças **baratas** sobem
> bastante em termos relativos: custo R$ 10 + 30% = R$ 13 → vai a **R$ 19,99**.
> Se preferir ficar colado na margem, troque o arredondamento para **"Centavos em
> ,99"** no painel (R$ 13,00 → R$ 13,99).

O preço de custo **nunca** aparece no anúncio: a instrução da IA proíbe, e o motor
ainda remove qualquer ocorrência dele do texto antes de publicar.

## Estrutura

| Caminho | O quê |
|---|---|
| `config/config.json` | Loja, fonte de entrada, allowlist do Telegram, modelo de IA, URL pública |
| `data/settings.json` | Modo, posts/dia, **spread + arredondamento**, preferências/feedback |
| `data/queue.json` | Posts gerados aguardando aprovação |
| `data/published.json` | Publicados + métricas |
| `data/feedback.json` | Seu feedback (vira instrução para a IA) |
| `data/telegram.json` | Cursor do Telegram (o que já foi lido) |
| `data/media/` | Imagens baixadas (servidas publicamente pelo GitHub Pages) |
| `src/` | Motor: fontes, preço, IA, Instagram, ciclo |
| `dashboard/` | Painel estático (GitHub Pages) |
| `.github/workflows/` | Ciclo (buscar+gerar) + publicação |

## Rodar localmente

```bash
cd clothing-automation
npm install

# Ciclo em modo mock (sem chaves): popula a fila com peças de exemplo
npm run seed

# Ciclo real (precisa das chaves em .env):
cp .env.example .env   # preencha
node src/cycle.js

# Processar aprovados (publicar no Instagram):
node src/publish.js

# Abrir o painel:
npx serve ..            # e acesse /clothing-automation/dashboard/
```

## Configurar as chaves (produção)

Defina como **GitHub Secrets** (Settings → Secrets → Actions) ou no `.env` local.

### 1. IA da legenda — grátis (defina UMA chave)
Prioridade no modo `auto`: **Groq → Gemini → Claude → mock**.
### 1. IA da legenda — grátis (defina UMA chave)
Como a legenda que você manda tem só o preço, **quem descreve a peça é a IA olhando a
foto**. Por isso, havendo imagem, o motor prioriza um provedor com visão:
**Gemini → Groq → Claude**.
- `GEMINI_API_KEY` — **recomendado**: é o único que hoje enxerga a foto. https://aistudio.google.com/apikey
- `GROQ_API_KEY` — grátis e rápido, mas **só texto**: sem ver a foto, a descrição fica
  genérica. Use como reserva. https://console.groq.com/keys
- `ANTHROPIC_API_KEY` — alternativa paga (Claude), hoje também só texto neste módulo.

> **Sem chave, nada é anunciado — de propósito.** Anunciar uma peça com legenda de
> template é pior que não anunciar, e mascara falhas da IA por semanas (foi o que
> aconteceu com o `shorts-automation`: a Groq descontinuou um modelo em 17/08 e o
> sistema passou 2 meses gerando roteiro de template reportando sucesso).
> Por isso: `llm.allowMockFallback = false` por padrão, o ciclo **sai com erro**
> (workflow vermelho) quando chegaram fotos e nada foi gerado, e a escolha do
> modelo da Groq é feita consultando `/models` em tempo real — imune a
> descontinuação. Cada post registra qual IA o gerou em `aiProvider`.
> Para testar o pipeline sem chave nenhuma, ligue `allowMockFallback: true`.

### 2. Telegram (entrada das fotos) — grátis, sem servidor

O caminho padrão. Você encaminha a foto do WhatsApp para um bot seu no Telegram, e o
motor lê pelo `getUpdates` da Bot API — que já é uma caixa de entrada com cursor, então
**não precisa de webhook, servidor, OAuth nem mensalidade**.

**Criar o bot (2 minutos):**
1. No Telegram, fale com o **@BotFather** → `/newbot` → escolha nome e usuário.
2. Ele devolve um token (`123456:ABC-...`). Salve como secret **`TELEGRAM_BOT_TOKEN`**.
3. Abra uma conversa com o seu bot e mande `/start` (sem isso ele não recebe mensagens).

**Restringir quem pode anunciar (recomendado):** rode o ciclo uma vez e veja no log o
aviso com o seu chat ID; coloque-o em `config.json`:

```json
"telegram": { "allowedChatIds": [555001] }
```

Sem essa lista, qualquer pessoa que descobrir o usuário do bot consegue enfileirar um
anúncio. Com ela, mensagens de outros chats são descartadas sem nem baixar a foto.

**No dia a dia:** foto da fornecedora → Compartilhar → Telegram → seu bot → escrever
**só o preço de custo** na legenda (ex.: `79,90`) → enviar. Fotos enviadas juntas
(álbum) viram um único anúncio em carrossel, com a legenda da primeira.

> O `data/telegram.json` guarda até onde já foi lido. Ele só avança **depois** que a
> fila é salva com sucesso — se o ciclo falhar no meio, as mensagens voltam no próximo
> em vez de se perderem.

**Alternativa (WhatsApp via provedor):** se um dia quiser ligar direto no WhatsApp,
o provedor `inbox` continua disponível: defina `WHATSAPP_INBOX_URL` apontando para um
endpoint HTTP que devolva as mensagens em JSON (array ou `{ "messages": [...] }`, com
no mínimo remetente + imagens; aliases aceitos para `from`/`caption`/`images`). Serve
para Cloud API, Z-API, Evolution API etc. Restrinja remetentes em
`config.json → whatsapp.vendors`.

> **Sem fonte configurada, o motor não gera nada** — e isso é de propósito. Antes, ele
> caía no mock sozinho: rodando de 3 em 3 horas, encheu a fila com **513 peças que não
> existiam**. Hoje o mock só roda com `--mock` explícito, nunca em produção.

### 3. Instagram (saída dos posts) — Instagram Graph API
1. Tenha uma conta **Instagram Business/Creator** ligada a uma **Página do Facebook**.
2. No [Meta for Developers](https://developers.facebook.com): crie um app, adicione o
   produto **Instagram Graph API** e gere um **token de longa duração** com as permissões
   `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`.
3. Descubra o **Instagram Business Account ID**.
4. Salve como secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`.

> As imagens são publicadas a partir de uma URL pública. Como o motor baixa as fotos
> para `data/media/` (commitado no repo), o **GitHub Pages** as serve automaticamente
> em `https://<seu-usuario>.github.io/clothing-automation/data/media/...` — que é o que
> o Instagram Graph API consome. Confira `config.json → publicBaseUrl`.

Sem as chaves do Instagram, o sistema ainda gera e enfileira os posts — só não publica
(marca como publicado localmente para você acompanhar).

## Usar o painel

Publicado em `https://<seu-usuario>.github.io/clothing-automation/dashboard/`.

- **Somente leitura** por padrão (mostra fila, publicados, preços).
- Clique em **🔌 Conectar** e cole um **GitHub token** (fine-grained, permissão
  *Contents: Read/Write* neste repo). Aí você pode **aprovar/rejeitar**, mudar o
  **modo**, ajustar o **spread de preço**, os **posts/dia** e enviar **feedback** —
  tudo grava nos JSON e o motor obedece no próximo ciclo.
- Botão **▶ Shorts** no topo leva ao outro painel (os dois negócios rodam em paralelo).

## Loop de feedback

A cada post você pode deixar um feedback, e há um feedback geral na aba própria. O
motor injeta os últimos feedbacks + suas preferências como instrução para a IA no
próximo ciclo — então as legendas vão ficando com a sua cara.
