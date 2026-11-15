// ads.js — adaptador de anúncios. O resto do jogo só conhece esta interface:
//   ads.rewarded(placement) -> Promise<boolean>  (true = assistiu até o fim)
//   ads.interstitial()      -> Promise<void>
// Hoje é um "stub" local (não mostra anúncio nenhum). Quando escolhermos o
// portal, basta implementar o provedor aqui (GameDistribution: window.gdsdk;
// CrazyGames: window.CrazyGames.SDK) sem mexer no restante do código.
//
// Pontos de anúncio previstos (placements):
//   'speedup'  — terminar produção agora
//   'double'   — dobrar aluguel coletado
//   'chest'    — baú diário
//   'reroll'   — trocar um pedido
//   interstitial — só ao subir de fase/nível

function detectProvider() {
  if (window.CrazyGames && window.CrazyGames.SDK) return 'crazygames';
  if (window.gdsdk) return 'gamedistribution';
  return 'local';
}

export const ads = {
  provider: 'local',

  init() {
    this.provider = detectProvider();
    return Promise.resolve();
  },

  async rewarded(placement) {
    if (this.provider === 'local') {
      console.info(`[ads] rewarded "${placement}" (stub local: concedido)`);
      return true;
    }
    // TODO: chamar o SDK do portal escolhido.
    return false;
  },

  async interstitial() {
    if (this.provider === 'local') {
      console.info('[ads] interstitial (stub local)');
    }
    // TODO: chamar o SDK do portal escolhido.
  },
};
