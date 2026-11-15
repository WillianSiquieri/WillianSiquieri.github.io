# CityBloom — Documento de Design

> Jogo de construir e cuidar de uma cidade, com a **mesma mecânica dos jogos de
> fazendinha** (Hay Day, FarmVille): produzir com tempo → coletar → transformar →
> entregar pedidos → ganhar moedas e XP → comprar terrenos e evoluir.
> Plataforma: navegador (celular e PC), HTML5 puro. Idiomas: PT e EN.
> Destino: portais de jogos HTML5 com anúncios (GameDistribution, CrazyGames).

Referência de mercado: *Township* (Playrix) une fazenda e cidade e é um dos jogos
casuais mais rentáveis. O CityBloom é uma versão leve, focada em sessões curtas e
anúncios premiados opcionais.

---

## 1. Loop principal

```
Lote de produção ──(tempo)──► matéria-prima ──► Fábrica ──(tempo)──► produto
       ▲                                                         │
       │                                                         ▼
  moedas + XP ◄── Pedidos da Prefeitura ◄──────────── construir/evoluir casas
       │                                                         │
       └──► comprar lotes / limpar obstáculos       casas geram aluguel 🪙 + moradores 👥
```

Sessão típica (2–5 min): coletar o que ficou pronto → iniciar novas produções →
entregar 1–2 pedidos → construir/evoluir algo → sair. Os timers continuam com o
jogo fechado (progresso offline), o que traz o jogador de volta.

## 2. Fazenda → cidade

| Fazendinha | CityBloom |
|---|---|
| Campo de plantio (trigo, milho) | **Lote de produção**: madeira, areia, barro, ferro |
| Animais (comem ração → dão leite/ovo) | **Casas**: geram aluguel 🪙 e moradores 👥 |
| Padaria, laticínio | **Fábricas**: serraria, olaria, vidraçaria, metalúrgica, marcenaria |
| Pedidos do caminhão | **Quadro de pedidos da Prefeitura** |
| Celeiro / silo | **Armazém** (amplia com 🔨 martelo e 📐 trena) |
| Limpar pedras/árvores | Limpar **entulho, mato, carro abandonado** |
| Expandir a fazenda | **Comprar lotes** vizinhos (escurecidos no mapa) |
| Decoração | **Árvores, praças, fontes** → ⭐ felicidade (bônus no aluguel) |
| Diamantes para acelerar | **Anúncio premiado** para acelerar/dobrar |

## 3. Recursos e economia

**Moedas 🪙** compram e constroem. **XP** sobe o **nível da cidade** (libera conteúdo).
**População 👥** destrava comércio. **Felicidade ⭐** dá bônus no aluguel.

### Matérias-primas (lotes)
| Recurso | Tempo | Custo p/ iniciar | Rende | Libera no nível |
|---|---|---|---|---|
| 🪵 Madeira | 1 min | 5 🪙 | 2 | 1 |
| 🟤 Barro | 5 min | 15 🪙 | 2 | 6 |
| 🏖️ Areia | 3 min | 10 🪙 | 2 | 11 |
| ⛏️ Ferro | 10 min | 30 🪙 | 2 | 21 |

### Fábricas
| Fábrica | Receita | Tempo | Nível |
|---|---|---|---|
| Serraria | 2 🪵 → 🪚 tábua | 1m30 | 1 |
| Olaria | 2 🟤 → 🧱 tijolo | 3 min | 6 |
| Vidraçaria | 2 🏖️ → 🪟 vidro | 4 min | 11 |
| Marcenaria | 2 🪚 + 1 🪟 → 🛋️ móveis | 10 min | 14 |
| Metalúrgica | 2 ⛏️ → 🔩 aço | 8 min | 21 |

## 4. Casas e evoluções

Cada casa **evolui no mesmo lote** (não precisa demolir), pagando materiais.

| Nv | Casa | Moradores | Aluguel | Materiais | Nível |
|---|---|---|---|---|---|
| 1 | Casinha de madeira | 2 | 5 🪙 / 2 min | 3 🪚 | 1 |
| 2 | Casa de alvenaria | 4 | 12 🪙 / 4 min | 4 🧱 + 2 🪚 | 6 |
| 3 | Sobrado | 6 | 25 🪙 / 8 min | 6 🧱 + 3 🪟 | 11 |
| 4 | Casa com piscina | 8 | 45 🪙 / 15 min | 5 🪟 + 2 🛋️ | 15 |
| 5 | Prédio pequeno | 16 | 90 🪙 / 30 min | 4 🔩 + 6 🪟 + 8 🧱 | 21 |
| 6 | Edifício | 30 | 180 🪙 / 1 h | 8 🔩 + 4 🛋️ | 28 |
| 7 | Arranha-céu | 60 | 400 🪙 / 2 h | 16 🔩 + 14 🪟 | 36 |

## 5. Comércio, serviços e decoração

- **Comércio** (exige população): Padaria (10 👥), Mercado (30), Loja de roupas (60), Shopping (150).
- **Serviços** (felicidade): Escola, Posto de saúde, Bombeiros, Hospital.
- **Decoração**: Árvore (+1 ⭐), Praça (+4), Fonte (+8).
- **Monumentos** (fim de jogo): Estádio, Aeroporto — projetos que pedem muitos materiais.

