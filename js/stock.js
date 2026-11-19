// Inventario en vivo: se vuelve a consultar cada STOCK_SOURCE.pollSeconds.
import { STOCK_SOURCE, STORE, COLORS, COLOR_BY_ID } from './catalog.js';
import { hexToRgb, rgbToLab, deltaE } from './color.js';

export async function fetchStock() {
  const sep = STOCK_SOURCE.url.includes('?') ? '&' : '?';
  const res = await fetch(`${STOCK_SOURCE.url}${sep}t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Inventario no disponible (${res.status})`);
  const text = await res.text();
  const levels = new Map();
  let updated = null, source = STOCK_SOURCE.url;
  if (text.trim().startsWith('{')) {
    const data = JSON.parse(text);
    updated = data.updated || null;
    source = data.source || source;
    for (const [id, n] of Object.entries(data.colors || {})) levels.set(Number(id), Number(n) || 0);
  } else {
    // CSV con encabezado: id,stock
    for (const row of text.trim().split(/\r?\n/).slice(1)) {
      const [id, n] = row.split(',');
      if (id) levels.set(Number(id), Number(n) || 0);
    }
  }
  return { levels, updated, source, checkedAt: new Date() };
}

const labs = new Map(COLORS.map((c) => [c.id, rgbToLab(...hexToRgb(c.hex))]));

const needWithSpare = (n) => Math.ceil(n * (1 + STORE.extraPiecesPct));

// Compara lo que pide el mosaico con el inventario y propone sustitutos.
export function analyze(counts, stock, disabled) {
  const rows = [];
  const issues = [];
  for (const [id, n] of counts) {
    const need = needWithSpare(n);
    const have = stock.levels.get(id) ?? 0;
    const status = have >= need ? 'ok' : 'short';
    rows.push({ id, count: n, need, have, status });
    if (status === 'short') issues.push({ id, count: n, need, have });
  }
  for (const issue of issues) {
    issue.options = COLORS
      .filter((c) => c.id !== issue.id && !disabled.has(c.id) && !issues.some((i) => i.id === c.id))
      .map((c) => {
        const already = counts.get(c.id) || 0;
        const have = stock.levels.get(c.id) ?? 0;
        return { id: c.id, d: deltaE(labs.get(issue.id), labs.get(c.id)), fits: have >= needWithSpare(already + issue.count) };
      })
      .filter((o) => o.fits)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
  }
  return { rows, issues };
}

export const colorName = (id) => COLOR_BY_ID.get(id).name;
