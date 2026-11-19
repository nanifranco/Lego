// Imagen → cuadrícula de colores del catálogo.
import { hexToRgb, rgbToLab, deltaE } from './color.js';

const K = 6; // sub-muestras por bloque para promediar (suaviza el resultado)

// Recorta la imagen al formato del mosaico y promedia cada bloque.
// crop.zoom ≥ 1; crop.x, crop.y ∈ [-1, 1] mueven el encuadre.
export function sampleImage(img, cols, rows, crop) {
  const ar = cols / rows;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let sw, sh;
  if (iw / ih > ar) { sh = ih; sw = sh * ar; } else { sw = iw; sh = sw / ar; }
  sw /= crop.zoom; sh /= crop.zoom;
  const mx = (iw - sw) / 2, my = (ih - sh) / 2;
  const sx = mx + crop.x * mx, sy = my + crop.y * my;

  const w = cols * K, h = rows * K;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const out = new Float32Array(cols * rows * 3);
  const n = K * K;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < K; dy++) {
        let i = ((y * K + dy) * w + x * K) * 4;
        for (let dx = 0; dx < K; dx++, i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      }
      const o = (y * cols + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { cols, rows, rgb: out, source: { sx, sy, sw, sh } };
}

// Brillo, contraste y saturación en −100…100.
export function adjust(rgb, { brightness, contrast, saturation }) {
  const out = new Float32Array(rgb.length);
  const b = brightness * 1.5;
  const c = contrast * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const s = 1 + saturation / 100;
  for (let i = 0; i < rgb.length; i += 3) {
    let r = rgb[i] + b, g = rgb[i + 1] + b, bl = rgb[i + 2] + b;
    r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; bl = cf * (bl - 128) + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
    out[i] = clamp(gray + (r - gray) * s);
    out[i + 1] = clamp(gray + (g - gray) * s);
    out[i + 2] = clamp(gray + (bl - gray) * s);
  }
  return out;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function preparePalette(colors) {
  return colors.map((c) => {
    const rgb = hexToRgb(c.hex);
    return { id: c.id, rgb, lab: rgbToLab(...rgb) };
  });
}

// Devuelve un Int16Array con el id de color de cada bloque.
export function quantize(rgb, cols, rows, palette, dither) {
  const cells = new Int16Array(cols * rows);
  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let p = cache.get(key);
    if (p) return p;
    const lab = rgbToLab(r, g, b);
    let best = palette[0], bd = Infinity;
    for (const c of palette) {
      const d = deltaE(lab, c.lab);
      if (d < bd) { bd = d; best = c; }
    }
    cache.set(key, best);
    return best;
  };

  const buf = dither ? Float32Array.from(rgb) : rgb;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 3;
      const r = clamp(buf[i]) | 0, g = clamp(buf[i + 1]) | 0, b = clamp(buf[i + 2]) | 0;
      const p = nearest(r, g, b);
      cells[y * cols + x] = p.id;
      if (dither) {
        const er = r - p.rgb[0], eg = g - p.rgb[1], eb = b - p.rgb[2];
        spread(buf, cols, rows, x + 1, y, er, eg, eb, 7 / 16);
        spread(buf, cols, rows, x - 1, y + 1, er, eg, eb, 3 / 16);
        spread(buf, cols, rows, x, y + 1, er, eg, eb, 5 / 16);
        spread(buf, cols, rows, x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  }
  return cells;
}

function spread(buf, cols, rows, x, y, er, eg, eb, k) {
  if (x < 0 || x >= cols || y >= rows) return;
  const i = (y * cols + x) * 3;
  buf[i] += er * k; buf[i + 1] += eg * k; buf[i + 2] += eb * k;
}

export function applySubs(cells, subs) {
  const keys = Object.keys(subs);
  if (!keys.length) return cells;
  const map = new Map(keys.map((k) => [Number(k), subs[k]]));
  for (let i = 0; i < cells.length; i++) {
    const t = map.get(cells[i]);
    if (t !== undefined) cells[i] = t;
  }
  return cells;
}

export function countColors(cells) {
  const m = new Map();
  for (const id of cells) m.set(id, (m.get(id) || 0) + 1);
  return new Map([...m].sort((a, b) => b[1] - a[1]));
}