## 6. Fases da cidade

| Fase | Níveis | Novidades | Bairro novo |
|---|---|---|---|
| 🏡 Vilarejo | 1–5 | madeira, serraria, casinhas, pedidos simples, tutorial | Centro |
| 🏘️ Vila | 6–10 | barro, olaria, casas de alvenaria, padaria, praça | Residencial |
| 🏙️ Cidade pequena | 11–20 | areia, vidro, sobrados, mercado, escola, marcenaria | Comercial |
| 🌆 Cidade | 21–35 | ferro, aço, prédios, shopping, hospital | Zona industrial |
| 🌃 Metrópole | 36+ | arranha-céus, estádio, aeroporto | Beira-mar |

XP para passar ao próximo nível: `20 + 15 × (nível − 1)^1.4`
(1→2: 20 XP · 5→6: 124 · 10→11: 345 · 20→21: 945 · 35→36: 2.110).

## 7. Pedidos

- 3 a 6 cartões no quadro da Prefeitura, ex.: "Construtora: 4 🧱 + 2 🪟 → 120 🪙 + 15 XP".
- Pedidos são gerados com base no que o jogador já desbloqueou (sempre possíveis).
- Descartar um pedido → novo pedido depois de alguns minutos (ou na hora com anúncio).
- Recompensa extra ocasional: 🔨 martelo / 📐 trena (ampliar o armazém).

### Personagens dos pedidos
Cada pedido vem de um personagem com retrato ilustrado (estilo **Micah**, de Micah
Lanier, CC BY 4.0, gerado com DiceBear), com cenário e acessório da profissão, e fala
(PT/EN); pede principalmente itens ligados à profissão. Os retratos são SVGs estáticos
em `assets/characters/micah/<id>.svg`, gerados por `tools/citybloom/characters.mjs`
(raiz do repositório) — o jogo não depende de nada externo.

| Personagem | Profissão | Costuma pedir | Bônus |
|---|---|---|---|
| Beto | Construtor | tábua, tijolo, aço, madeira | pedidos um pouco maiores |
| Dona Lúcia | Lojista | móveis, vidro, tábua | +10% moedas |
| Sr. Ricardo | Empresário | qualquer coisa | pedidos maiores, +30% moedas |
| Profa. Ana | Professora | madeira, tábua, vidro | +40% XP |
| Chef Marco | Cozinheiro | madeira, tijolo, barro | +5% moedas, +10% XP |
| Júlia | Arquiteta | vidro, aço, móveis, tijolo | +15% moedas e XP |
| Seu Zé | Vizinho | madeira, barro, areia | pedidos pequenos |
| Rafa | Bombeira | aço, tijolo, vidro | +10% moedas, +20% XP |

Personagens diferentes aparecem ao mesmo tempo no quadro.

### Martelo e trena
Ao limpar obstáculos (35% de chance), cai o item que o jogador tem **menos** —
os dois são gastos juntos para ampliar o armazém, então nunca falta um deles.

### Prefeito Otávio (guia)
Personagem que acompanha o jogador (retrato Micah `assets/characters/micah/mayor.svg`,
com faixa de prefeito; `js/ui/mentor.js`):
- **Abertura**: boas-vindas → pergunta o nome da cidade → "conto com a sua ajuda para
  prosperar {cidade} e ajudar os nossos moradores". Save antigo: apresentação curta,
  uma vez (`state.mentor.intro`).
- **Subir de nível**: parabeniza (frase especial ao mudar de fase), mostra o que foi
  liberado (com miniaturas) e entrega o **presente do nível**.
- **Dicas**: a barra de objetivo mostra o rosto do prefeito.

### Presente de nível (`levelReward` em `config.js`)
- Moedas: `50 + 30·(nível−1)^1,3` (nível 2 ≈ 80, 10 ≈ 600, 20 ≈ 1.400) — **×2 ao mudar
  de fase**.
- Material da fase (matéria-prima + produto, 2–5 unidades): Vilarejo madeira/tábua,
  Vila barro/tijolo, Cidade pequena areia/vidro, Cidade ferro/aço, Metrópole aço/móveis.
- A cada 5 níveis: +1 🔨 e +1 📐.
- Aplicado dentro de `addXP` (toda ação que dá XP); itens que não cabem no armazém
  viram moedas (2× o valor).

### Baú diário (`DAILY` em `config.js`, `js/ui/daily.js`)
- Calendário de 7 dias (data local): moedas → madeira/tábua → moedas → material da
  fase → moedas → 🔨📐 → **dia 7: baú grande**. Moedas × (1 + 0,15·(nível−1)).
- Perdeu um dia → volta ao dia 1; depois do 7º recomeça.
- Depois de abrir, **baú extra por anúncio** (premiado `chest`), 1× por dia.
- Botão 🎁 no HUD com selo; abre sozinho ao entrar quando há baú.

