// Dibuja el mosaico (vista previa realista) y las placas numeradas.
import { COLOR_BY_ID, SUPPLIER } from './catalog.js';
import { inkFor } from './color.js';

const GAP = '#232326';
const sprites = new Map();

function sprite(hex, s) {
  const key = hex + s;
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = GAP;
  g.fillRect(0, 0, s, s);
  const r = s * 0.47, m = s / 2;
  g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fillStyle = hex; g.fill();
  const hl = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.05, m, m, r);
  hl.addColorStop(0, 'rgba(255,255,255,0.38)');
  hl.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  hl.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = hl; g.fill();
  g.lineWidth = Math.max(1, s * 0.04);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.stroke();
  sprites.set(key, c);
  return c;
}

function fit(canvas, cols, rows, maxCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const stud = Math.max(4, Math.floor((maxCss * dpr) / Math.max(cols, rows)));
  canvas.width = cols * stud;
  canvas.height = rows * stud;
  canvas.style.aspectRatio = `${cols} / ${rows}`;
  return stud;
}

export function drawMosaic(canvas, mosaic, { maxCss = 720, plateGrid = false, highlight = null } = {}) {
  const { cols, rows, cells } = mosaic;
  const s = fit(canvas, cols, rows, maxCss);
  const g = canvas.getContext('2d');
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = cells[y * cols + x];
      g.globalAlpha = highlight === null || highlight === id ? 1 : 0.18;
      g.drawImage(sprite(COLOR_BY_ID.get(id).hex, s), x * s, y * s);
    }
  }
  g.globalAlpha = 1;
  if (plateGrid) {
    const p = SUPPLIER.baseplate.studs;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(2, s * 0.12);
    g.setLineDash([s * 0.6, s * 0.4]);
    for (let x = p; x < cols; x += p) line(g, x * s, 0, x * s, rows * s);
    for (let y = p; y < rows; y += p) line(g, 0, y * s, cols * s, y * s);
    g.setLineDash([]);
    g.font = `700 ${s * 1.6}px system-ui, sans-serif`;
    g.textBaseline = 'top';
    for (let py = 0; py * p < rows; py++) {
      for (let px = 0; px * p < cols; px++) {
        const label = plateName(py, px);
        const tx = px * p * s + s * 0.6, ty = py * p * s + s * 0.6;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        const w = g.measureText(label).width;
        roundRect(g, tx - s * 0.3, ty - s * 0.25, w + s * 0.6, s * 2.1, s * 0.4);
        g.fillStyle = '#fff';
        g.fillText(label, tx, ty);
      }
    }
  }
}

export function drawOriginal(canvas, img, sample, maxCss = 720) {
  const { cols, rows, source } = sample;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (maxCss * dpr) / Math.max(cols, rows);
  canvas.width = Math.round(cols * scale);
  canvas.height = Math.round(rows * scale);
  canvas.style.aspectRatio = `${cols} / ${rows}`;
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height);
}

// Una placa 16×16 con el número de color en cada bloque.
export function drawPlate(canvas, mosaic, pr, pc, numbers, maxCss = 720) {
  const p = SUPPLIER.baseplate.studs;
  const s = fit(canvas, p, p, maxCss);
  const g = canvas.getContext('2d');
  g.fillStyle = GAP;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(s * 0.36)}px system-ui, sans-serif`;
  for (let y = 0; y < p; y++) {
    for (let x = 0; x < p; x++) {
      const gx = pc * p + x, gy = pr * p + y;
      if (gx >= mosaic.cols || gy >= mosaic.rows) continue;
      const id = mosaic.cells[gy * mosaic.cols + gx];
      const hex = COLOR_BY_ID.get(id).hex;
      g.drawImage(sprite(hex, s), x * s, y * s);
      g.fillStyle = inkFor(hex);
      g.fillText(String(numbers.get(id)), x * s + s / 2, y * s + s / 2 + 1);
    }
  }
  // Guías cada 4 bloques para no perderse al armar.
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = Math.max(1, s * 0.04);
  for (let i = 4; i < p; i += 4) {
    line(g, i * s, 0, i * s, p * s);
    line(g, 0, i * s, p * s, i * s);
  }
}

export const plateName = (r, c) => `${String.fromCharCode(65 + r)}${c + 1}`;

function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
