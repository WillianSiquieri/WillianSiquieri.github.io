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

## 8. Monetização (sem custo para começar)

Anúncios via SDK do portal, isolados em `js/engine/ads.js`:

| Tipo | Quando | Recompensa |
|---|---|---|
| Premiado | botão "▶ terminar agora" numa produção | conclui na hora |
| Premiado | ao coletar aluguel | dobra as moedas |
| Premiado | baú diário | itens/moedas |
| Premiado | trocar pedido | pedido novo na hora |
| Intersticial | ao subir de **fase** (raro) | — |

Regra: nunca mostrar anúncio sem o jogador pedir, exceto o intersticial raro.

## 9. Técnica

- HTML5 Canvas + JavaScript puro (ES modules), **sem build e sem dependências**.
- Pasta autocontida (`games/citybloom/`) pronta para zipar e enviar aos portais.
- Visual isométrico **desenhado por código** (`js/engine/iso.js`): sem imagens, leve
  e com o mesmo visual em qualquer aparelho.
- Salvamento em `localStorage` (`citybloom.save.v1`) com horário de saída para o
  progresso offline.
- Modo vitrine para revisar o visual: `index.html?showcase=1`.
- Recomeçar o jogo do zero (teste): `index.html?reset=1`.

### Estrutura
```
index.html, css/style.css
js/main.js            boot, render, HUD, painel de informações
js/i18n.js            textos PT/EN
js/engine/camera.js   câmera (pan/zoom)
js/engine/input.js    toque/mouse: arrastar, tocar, pinça, roda
js/engine/iso.js      projeção isométrica + desenho dos prédios
js/engine/ads.js      adaptador de anúncios (stub local)
js/game/config.js     catálogo: itens, lotes, prédios, fases (dados)
js/game/state.js      estado, mapa inicial, salvar/carregar
```

## 10. Roteiro

1. ✅ **Fundação**: mapa isométrico, lotes, obstáculos, prédios iniciais, câmera,
   toque com informações, HUD, PT/EN, salvamento, vitrine.
2. **Produção e coleta**: iniciar recurso no lote, timers, coletar, inventário,
   armazém com limite, progresso offline.
3. **Fábricas e casas**: filas de produção, construir/evoluir casas, aluguel.
4. **Pedidos e progresso**: quadro de pedidos, XP/níveis, fases, comprar lotes,
   limpar obstáculos, menu de construção.
5. **Polimento**: tutorial do Vilarejo, sons, animações de coleta, balanceamento.
6. **Lançamento**: integrar o SDK de anúncios do portal escolhido e publicar.
