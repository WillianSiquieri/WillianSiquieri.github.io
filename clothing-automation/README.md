# Clothing Automation (Roupas → Instagram)

Sistema que **transforma fotos de roupa recebidas no WhatsApp em posts de venda no
Instagram**, de forma autônoma, com **painel de controle** para revisar, ajustar o
preço, aprovar, dar feedback e acompanhar os resultados.

Irmão do [`shorts-automation`](../shorts-automation/) — mesmo repositório, mesma
mecânica (estado em JSON versionado + painel estático + GitHub Actions), outro negócio.

> Estado atual: **fundação funcional (MVP)**. Roda ponta-a-ponta em modo *mock*
> sem nenhuma chave. Para produção, configure as chaves de API (abaixo).

## Como funciona

```
Fornecedoras (WhatsApp)  ─▶  Motor pega as fotos + preço  ─▶  IA escreve a legenda
   (fotos + preço)            (provedor "inbox" ou mock)        (Groq/Gemini/Claude)
                                        │                             │
                                        ▼                             ▼
                             baixa as imagens p/ data/media    preço final = preço da
                             (hospedadas pelo GitHub Pages)     fornecedora + spread %
                                        │                             │
        Painel  ◀── data/*.json (fila, publicados, feedback) ◀────────┤
     (aprovar /                                                        ▼
      feedback /                                           Publica no Instagram
      spread)                                              (Graph API, aprovados)
```

- **Modo `approval`** (padrão): gera os posts e espera você aprovar no painel.
- **Modo `auto`**: já marca como aprovado e publica sozinho até X posts/dia.
- **Modo `paused`**: não gera nada.

### Preço com spread

O preço final = **preço que a fornecedora mandou** (extraído do texto do WhatsApp) **+
um spread percentual** que você configura no painel. O arredondamento é opcional:
terminar em `,90` (padrão), inteiro, ou exato. Ex.: base R$ 79,90 + 30% → **R$ 103,90**.

## Estrutura

| Caminho | O quê |
|---|---|
| `config/config.json` | Loja, fornecedoras (números do WhatsApp), modelo de IA, URL pública |
| `data/settings.json` | Modo, posts/dia, **spread + arredondamento**, preferências/feedback |
| `data/queue.json` | Posts gerados aguardando aprovação |
| `data/published.json` | Publicados + métricas |
| `data/feedback.json` | Seu feedback (vira instrução para a IA) |
| `data/media/` | Imagens baixadas (servidas publicamente pelo GitHub Pages) |
| `src/` | Motor: WhatsApp, preço, IA, Instagram, ciclo |
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
- `GROQ_API_KEY` — recomendado (grátis, Llama 3.3 70B): https://console.groq.com/keys
- `GEMINI_API_KEY` — grátis e **enxerga a foto** para descrever a peça: https://aistudio.google.com/apikey
- `ANTHROPIC_API_KEY` — alternativa paga (Claude).
- Sem nenhuma chave, cai para um gerador mock simples.

### 2. WhatsApp (entrada das fotos)

O WhatsApp não deixa um cron "puxar" mensagens direto. O padrão é um provedor
(Cloud API oficial da Meta, [Z-API](https://z-api.io), [Evolution API](https://evolution-api.com),
UltraMsg, etc.) que **recebe as mensagens por webhook e as acumula**. O motor então lê
esse acúmulo por um endpoint HTTP genérico — o provedor **`inbox`**:

- `WHATSAPP_PROVIDER=inbox`
- `WHATSAPP_INBOX_URL` — endpoint que devolve as mensagens recebidas em JSON.
- `WHATSAPP_INBOX_TOKEN` — (opcional) enviado como `Bearer` no header.

O endpoint deve devolver um **array** (ou `{ "messages": [...] }`) de objetos. O
parser é tolerante a nomes de campo; o mínimo é **remetente + imagem(ns)**:

```json
[
  {
    "messageId": "abc123",
    "from": "5511999990001",
    "senderName": "Fornecedora Ana",
    "caption": "Vestido midi floral, tam M. R$ 79,90",
    "images": ["https://.../foto1.jpg", "https://.../foto2.jpg"],
    "receivedAt": "2026-07-12T10:00:00Z"
  }
]
```

Aliases aceitos: `from`/`phone`/`sender`/`number`/`chatId`; `caption`/`text`/`body`;
`images`/`media`/`attachments`/`imageUrl`. Só entram no pipeline as mensagens dos
**números cadastrados** em `config.json → whatsapp.vendors`.

> Como montar o inbox: aponte o webhook do seu provedor para um pequeno coletor
> (uma function serverless, um Gist, um bucket, um mini-servidor) que guarde as
> últimas mensagens em JSON, e coloque essa URL em `WHATSAPP_INBOX_URL`. Qualquer
> provedor serve — o motor só precisa da lista.

Sem provedor configurado, o motor usa **mensagens mock** (fotos de exemplo geradas
localmente) para você testar o pipeline inteiro.

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
