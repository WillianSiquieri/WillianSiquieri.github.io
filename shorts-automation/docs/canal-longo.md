# Canal de vídeos longos — desenho

> **Status: desenho, nada implementado.** Documento para decidir antes de construir.
> Escrito em 13/11/2026, revisado com as decisões do usuário.

## Por que existe

O canal de Shorts está preso num caminho inviável para monetizar.

O Programa de Parcerias tem dois caminhos, e a página oficial diz, textualmente,
que *"as horas qualificadas de exibição das visualizações de Shorts no Feed dos
Shorts **não são contabilizadas** para o limite mínimo de 4.000 horas"*.

| caminho | requisito | situação |
|---|---|---|
| A — horas | 1.000 inscritos + **4.000 horas** em 12 meses | **bloqueado**: Shorts não contam horas |
| B — Shorts | 1.000 inscritos + **10 milhões de views** em 90 dias | aberto, mas exige ~111 mil views/dia |

O melhor short até hoje fez 1.202 views no total. O caminho B pede o equivalente
a 90 vídeos como esse, por dia, durante 90 dias.

O caminho A pede 4.000 horas em 12 meses: **11 horas por dia**. Com vídeos de 8
minutos e retenção de 50% (4 min assistidos), são ~165 visualizações por dia. Isso
é uma ordem de grandeza diferente — e é alcançável.

**O vídeo longo não substitui os Shorts: ele destrava o caminho que os Shorts
fecham.** Os Shorts continuam sendo o funil de descoberta e de inscritos; o longo
converte atenção em horas.

## Decisões tomadas

| questão | decisão |
|---|---|
| Canal | **O mesmo** do Shorts, para somar inscritos |
| Rosto | **Faceless** — nada de câmera |
| Voz | **A voz do usuário**, gravada por ele, não TTS |
| Conteúdo | Os pontos mais relevantes da semana, com análise |
| Duração | Poucos minutos (começar em 4–6, crescer se a retenção permitir) |
| Vinheta | Abertura e encerramento, com música, marca do canal |
| Nome | "Minuto Financeiro · Análise da Semana", com nº de episódio e data |
| Cadência | Semanal, sempre no mesmo dia |

## A consequência técnica da voz própria

Essa decisão **inverte o pipeline**, e é o ponto central do desenho.

```
Shorts (hoje):   roteiro → TTS → o TTS devolve o tempo de cada palavra
                 → legenda e cortes se alinham a esse tempo

Longo (novo):    roteiro → O USUÁRIO GRAVA → o tempo tem de ser EXTRAÍDO do áudio
                 → legenda e cortes se alinham à fala real dele
```

No Shorts o motor sabe o tempo de cada palavra porque ele mesmo gerou o áudio. Com
a voz do usuário, ninguém sabe onde cada frase cai até analisar a gravação. Sem
resolver isso, o vídeo não acompanha a fala — é justamente o que ele não quer.

### Como extrair o tempo

Transcrição com **timestamp por palavra**, usando o roteiro aprovado como
referência. Isso é mais confiável que transcrição pura: o texto já é conhecido,
então basta casar a transcrição com ele para saber quando cada bloco começa e
termina.

Dois caminhos, ambos sem custo:

1. **Groq Whisper** (`whisper-large-v3`). Mesma chave já configurada, mesmo free
   tier. **A confirmar na primeira execução** — os hosts da Groq estão bloqueados
   no ambiente desta sessão, então não deu para verificar daqui se o plano inclui
   áudio e se devolve timestamp por palavra.
2. **`whisper.cpp` no próprio runner.** Sem API, sem limite de cota, roda em CPU.
   Mais lento (alguns minutos para 5 min de áudio), mas não depende de ninguém.

O desenho não muda em função de qual vencer.

### Gravar por bloco, não em uma tacada

**Recomendação forte.** O roteiro sai dividido em blocos; o usuário grava um
arquivo por bloco.

- Errou em um bloco, regrava **só aquele** — não o vídeo inteiro.
- O alinhamento fica trivial: já se sabe qual áudio é qual bloco.
- O b-roll de cada bloco tem fronteira exata, sem depender de adivinhar onde um
  assunto termina.

## Como o vídeo acompanha a fala

Hoje o b-roll é escolhido pelo tema do short inteiro. Num vídeo de 5 minutos com
quatro assuntos diferentes, um tema só daria imagem sem sentido — exatamente a
reclamação a evitar.

A solução é o roteiro já nascer com os termos visuais **por bloco**:

```json
{
  "episodio": 1,
  "blocos": [
    {
      "tipo": "abertura",
      "texto": "Essa semana o dólar bateu a maior alta desde junho...",
      "visual": ["currency exchange office", "hands counting cash"]
    },
    {
      "tipo": "assunto",
      "texto": "Começando pelo Banco Central. A Selic...",
      "visual": ["government building columns", "person using atm"]
    },
    {
      "tipo": "conexao",
      "texto": "Juntando as três coisas, o que a semana diz é...",
      "visual": ["business people meeting", "city traffic time lapse"]
    }
  ]
}
```

Com o tempo de cada bloco vindo do alinhamento, a montagem corta a imagem na
fronteira da fala. Quem escreve o texto escolhe a imagem — então imagem e fala não
têm como se descolar.

A IA que gera o roteiro passa a devolver essa estrutura, não um texto corrido.

## Estrutura do episódio

