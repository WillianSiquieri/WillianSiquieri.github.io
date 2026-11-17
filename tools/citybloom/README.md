# Ferramentas do CityBloom (não fazem parte do jogo publicado)

Scripts que geram os cartões de personagem em `games/citybloom/assets/characters/`.

```bash
cd tools/citybloom
npm init -y && npm install @dicebear/core@9.4.2 @dicebear/avataaars@9.4.2 \
  @dicebear/personas@9.4.2 @dicebear/micah@9.4.2
node gen.mjs       # avatares da biblioteca → assets/characters/raw/*.svg
node compose.mjs   # cenários + acessórios + ilustração própria → assets/characters/lab/<estilo>/*.svg
```

As amostras de instrumentos (`games/citybloom/assets/instruments/`) foram baixadas de
`gleitz/midi-js-soundfonts` (FluidR3_GM), só as notas usadas em `js/game/songs.js`.

## Pacotes para portais

```bash
node tools/citybloom/build-portal.mjs dist --gd-id=SEU_GAME_ID
```
Gera `dist/citybloom-crazygames.zip` e `dist/citybloom-gamedistribution.zip` (sem
laboratório, documentos, retratos de teste e instrumentos não usados). Ver
`games/citybloom/PORTAIS.md`.

## Personagens Micah e Prefeito

`characters.mjs` gera `assets/characters/micah/<id>.svg` (clientes e `mayor.svg`) e
`mayor-full.svg` (prefeito de corpo inteiro).

## Vídeos de prévia (portais)
`tools/citybloom/video/rec.cjs` grava o vídeo de prévia quadro a quadro com o Playwright. O relógio da página é falso (`page.clock`), então a gravação fica lisa mesmo com a máquina lenta. O roteiro está em `director.js`: coletar aluguel e lotes → construir uma casa → entregar um pedido → o Prefeito comemora o nível.

Precisa de um servidor na raiz do repositório (`python3 -m http.server 8099`) e do `ffmpeg`.
```
node tools/citybloom/video/rec.cjs 1280 720 1.5 1.8 citybloom-landscape     # 1920×1080
node tools/citybloom/video/rec.cjs 540 810 2 1.35 citybloom-portrait-2x3    # 1080×1620
node tools/citybloom/video/rec.cjs 540 960 2 1.35 citybloom-portrait-9x16   # 1080×1920
```
Argumentos: largura e altura em px CSS, escala, zoom da câmera e nome. O `.mp4` sai na mesma pasta do script. Com `--stills=1,5,9` só grava fotos nesses segundos, para revisar o roteiro.
