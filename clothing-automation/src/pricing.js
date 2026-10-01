// Lógica de preço: extrai o preço que a fornecedora mandou no WhatsApp e aplica
// o "spread" (margem) configurável em percentual, com opção de arredondamento.

const round2 = (v) => Math.round(v * 100) / 100;

// Extrai o primeiro valor monetário de um texto em português.
// Aceita "R$ 79,90", "r$79", "79,90", "89.90", "1.299,90".
export function parsePrice(text = '') {
  const s = String(text);
  // Preferimos valores marcados com R$; depois qualquer número com vírgula decimal.
  const patterns = [
    /r\$\s*([\d.]+,\d{2})/i,
    /r\$\s*([\d.]+)/i,
    /(\d{1,3}(?:\.\d{3})+,\d{2})/, // 1.299,90
    /(\d+,\d{2})/, // 79,90
    /(\d+\.\d{2})(?!\d)/, // 79.90
    /(\d{2,4})(?!\S)/, // 79 (número solto, último recurso)
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const val = brToNumber(m[1]);
      if (Number.isFinite(val) && val > 0) return val;
    }
  }
  return null;
}

// "1.299,90" -> 1299.90 ; "79.90" -> 79.90 ; "79,90" -> 79.90
function brToNumber(raw) {
  let s = String(raw).trim();
  if (s.includes(',')) {
    // vírgula é o separador decimal; ponto é milhar.
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s);
}

// Aplica o spread percentual sobre o preço base e arredonda.
export function applySpread(base, spreadPercent = 0, rounding = 'psychological') {
  const raw = Number(base) * (1 + Number(spreadPercent || 0) / 100);
  return roundPrice(raw, rounding);
}

// Modos de arredondamento:
//   none          -> 2 casas exatas
//   integer       -> inteiro mais próximo
//   psychological  -> termina em ,90 (sobe para o próximo x9,90 quando preciso)
export function roundPrice(v, mode = 'psychological') {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  if (mode === 'none') return round2(v);
  if (mode === 'integer') return Math.round(v);
  // psychological
  const floorInt = Math.floor(v);
  let cand = floorInt + 0.9;
  if (cand < v) cand = floorInt + 1 + 0.9;
  return round2(cand);
}

export function formatBRL(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
