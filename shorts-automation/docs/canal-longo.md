# Canal de vídeos longos — desenho

> **Status: desenho, nada implementado.** Documento para decidir antes de construir.
> Escrito em 13/11/2026.

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

## O formato

**"Minuto Financeiro — A Semana"**, 8 a 12 minutos, publicado aos domingos.

Consolida os shorts aprovados da semana, mas **não é uma colagem deles**. Isso é
decisivo: a política de conteúdo reutilizado recusa material republicado "sem
adicionar comentários originais significativos". Um vídeo que emenda sete shorts
é exatamente o que ela descreve.

O que o longo adiciona, e o short não tem espaço para fazer:

- **Fio condutor.** As notícias da semana contadas como uma história só: o que
  elas têm em comum, o que elas dizem juntas que não dizem separadas.
- **Contexto.** O short diz que o dólar subiu; o longo diz o que ele fez nos
  últimos seis meses e por que esta alta é diferente.
- **Retrospectiva honesta.** "Semana passada eu disse X, aconteceu Y." Isso é
  conteúdo original por definição, e constrói a relação que gera inscrito.
- **O que observar na semana seguinte.** Dá motivo para voltar.

### Estrutura (rascunho)

| bloco | duração | conteúdo |
|---|---|---|
| Abertura | 0:00–0:30 | A pergunta que a semana deixou. Sem vinheta longa. |
| Os três fatos | 0:30–4:00 | Os 3 assuntos de maior peso, ~80s cada, com contexto |
| A conexão | 4:00–6:00 | O que eles dizem juntos — a parte que só o longo faz |
| Retrospectiva | 6:00–7:30 | O que foi dito antes e o que de fato aconteceu |
| Semana que vem | 7:30–9:00 | Datas, decisões e números a observar |
| Fecho | 9:00–9:30 | Convite para inscrever, aqui sim em todo vídeo |

Retenção importa mais que duração: 8 minutos com 50% valem mais que 15 com 20%.
Começar em 8 e só crescer se a retenção permitir.

## O que dá para reaproveitar

| peça | reuso | observação |
|---|---|---|
| `src/ai/generate.js` | parcial | mesma Groq, prompt novo (roteiro longo, não short) |
| `src/video/tts.js` | **direto** | mesma voz; narração mais longa |
| `src/video/broll.js` | **direto** | mais clipes, mesma busca |
| `src/video/assemble.js` | **reescrever** | 16:9, legenda opcional, ritmo diferente |
| `src/youtube/upload.js` | **direto** | só muda categoria e privacidade |
| `src/state/store.js` | **direto** | novo arquivo de estado |
| Painel | estender | aba nova, mesma mecânica de aprovação |
| `.github/workflows` | novo | cron semanal, mesmo grupo de concorrência |

A maior parte da infraestrutura já existe. O trabalho real está no roteiro e na
montagem.

## As decisões que precisam ser suas

**1. Mesmo canal ou canal separado?**

- *Mesmo canal:* os inscritos vindos dos Shorts já estão lá, e os dois formatos
  somam para o mesmo limite de 1.000. **Recomendo este.**
- *Canal separado:* começa do zero em inscritos. Só faz sentido se o público for
  diferente, e não é.

**2. Faceless de novo, ou sua voz?**

Este é o ponto mais importante do documento. A política exige que conteúdo feito
com ferramentas automatizadas "demonstre sua visão criativa". Um vídeo de 10
minutos com voz sintética e b-roll genérico é muito mais vulnerável na análise do
YPP do que um short de 30 segundos — tem dez vezes mais tempo para o revisor
perceber que não há ninguém ali.

Gravar você mesmo a abertura e o bloco da conexão (2–3 minutos de 10) mudaria a
natureza do canal aos olhos da análise. É a diferença entre "canal automatizado"
e "criador que usa automação".

Não é decisão técnica, é quanto você quer aparecer. Mas é honesto dizer: **o
caminho 100% automatizado tem risco real de reprovação no YPP**, e reprovação
custa 30 dias, depois 90.

**3. Cadência e gatilho**

Semanal, domingo. Mas: gerar automático e esperar aprovação, ou só gerar quando
você pedir? Um vídeo longo ruim publicado custa mais caro que um short ruim.
Sugiro começar sob demanda, pelo painel.

**4. Quantos shorts por semana alimentam o longo?**

Hoje são 14 gerados e poucos aprovados. O longo precisa dos **aprovados** — e a
fila expira em 5 dias, então os de domingo a terça já saíram quando chega o fim de
semana. Ou o longo lê de `published.json` (só os aprovados que foram ao ar), ou a
validade sobe para 8 dias. Ler dos publicados é mais limpo.

## Fases sugeridas

1. **Um vídeo manual.** Eu gero o roteiro com a IA, você lê, ajusta e a gente
   monta uma vez só. Serve para descobrir o que o formato pede antes de
   automatizar o formato errado.
2. **Montagem automatizada**, geração sob demanda pelo painel, aprovação manual.
3. **Cron semanal**, se os dois primeiros derem certo.

Automatizar antes da fase 1 é construir o pipeline errado com confiança.

## O que ainda não sei

- **Quantos inscritos o canal tem hoje.** É o gargalo comum aos dois caminhos e
  o sistema não guarda esse número. Dá para buscar pela API e mostrar no painel.
- **Qual a retenção dos shorts atuais.** A coleta acabou de entrar; em uma semana
  dá para saber se o problema é alcance ou é o conteúdo não segurar.
- **Se o público dos Shorts assiste longo.** Só medindo.

Nenhuma dessas respostas bloqueia a fase 1.
