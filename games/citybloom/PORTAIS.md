# CityBloom — publicar nos portais de jogos (grátis, com anúncios)

Guia para enviar o CityBloom aos portais **GameDistribution** e **CrazyGames** e ganhar
com os anúncios. Os dois são grátis. Termos, percentuais e valor mínimo de saque mudam
com o tempo, então confira na página de cada portal ao se cadastrar.

## O que já está pronto
- **Visual 3D** low-poly: modelos Kenney (CC0) e ícones Fluent Emoji (MIT). Cada construção
  tem modelo, cor e placa próprios.
- **Entra direto no jogo**, sem tela que bloqueia. O Prefeito cumprimenta num balão e a
  mão do tutorial aponta cada passo (pode pular). Depois disso aparecem as **missões com
  prêmio**.
- **Começo rápido:** nos primeiros níveis os tempos são bem curtos.
- **Anúncios integrados** (`js/engine/ads.js`):
  - os premiados (terminar já, dobrar aluguel, baú extra, novo pedido) **sempre têm uma
    alternativa em moedas**;
  - sem anúncio disponível (bloqueador ou fase *Basic Launch*), o botão de vídeo some;
  - o intersticial só aparece ao mudar de fase.
- **SDK do CrazyGames:**
  - o progresso é salvo na conta do jogador (Data module);
  - o idioma vem do portal;
  - o carregamento e a partida são avisados ao SDK.
- **Durante o anúncio** a música e os sons ficam em silêncio. No iPhone o som volta no
  próximo toque.
- **Pacote:** cerca de 3 MB compactado, cerca de 300 arquivos. Funciona em telas pequenas
  (821×462, 800×450) e no celular.
- **Pacotes .zip**, um por portal, gerados por `tools/citybloom/build-portal.mjs`.
- **Imagens e vídeos** na pasta `marketing/`. As capas têm **só o nome do jogo** (regra
  do CrazyGames).

| Arquivo | Uso |
|---|---|
| `cover-1920x1080.jpg` | capa horizontal 16:9 (obrigatória no CrazyGames) |
| `cover-portrait-800x1200.jpg` | capa vertical 2:3 (obrigatória) |
| `cover-square-800x800.jpg` | capa quadrada 1:1 (obrigatória) |
| `cover-1280x720.jpg`, `cover-800x450.jpg`, `cover-512x384.jpg` | capas menores (GameDistribution pede 512×384) |
| `icon-512x512.png` | ícone (GameDistribution pede 512×512) |
| `video-landscape-1920x1080.mp4` | vídeo de prévia horizontal (começa pela capa, ~19 s, sem som) |
| `video-portrait-1080x1620.mp4` | vídeo de prévia vertical 2:3 |
| `screen-1-cidade.jpg` … `screen-4-bau.jpg` | capturas do jogo |

## Passo a passo — GameDistribution (o mais fácil de aceitar)
1. Acesse **gamedistribution.com**, clique em *Developers* e crie a conta, que é grátis.
2. No painel, clique em **Upload new game** / **Add game**.
3. Preencha:
   - nome: CityBloom;
   - descrição (abaixo);
   - categoria: *Simulation* (ou *Casual*);
   - tags;
   - controles;
   - imagens da pasta `marketing/`.
4. O painel mostra o **Game ID** do jogo, um código longo. Envie esse código ao Claude
   para gerar o .zip final, ou rode:
   `node tools/citybloom/build-portal.mjs dist --gd-id=SEU_GAME_ID`
5. Envie o arquivo `citybloom-gamedistribution.zip` e mande para revisão
   (*Submit for review*).
6. Em *Account / Payments*, cadastre os dados para receber.

## Passo a passo — CrazyGames
1. Acesse **developer.crazygames.com** e crie a conta, que é grátis.
2. Clique em **Submit a game**.
3. Envie o `citybloom-crazygames.zip`. Esse pacote não precisa de ID.
4. Preencha nome, descrição, categoria (*Simulation*), tags, controles, capas e
   capturas.
5. O jogo passa por uma revisão técnica e depois por uma **fase de teste** com poucos
   jogadores. Se os jogadores ficarem bastante tempo, ele é liberado para todo o
   público.
6. Cadastre os dados de pagamento no painel.

## Textos para colar

**Nome:** CityBloom

**Descrição curta (PT):** Construa sua cidade, produza materiais, atenda os pedidos dos
moradores e faça a cidade florescer de vilarejo a metrópole!

**Short description (EN):** Build your city, produce materials, fulfil residents' orders
and help it bloom from a tiny hamlet into a metropolis!

**Descrição longa (PT):**
O Prefeito Otávio conta com você! Em CityBloom você transforma um vilarejo numa
metrópole cheia de vida. Colha madeira, barro, areia e ferro nos lotes de produção,
transforme tudo em tábuas, tijolos, vidro, móveis e aço nas fábricas e use os materiais
para construir casas, comércios, serviços e monumentos. Atenda os pedidos dos moradores
— o construtor Beto, a lojista Dona Lúcia, o Chef Marco e muitos outros — para ganhar
moedas e experiência. Evolua as casas, compre novas quadras, deixe os moradores felizes
e passe pelas fases Vilarejo, Vila, Cidade pequena, Cidade e Metrópole. Abra o baú
diário, receba presentes a cada nível e jogue no seu ritmo: o progresso continua mesmo
com o jogo fechado!

**Long description (EN):**
Mayor Otávio is counting on you! In CityBloom you turn a tiny hamlet into a thriving
metropolis. Harvest wood, clay, sand and iron on production lots, turn them into planks,
bricks, glass, furniture and steel at the factories, and use them to build homes, shops,
services and landmarks. Fulfil orders from the residents — Beto the builder, Mrs. Lúcia
the shopkeeper, Chef Marco and many more — to earn coins and XP. Upgrade houses, buy new
blocks, keep residents happy and grow through the Hamlet, Village, Small town, City and
Metropolis stages. Open the daily chest, get a gift every level and play at your own
pace: your city keeps producing even while you're away!

**Controles / Controls:**
- Celular: tocar para selecionar e coletar; arrastar para mover o mapa; pinça para zoom.
- PC: clicar para selecionar e coletar; arrastar para mover; roda do mouse para zoom.
- Mobile: tap to select/collect · drag to pan · pinch to zoom.
- PC: click to select/collect · drag to pan · mouse wheel to zoom.

**Tags:** city builder, farm, simulation, idle, casual, building, town, management,
cozy, isometric

**Idiomas:** Português, English (troca no botão EN/PT)

**Plataformas:** celular e computador (HTML5)

## Gerar os pacotes de novo
```
node tools/citybloom/build-portal.mjs dist --gd-id=SEU_GAME_ID
```
O comando gera `dist/citybloom-crazygames.zip` e `dist/citybloom-gamedistribution.zip`,
com o `index.html` na raiz. Os pacotes ficam sem:
- o laboratório;
- os documentos;
- os retratos de teste;
- os instrumentos que a música do jogo não usa.

No GitHub Pages o jogo continua em modo `local`, sem anúncio de verdade.