## 8. Extras de experiência
- **Nome da cidade**: pedido ao começar; renomear tocando no nome (HUD) ou em ⚙️.
- **Tela de níveis**: tocar no nível mostra os 45 primeiros níveis por fase, XP de
  cada um, total acumulado e o que liberam.
- **Música de fundo "Bossa da Prefeitura"**: composição original escrita como dados
  (`js/game/songs.js`) e tocada com **instrumentos reais gravados** (violão nylon,
  flauta, piano, baixo acústico — soundfont FluidR3_GM, CC BY 3.0) pelo sampler
  `js/engine/sampler.js` (Web Audio, reverb, mixagem). As amostras (MP3 por nota, em
  `assets/instruments/`) só são baixadas após o 1º toque. Desligar e volume em ⚙️;
  pausa com a aba escondida. Créditos e licenças em ⚙️ → Créditos.

## 9. Monetização (sem custo para começar)

Anúncios via SDK do portal, isolados em `js/engine/ads.js`:

| Tipo | Quando | Recompensa |
|---|---|---|
| Premiado | botão "▶ terminar agora" numa produção | conclui na hora |
| Premiado | ao coletar aluguel | dobra as moedas |
| Premiado | baú diário | itens/moedas |
| Premiado | trocar pedido | pedido novo na hora |
| Intersticial | ao subir de **fase** (raro) | — |

Regra: nunca mostrar anúncio sem o jogador pedir, exceto o intersticial raro.

## 10. Técnica

- HTML5 Canvas + JavaScript puro (ES modules), **sem build e sem dependências**.
- Pasta autocontida (`games/citybloom/`) pronta para zipar e enviar aos portais.
- Visual isométrico **desenhado por código** (`js/engine/iso.js`): sem imagens, leve
  e com o mesmo visual em qualquer aparelho. Só retratos e amostras de música são
  arquivos (`assets/`, ver `assets/CREDITS.md`).
- Salvamento em `localStorage` (`citybloom.save.v2`) com horário de saída para o
  progresso offline.
- Modo vitrine para revisar o visual: `index.html?showcase=1`.
- Recomeçar o jogo do zero (teste): `index.html?reset=1`.

### Estrutura
```
index.html, css/style.css
js/main.js              liga tudo: toques, ações, painéis, nível, salvar
js/i18n.js              textos PT/EN
js/engine/camera.js     câmera (pan/zoom)
js/engine/input.js      toque/mouse: arrastar, tocar, pinça, roda
js/engine/iso.js        matemática isométrica
js/engine/ads.js        adaptador de anúncios (stub local)
js/engine/audio.js      sons gerados (Web Audio)
js/game/config.js       catálogo e números da economia (dados)
js/game/state.js        estado, mapa inicial, salvar/carregar (save v2)
js/game/economy.js      regras puras: lotes, fábricas, aluguel, construir,
                        quadras, obstáculos, pedidos, XP/níveis, dicas
js/render/kit.js        primitivas de desenho moderno (faces, vidro, telhados…)
js/render/buildings.js  desenho de cada construção + animações
js/render/terrain.js    grama, ruas, calçadas, lotes de produção, base do mapa
js/render/props.js      árvores, carros, postes, entulho, cercas
js/render/sprites.js    cache de sprites por faixa de zoom
js/render/traffic.js    trânsito animado
js/render/scene.js      monta o quadro em ordem de profundidade
js/ui/panels.js         painel de ações do item tocado
js/ui/build.js          menu de construção com miniaturas
js/ui/orders.js         quadro de pedidos
js/ui/fx.js             textos flutuantes e partículas
js/ui/levels.js         tela de níveis por fase
js/ui/settings.js       configurações (nome, música, efeitos, idioma)
js/render/avatars.js    retratos dos personagens dos pedidos (Micah)
js/ui/mentor.js         Prefeito Otávio: cartão com fala, presentes
js/ui/daily.js          baú diário (calendário de 7 dias + extra)
js/engine/music.js      música de fundo (tema, volume, preferências)
js/engine/sampler.js    toca músicas com amostras de instrumentos reais
js/game/songs.js        músicas compostas (dados: melodia, acordes, baixo)
assets/instruments/     amostras MP3 por nota (FluidR3_GM)
assets/characters/      retratos SVG (micah/ = jogo; lab/ = comparação)
lab.html                laboratório de músicas e estilos (fora do jogo)
```

## 11. Roteiro

1. ✅ **Fundação**: mapa isométrico, câmera, toque, HUD, PT/EN, salvamento, vitrine.
2. ✅ **Visual moderno**: todas as construções redesenhadas (vidro, sombras,
   telhados, varandas, letreiros), ruas com calçada e trânsito, lotes temáticos.
3. ✅ **Mecânica**: lotes, fábricas com fila, aluguel, evoluir casas, comércio,
   construir com posicionamento, quadras, obstáculos, pedidos, XP/níveis/fases,
   armazém, dicas de objetivo, progresso offline, sons e efeitos.
4. **Balanceamento e conteúdo**: ajustar tempos/preços com testes reais, eventos
   diários, baú diário (anúncio premiado), mais decorações.
5. **Lançamento**: integrar o SDK de anúncios do portal escolhido e publicar.
