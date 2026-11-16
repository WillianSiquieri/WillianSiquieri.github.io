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
