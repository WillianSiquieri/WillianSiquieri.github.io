// Gerador mock: simula peças chegando, para exercitar o pipeline sem Telegram.
//
// IMPORTANTE: só roda com a flag explícita `--mock`. Já houve um episódio em que
// o mock rodou em produção por 6 semanas (sem fonte configurada, o ciclo caía nele
// automaticamente) e encheu a fila com 513 peças inexistentes. Fonte de verdade
// nunca é inventada: sem fonte real configurada, o ciclo não gera nada.
const CATALOG = [
  { caption: 'Vestido midi floral, tecido viscose, tam M. R$ 79,90', seed: 'vestido' },
  { caption: 'Blusa cropped canelada branca, tam P/M. 49,90', seed: 'blusa' },
  { caption: 'Calça jeans wide leg, cintura alta, tam 40. R$ 119,90', seed: 'jeans' },
  { caption: 'Conjunto tricot bege (blusa + saia), único. R$ 139,90', seed: 'tricot' },
  { caption: 'Jaqueta jeans oversized, tam G. 149,90', seed: 'jaqueta' },
];

export function fetchMessages({ count = 3 } = {}) {
  const now = Date.now();
  return CATALOG.slice(0, count).map((c, i) => ({
    messageId: `mock_${now}_${i}`,
    from: '5511999990001',
    senderName: 'Fornecedora Demo',
    caption: c.caption,
    images: [placeholderImage(c.seed, i)],
    receivedAt: new Date(now - i * 60000).toISOString(),
  }));
}

// Placeholder autossuficiente (data URI SVG) — não depende de rede.
function placeholderImage(seed, i) {
  const hues = [340, 210, 40, 160, 280];
  const h = hues[i % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <rect width="1080" height="1350" fill="hsl(${h},60%,88%)"/>
  <rect x="60" y="60" width="960" height="1230" rx="40" fill="hsl(${h},55%,78%)"/>
  <text x="540" y="700" font-family="sans-serif" font-size="90" font-weight="bold"
    fill="hsl(${h},45%,32%)" text-anchor="middle">${seed}</text>
  <text x="540" y="800" font-family="sans-serif" font-size="42"
    fill="hsl(${h},35%,42%)" text-anchor="middle">foto de exemplo</text>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
