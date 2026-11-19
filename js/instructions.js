// Instrucciones imprimibles: portada + una hoja por placa base.
import { COLOR_BY_ID, SUPPLIER, STORE, STUD_MM, num } from './catalog.js';
import { inkFor } from './color.js';
import { plateName } from './render.js';

// Número fijo por color: 1 = el color más usado.
export function numbering(counts) {
  const m = new Map();
  let i = 1;
  for (const id of counts.keys()) m.set(id, i++);
  return m;
}

export function plateCounts(mosaic, pr, pc) {
  const p = SUPPLIER.baseplate.studs;
  const m = new Map();
  for (let y = pr * p; y < Math.min((pr + 1) * p, mosaic.rows); y++) {
    for (let x = pc * p; x < Math.min((pc + 1) * p, mosaic.cols); x++) {
      const id = mosaic.cells[y * mosaic.cols + x];
      m.set(id, (m.get(id) || 0) + 1);
    }
  }
  return m;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function legend(counts, numbers) {
  return `<ol class="pr-legend">${[...counts].map(([id, n]) => {
    const c = COLOR_BY_ID.get(id);
    return `<li><span class="pr-chip" style="background:${c.hex};color:${inkFor(c.hex)}">${numbers.get(id)}</span>
      <span>${esc(c.name)}</span><b>${num(n)}</b></li>`;
  }).join('')}</ol>`;
}

export function buildPrintable({ mosaic, counts, previewUrl, orderId }) {
  const p = SUPPLIER.baseplate.studs;
  const pr = Math.ceil(mosaic.rows / p), pc = Math.ceil(mosaic.cols / p);
  const numbers = numbering(counts);
  const cm = (n) => ((n * STUD_MM) / 10).toFixed(1).replace('.0', '');

  let map = '<table class="pr-map">';
  for (let r = 0; r < pr; r++) {
    map += '<tr>';
    for (let c = 0; c < pc; c++) map += `<td>${plateName(r, c)}</td>`;
    map += '</tr>';
  }
  map += '</table>';

  let html = `<section class="pr-page pr-cover">
    <header><h1>${esc(STORE.name)} · Instrucciones de armado</h1>
    ${orderId ? `<p>Pedido ${esc(orderId)}</p>` : ''}</header>
    <div class="pr-cover-grid">
      <img src="${previewUrl}" alt="Vista previa del mosaico">
      <div>
        <h2>Tu mosaico</h2>
        <p>${mosaic.cols} × ${mosaic.rows} bloques · ${cm(mosaic.cols)} × ${cm(mosaic.rows)} cm ·
        ${num(mosaic.cols * mosaic.rows)} piezas · ${pr * pc} placas base</p>
        <h2>Cómo armarlo</h2>
        <ol class="pr-steps">
          <li>Acomoda las placas base como en el mapa: la <b>A1</b> va arriba a la izquierda.</li>
          <li>Separa las piezas por color. Cada color tiene un número (abajo).</li>
          <li>Arma una placa a la vez siguiendo su hoja: cada cuadrito dice qué número va ahí.</li>
          <li>Las líneas cada 4 cuadritos te ayudan a no perderte. Ve fila por fila.</li>
          <li>Al terminar, une las placas y cuelga tu mosaico.</li>
        </ol>
        <h2>Mapa de placas</h2>${map}
      </div>
    </div>
    <h2>Colores</h2>${legend(counts, numbers)}
  </section>`;

  for (let r = 0; r < pr; r++) {
    for (let c = 0; c < pc; c++) {
      let grid = '<table class="pr-grid"><tr><th></th>';
      for (let x = 0; x < p; x++) grid += `<th>${x + 1}</th>`;
      grid += '</tr>';
      for (let y = 0; y < p; y++) {
        grid += `<tr><th>${y + 1}</th>`;
        for (let x = 0; x < p; x++) {
          const gx = c * p + x, gy = r * p + y;
          if (gx >= mosaic.cols || gy >= mosaic.rows) { grid += '<td class="pr-empty"></td>'; continue; }
          const id = mosaic.cells[gy * mosaic.cols + gx];
          const hex = COLOR_BY_ID.get(id).hex;
          const cls = [(x + 1) % 4 === 0 && x < p - 1 ? 'pr-v' : '', (y + 1) % 4 === 0 && y < p - 1 ? 'pr-h' : ''].join(' ');
          grid += `<td class="${cls}" style="background:${hex};color:${inkFor(hex)}">${numbers.get(id)}</td>`;
        }
        grid += '</tr>';
      }
      grid += '</table>';
      const pcnt = new Map([...plateCounts(mosaic, r, c)].sort((a, b) => numbers.get(a[0]) - numbers.get(b[0])));
      html += `<section class="pr-page">
        <header><h1>Placa ${plateName(r, c)}</h1><p>Fila ${String.fromCharCode(65 + r)}, columna ${c + 1} de ${pc}</p></header>
        ${grid}
        <h2>Piezas de esta placa</h2>${legend(pcnt, numbers)}
      </section>`;
    }
  }
  return html;
}
