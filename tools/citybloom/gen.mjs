import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import * as personas from '@dicebear/personas';
import * as micah from '@dicebear/micah';
import fs from 'fs';
const out = new URL('../../games/citybloom/assets/characters/raw', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const C = {
  builder: {
    avataaars: { top: ['shortFlat'], facialHair: ['moustacheFancy'], facialHairProbability: 100, facialHairColor: ['4a312c'], hairColor: ['4a312c'], clothing: ['overall'], clothesColor: ['f08a24'], skinColor: ['d08b5b'], mouth: ['smile'], eyes: ['happy'], eyebrows: ['defaultNatural'], accessoriesProbability: 0 },
    personas: { hair: ['shortCombover'], facialHair: ['walrus'], facialHairProbability: 100, body: ['squared'], clothingColor: ['f08a24'], skinColor: ['d78774'], hairColor: ['3b2a1e'], mouth: ['bigSmile'], eyes: ['happy'], nose: ['mediumRound'] },
    micah: { hair: ['dougFunny'], facialHair: ['scruff'], facialHairProbability: 100, shirt: ['collared'], shirtColor: ['f08a24'], baseColor: ['ac6651'], hairColor: ['3b2a1e'], facialHairColor: ['3b2a1e'], mouth: ['laughing'], eyes: ['smiling'], glassesProbability: 0, earringsProbability: 0 },
  },
  shop: {
    avataaars: { top: ['bun'], hairColor: ['724133'], clothing: ['shirtScoopNeck'], clothesColor: ['2a9d8f'], skinColor: ['edb98a'], mouth: ['smile'], eyes: ['default'], eyebrows: ['defaultNatural'], facialHairProbability: 0, accessoriesProbability: 0 },
    personas: { hair: ['curlyBun'], body: ['rounded'], clothingColor: ['2a9d8f'], skinColor: ['eeb4a4'], hairColor: ['6b3e26'], mouth: ['smile'], eyes: ['open'], nose: ['smallRound'], facialHairProbability: 0 },
    micah: { hair: ['full'], shirt: ['crew'], shirtColor: ['2a9d8f'], baseColor: ['f9c9b6'], hairColor: ['6b3e26'], mouth: ['smile'], eyes: ['eyes'], eyebrows: ['eyelashesUp'], earrings: ['hoop'], earringsProbability: 100, earringColor: ['f5b301'], facialHairProbability: 0, glassesProbability: 0 },
  },
  chef: {
    avataaars: { top: ['shortRound'], hairColor: ['2c1b18'], facialHair: ['moustacheMagnum'], facialHairProbability: 100, facialHairColor: ['2c1b18'], clothing: ['shirtCrewNeck'], clothesColor: ['ffffff'], skinColor: ['edb98a'], mouth: ['twinkle'], eyes: ['happy'], eyebrows: ['raisedExcitedNatural'], accessoriesProbability: 0 },
    personas: { hair: ['fade'], facialHair: ['walrus'], facialHairProbability: 100, body: ['rounded'], clothingColor: ['f4f4f4'], skinColor: ['e5a07e'], hairColor: ['2c1b18'], mouth: ['smile'], eyes: ['happy'], nose: ['wrinkles'] },
    micah: { hair: ['mrClean'], facialHair: ['beard'], facialHairProbability: 100, shirt: ['crew'], shirtColor: ['ffffff'], baseColor: ['f9c9b6'], facialHairColor: ['2c1b18'], mouth: ['smirk'], eyes: ['smiling'], glassesProbability: 0, earringsProbability: 0 },
  },
};
const styles = { avataaars, personas, micah };
for (const [who, byStyle] of Object.entries(C)) for (const [st, opts] of Object.entries(byStyle)) {
  const svg = createAvatar(styles[st], { seed: who, backgroundColor: ['transparent'], ...opts }).toString();
  fs.writeFileSync(`${out}/${who}-${st}.svg`, svg);
}
console.log(fs.readdirSync(out).join(' '));