| bloco | duração | conteúdo |
|---|---|---|
| Vinheta | 0:00–0:06 | Marca do canal, música |
| Abertura | 0:06–0:30 | A pergunta que a semana deixou |
| Assuntos | 0:30–3:30 | Os 3 fatos de maior peso, ~60s cada, com contexto |
| A conexão | 3:30–4:30 | O que eles dizem juntos — a parte que só o longo faz |
| Semana que vem | 4:30–5:15 | Datas, decisões e números a observar |
| Fecho + vinheta | 5:15–5:40 | Convite para inscrever (aqui em todo vídeo) e vinheta |

Retenção importa mais que duração: 5 minutos com 50% valem mais que 12 com 20%.
Começar curto e crescer só se o dado permitir.

## Vinheta e música

**Visual:** gerada por ffmpeg — nome do canal animado sobre fundo sólido ou
b-roll escurecido. Determinística, idêntica em todo episódio, custo zero. Se o
usuário quiser uma vinheta desenhada depois, é só trocar o arquivo.

**Música: precisa de uma decisão do usuário, e não é técnica.**

Não vou escolher faixa por ele. Música errada rende reivindicação de direito
autoral no vídeo inteiro, e o julgamento de "combina com o canal" é dele.

- A faixa entra **só na vinheta** (6s na abertura, ~8s no fecho), nunca por baixo
  da narração inteira. Isso limita o risco e não briga com a voz.
- Fontes gratuitas: **Biblioteca de Áudio do YouTube** (dentro do Studio, livre de
  reivindicação para uso no próprio YouTube), Pixabay Music, Free Music Archive
  (atenção à licença de cada faixa).
- **Uma faixa só, reutilizada em todo episódio.** Além de simplificar, repetição
  de vinheta é reconhecimento de marca — é o único lugar onde repetir é bom.
- O arquivo fica versionado no repositório (`assets/vinheta.mp3`), e o usuário
  escolhe qual é.

## Nome e numeração

Formato do título:

```
Minuto Financeiro · Análise da Semana #7 — semana de 16/11
```

Número de episódio **e** data. O número cria série (dá vontade de ver o anterior);
a data situa quem chega pela busca. O contador vive em `data/longform.json`, e a
data é a do domingo da semana coberta.

**Dia de publicação: domingo.** O mercado fecha na sexta, então o fim de semana
tem a semana inteira fechada, e domingo pega quem está organizando a própria
semana. Se preferir sexta à noite, é um campo de config.

## O que dá para reaproveitar

| peça | reuso | observação |
|---|---|---|
| `src/ai/generate.js` | parcial | mesma Groq, prompt novo e saída em blocos |
| `src/video/tts.js` | **não** | a voz agora é do usuário |
| `src/video/broll.js` | **direto** | mesmo mapa de buscas, agora por bloco |
| `src/video/assemble.js` | reescrever | 16:9, cortes por bloco, vinheta, legenda opcional |
| `src/youtube/upload.js` | **direto** | só muda categoria e privacidade |
| `src/youtube/analytics.js` | **direto** | retenção vale ainda mais aqui |
| `src/state/store.js` | **direto** | novo arquivo `longform.json` |
| Painel | estender | aba nova + **upload de áudio** (peça nova) |
| `.github/workflows` | novo | cron semanal, mesmo grupo de concorrência `shorts-state` |

A peça realmente nova é o **upload do áudio pelo painel** e o **alinhamento**.

## O ciclo semanal, do ponto de vista do usuário

1. **Sexta** — o motor gera o roteiro da semana a partir dos shorts publicados e
   das manchetes, e avisa que está pronto.
2. **Sábado** — ele lê o roteiro no painel, corta o que não gostou, ajusta o texto.
   (~5 min)
3. **Sábado** — grava os blocos lendo o roteiro, do celular mesmo, e sobe os
   áudios pelo painel. (~10 min)
4. O motor alinha, escolhe o b-roll de cada bloco, monta com vinheta e sobe como
   **não listado**.
5. **Domingo** — ele assiste, aprova, e o vídeo fica público.

**Custo real: ~20 minutos por semana.** Honesto dizer isso agora: diferente dos
Shorts, este canal não roda sozinho. A voz dele é o que o torna defensável na
análise do YPP, e é também o que exige presença dele toda semana.

## Fases

1. **Um episódio manual.** O motor gera o roteiro em blocos; o usuário grava; eu
   monto uma vez, possivelmente com comandos na mão. Serve para descobrir o que o
   formato pede antes de automatizar o formato errado — foi o que faltou no b-roll
   e no gancho, e os dois tiveram de ser refeitos.
2. **Montagem automatizada**, geração e upload pelo painel, aprovação manual.
3. **Cron semanal**, se as duas primeiras derem certo.

## O que falta decidir ou descobrir

- **A faixa da vinheta.** Decisão do usuário (ver acima).
- **Se a Groq transcreve de graça com timestamp por palavra.** Se não, cai no
  `whisper.cpp` no runner. Não bloqueia a fase 1.
- **Quantos inscritos o canal tem hoje.** É o gargalo comum aos dois caminhos e o
  sistema não guarda esse número. Dá para buscar pela API e mostrar no painel.
- **Qual a retenção dos shorts.** A coleta acabou de entrar; em uma semana dá para
  saber se o problema é alcance ou o conteúdo não segurar.
