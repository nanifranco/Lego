import {
  STORE, SUPPLIER, STOCK_SOURCE, COLORS, COLOR_BY_ID, SIZES, STUD_MM,
  quote, supplierCost, platesFor, money, num,
} from './catalog.js';
import { sampleImage, adjust, preparePalette, quantize, applySubs, countColors } from './mosaic.js';
import { drawMosaic, drawOriginal, drawPlate, plateName } from './render.js';
import { fetchStock, analyze } from './stock.js';
import { closeness, inkFor } from './color.js';
import { numbering, plateCounts, buildPrintable } from './instructions.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DEFAULT_ADJ = { brightness: 0, contrast: 0, saturation: 0 };
const state = {
  img: null,
  sizeId: 'm',
  crop: { zoom: 1, x: 0, y: 0 },
  adj: { ...DEFAULT_ADJ },
  dither: false,
  disabled: new Set(),
  subs: {},            // { idOriginal: idSustituto } aceptados por el usuario
  choice: {},          // sustituto elegido (aún sin aceptar) por color
  sample: null,
  mosaic: null,
  counts: new Map(),
  stock: null,
  stockError: null,
  analysis: null,
  step: 1,
  view: 'mosaic',
  plateGrid: false,
  plate: { r: 0, c: 0 },
  highlight: null,
  order: null,
  admin: new URLSearchParams(location.search).has('admin'),
};

const canvas = $('#stageCanvas');
const size = () => SIZES.find((s) => s.id === state.sizeId);
const cm = (n) => ((n * STUD_MM) / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 });

// ── Arranque ─────────────────────────────────────────────────
$$('[data-store-name]').forEach((el) => (el.textContent = STORE.name));
document.title = `${STORE.name} · Mosaicos de bloques`;
renderSizes();
renderPalette();
goto(1);
refreshStock();
setInterval(() => { if (state.step === 3 || state.step === 4) refreshStock(); }, STOCK_SOURCE.pollSeconds * 1000);
setInterval(updateLiveAge, 1000);

// ── Imagen ───────────────────────────────────────────────────
$$('[data-file]').forEach((input) => input.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadFile(file);
  e.target.value = '';
}));

const drop = $('#dropZone');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('dragging'); }));
drop.addEventListener('drop', (e) => {
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) loadFile(file);
});

function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => setImage(img);
  img.onerror = () => toast('No pudimos abrir esa imagen. Prueba con JPG o PNG.');
  img.src = url;
}

$('#sampleBtn').addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = c.height = 600;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#1d3b72'); sky.addColorStop(0.55, '#f08a4b'); sky.addColorStop(1, '#ffd27a');
  g.fillStyle = sky; g.fillRect(0, 0, 600, 600);
  g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(300, 330, 95, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1f3d';
  g.beginPath(); g.moveTo(0, 600); g.lineTo(0, 420); g.lineTo(140, 330); g.lineTo(260, 440);
  g.lineTo(380, 360); g.lineTo(600, 470); g.lineTo(600, 600); g.fill();
  g.fillStyle = '#184632';
  g.beginPath(); g.moveTo(0, 600); g.lineTo(0, 500); g.quadraticCurveTo(300, 430, 600, 520); g.lineTo(600, 600); g.fill();
  const img = new Image();
  img.onload = () => setImage(img);
  img.src = c.toDataURL('image/png');
});

function setImage(img) {
  state.img = img;
  state.crop = { zoom: 1, x: 0, y: 0 };
  $$('[data-crop]').forEach((el) => (el.value = state.crop[el.dataset.crop]));
  state.subs = {};
  state.choice = {};
  $('#emptyState').hidden = true;
  canvas.hidden = false;
  $('#stageBar').hidden = false;
  resample();
  goto(2);
}

// ── Diseño ───────────────────────────────────────────────────
function renderSizes() {
  $('#sizes').innerHTML = SIZES.map((s) => {
    const q = quote(s.cols, s.rows);
    return `<button type="button" role="radio" class="size" data-size="${s.id}" aria-checked="${s.id === state.sizeId}">
      <span class="size-shape" style="aspect-ratio:${s.cols}/${s.rows}"></span>
      <span class="size-name">${s.name}</span>
      <span class="size-dim">${cm(s.cols)} × ${cm(s.rows)} cm</span>
      <span class="size-meta">${s.cols}×${s.rows} · ${platesFor(s.cols, s.rows)} placas</span>
      <span class="size-price">${money(q.subtotal)}</span>
    </button>`;
  }).join('');
}

$('#sizes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]');
  if (!b) return;
  state.sizeId = b.dataset.size;
  state.plate = { r: 0, c: 0 };
  $$('[data-size]').forEach((el) => el.setAttribute('aria-checked', el === b));
  resample();
});

$$('[data-crop]').forEach((el) => el.addEventListener('input', () => {
  state.crop[el.dataset.crop] = Number(el.value);
  schedule(resample);
}));
$$('[data-adj]').forEach((el) => el.addEventListener('input', () => {
  state.adj[el.dataset.adj] = Number(el.value);
  schedule(regen);
}));
$('#dither').addEventListener('change', (e) => { state.dither = e.target.checked; regen(); });
$('#resetAdj').addEventListener('click', () => {
  state.adj = { ...DEFAULT_ADJ };
  $$('[data-adj]').forEach((el) => (el.value = 0));
  state.dither = false; $('#dither').checked = false;
  regen();
});

function renderPalette() {
  $('#palette').innerHTML = COLORS.map((c) => {
    const off = state.disabled.has(c.id);
    const have = state.stock?.levels.get(c.id);
    const out = state.stock && !have;
    return `<button type="button" class="swatch${off ? ' off' : ''}${out ? ' out' : ''}" data-color="${c.id}"
      style="--c:${c.hex}" aria-pressed="${!off}" title="${esc(c.name)}${out ? ' · agotado' : ''}">
      <span></span><small>${esc(c.name)}</small></button>`;
  }).join('');
  const active = COLORS.length - state.disabled.size;
  $('#paletteCount').textContent = `· ${active} de ${COLORS.length}`;
}

$('#palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  const id = Number(b.dataset.color);
  if (state.disabled.has(id)) state.disabled.delete(id);
  else if (COLORS.length - state.disabled.size > 2) state.disabled.add(id);
  renderPalette();
  regen();
});

// ── Generar mosaico ──────────────────────────────────────────
let pending = 0;
function schedule(fn) {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(fn);
}

function resample() {
  if (!state.img) return;
  const s = size();
  state.sample = sampleImage(state.img, s.cols, s.rows, state.crop);
  regen();
}

function regen() {
  if (!state.sample) return;
  const { cols, rows, rgb } = state.sample;
  const palette = preparePalette(COLORS.filter((c) => !state.disabled.has(c.id)));
  const cells = quantize(adjust(rgb, state.adj), cols, rows, palette, state.dither);
  applySubs(cells, state.subs);
  state.mosaic = { cols, rows, cells };
  state.counts = countColors(cells);
  state.order = null;
  runAnalysis();
  draw();
  updateMeta();
  if (state.step === 3) renderInventory();
  if (state.step === 4) renderOrder();
  if (state.step === 5) renderInstructions();
}

function draw() {
  if (!state.mosaic) return;
  const maxCss = Math.min(760, $('.stage-frame').clientWidth || 600);
  if (state.step === 5) {
    drawPlate(canvas, state.mosaic, state.plate.r, state.plate.c, numbering(state.counts), maxCss);
  } else if (state.view === 'original') {
    drawOriginal(canvas, state.img, state.sample, maxCss);
  } else {
    drawMosaic(canvas, state.mosaic, { maxCss, plateGrid: state.plateGrid, highlight: state.highlight });
  }
}
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(draw, 150); });

$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  draw();
}));
$('#plateGrid').addEventListener('change', (e) => { state.plateGrid = e.target.checked; draw(); });

function updateMeta() {
  const s = size();
  const q = quote(s.cols, s.rows);
  $('#stageMeta').innerHTML = `<b>${cm(s.cols)} × ${cm(s.rows)} cm</b> · ${num(q.pieces)} piezas · ${state.counts.size} colores · ${q.plates} placas`;
  const pill = $('#pricePill');
  pill.hidden = false;
  pill.textContent = money(q.subtotal);
}

// ── Inventario en vivo y sustituciones ───────────────────────
async function refreshStock() {
  try {
    state.stock = await fetchStock();
    state.stockError = null;
  } catch (err) {
    state.stockError = err.message;
  }
  renderPalette();
  runAnalysis();
  if (state.step === 3) renderInventory();
  if (state.step === 4) renderOrder();
  updateLiveAge();
}

function runAnalysis() {
  state.analysis = state.stock && state.mosaic ? analyze(state.counts, state.stock, state.disabled) : null;
}

function updateLiveAge() {
  const el = $('#liveStatus');
  if (!el.querySelector('#refreshNow')) {
    el.innerHTML = '<span class="dot"></span><span class="live-text"></span><button type="button" class="link" id="refreshNow">Revisar ya</button>';
  }
  const text = el.querySelector('.live-text');
  if (state.stockError) {
    el.className = 'live error';
    text.textContent = `${state.stockError}. Reintentando…`;
    return;
  }
  if (!state.stock) { text.textContent = 'Consultando inventario…'; return; }
  const secs = Math.round((Date.now() - state.stock.checkedAt) / 1000);
  el.className = 'live';
  text.textContent = `Inventario en vivo · revisado ${secs < 5 ? 'justo ahora' : `hace ${secs} s`}`;
}
$('#liveStatus').addEventListener('click', (e) => { if (e.target.id === 'refreshNow') refreshStock(); });

function swatch(id) {
  const c = COLOR_BY_ID.get(id);
  return `<span class="sw" style="--c:${c.hex}"></span>`;
}

function renderInventory() {
  const a = state.analysis;
  const issuesEl = $('#issues');
  if (!a) {
    issuesEl.innerHTML = '';
    $('#colorTable').innerHTML = '';
    return;
  }
  const applied = Object.entries(state.subs);
  let html = '';
  if (a.issues.length) {
    html += `<div class="notice warn"><b>${a.issues.length === 1 ? 'Falta 1 color' : `Faltan ${a.issues.length} colores`}</b>
      en el inventario del proveedor. Te proponemos el más parecido que sí hay.</div>`;
    for (const it of a.issues) {
      const c = COLOR_BY_ID.get(it.id);
      if (!it.options.length) {
        html += `<div class="sub-card" data-hl="${it.id}"><div class="sub-row">${swatch(it.id)}<div><b>${esc(c.name)}</b>
          <small>Necesitas ${num(it.need)} · hay ${num(it.have)}</small></div></div>
          <p class="muted small">No hay un sustituto con suficiente inventario. Prueba un tamaño más chico.</p></div>`;
        continue;
      }
      const pick = state.choice[it.id] ?? it.options[0].id;
      const opt = it.options.find((o) => o.id === pick) || it.options[0];
      const near = closeness(opt.d);
      html += `<div class="sub-card" data-hl="${it.id}">
        <div class="sub-row">
          ${swatch(it.id)}
          <div><b>${esc(c.name)}</b><small>Necesitas ${num(it.need)} · hay ${num(it.have)}</small></div>
          <span class="arrow" aria-hidden="true">→</span>
          ${swatch(opt.id)}
          <div><b>${esc(COLOR_BY_ID.get(opt.id).name)}</b><small class="tone-${near.tone}">${near.label}</small></div>
        </div>
        <div class="sub-alts" role="group" aria-label="Otras opciones">
          ${it.options.map((o) => `<button type="button" class="alt" data-from="${it.id}" data-pick="${o.id}"
            aria-pressed="${o.id === opt.id}" title="${esc(COLOR_BY_ID.get(o.id).name)}" style="--c:${COLOR_BY_ID.get(o.id).hex}"></button>`).join('')}
        </div>
        <div class="sub-actions">
          <button type="button" class="btn btn-primary btn-sm" data-accept="${it.id}" data-to="${opt.id}">Sí, cambiar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-exclude="${it.id}">No, quitar este color</button>
        </div>
      </div>`;
    }
    if (a.issues.length > 1 && a.issues.every((i) => i.options.length)) {
      html += `<button type="button" class="btn btn-ghost btn-block" id="acceptAll">Sí a todos los cambios</button>`;
    }
  } else {
    html += `<div class="notice good"><b>¡Todo disponible!</b> El proveedor tiene inventario de los ${state.counts.size} colores de tu mosaico.</div>`;
  }
  if (applied.length) {
    html += `<div class="applied"><h3>Cambios aplicados</h3>${applied.map(([from, to]) =>
      `<div class="applied-row">${swatch(Number(from))}<s>${esc(COLOR_BY_ID.get(Number(from)).name)}</s> → ${swatch(to)}
      ${esc(COLOR_BY_ID.get(to).name)} <button type="button" class="link" data-undo="${from}">Deshacer</button></div>`).join('')}</div>`;
  }
  issuesEl.innerHTML = html;

  $('#colorTable').innerHTML = a.rows.map((r) => {
    const c = COLOR_BY_ID.get(r.id);
    const pct = Math.min(100, (r.have / Math.max(r.need, 1)) * 100);
    return `<div class="ct-row ${r.status}" data-hl="${r.id}">
      ${swatch(r.id)}<span class="ct-name">${esc(c.name)}</span>
      <span class="ct-n">${num(r.count)} pzs</span>
      <span class="ct-bar"><i style="width:${pct}%"></i></span>
      <span class="ct-stock">${r.status === 'ok' ? 'Disponible' : r.have ? `Solo ${num(r.have)}` : 'Agotado'}</span>
    </div>`;
  }).join('');

  const blocked = a.issues.length > 0;
  $('#toOrder').disabled = blocked;
  $('#toOrder').textContent = blocked ? 'Resuelve los colores faltantes' : 'Continuar al pedido →';
}

function acceptSub(from, to) {
  // Si algo ya se había cambiado a `from`, ahora va directo a `to`.
  for (const k of Object.keys(state.subs)) if (state.subs[k] === from) state.subs[k] = to;
  state.subs[from] = to;
  delete state.choice[from];
  state.highlight = null;
  regen();
  toast(`Listo: ${COLOR_BY_ID.get(from).name} → ${COLOR_BY_ID.get(to).name}`);
}

$('#issues').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.pick) {
    state.choice[t.dataset.from] = Number(t.dataset.pick);
    renderInventory();
  } else if (t.dataset.accept) {
    acceptSub(Number(t.dataset.accept), Number(t.dataset.to));
  } else if (t.dataset.exclude) {
    state.disabled.add(Number(t.dataset.exclude));
    state.highlight = null;
    renderPalette();
    regen();
  } else if (t.dataset.undo) {
    delete state.subs[t.dataset.undo];
    regen();
  } else if (t.id === 'acceptAll') {
    for (const it of state.analysis.issues) {
      const to = state.choice[it.id] ?? it.options[0].id;
      for (const k of Object.keys(state.subs)) if (state.subs[k] === it.id) state.subs[k] = to;
      state.subs[it.id] = to;
    }
    state.choice = {};
    state.highlight = null;
    regen();
    toast('Cambios aplicados');
  }
});

// Resaltar en la vista previa el color sobre el que pasas el mouse.
for (const sel of ['#issues', '#colorTable']) {
  $(sel).addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-hl]');
    const id = el ? Number(el.dataset.hl) : null;
    if (id !== state.highlight) { state.highlight = id; draw(); }
  });
  $(sel).addEventListener('pointerleave', () => { state.highlight = null; draw(); });
}

// ── Pedido ───────────────────────────────────────────────────
function renderOrder() {
  if (!state.mosaic) return;
  const s = size();
  const q = quote(s.cols, s.rows);
  $('#orderSummary').innerHTML = `
    <div class="order-card">
      <div class="order-thumb"><img id="orderThumb" alt="Tu mosaico"></div>
      <div>
        <b>Mosaico ${s.name.toLowerCase()}</b>
        <small>${cm(s.cols)} × ${cm(s.rows)} cm · ${s.cols}×${s.rows} bloques</small>
      </div>
    </div>
    <dl class="lines">
      <div><dt>Piezas redondas 1×1 · ${state.counts.size} colores<small>${num(q.pieces)} pzs + repuestos</small></dt><dd>${money(q.piecesTotal)}</dd></div>
      <div><dt>Placas base 16×16<small>${q.plates} placas</small></dt><dd>${money(q.platesTotal)}</dd></div>
      <div><dt>Instrucciones numeradas<small>PDF imprimible, una hoja por placa</small></dt><dd>Incluidas</dd></div>
      <div><dt>Envío a todo México${q.shipping ? `<small>Gratis desde ${money(STORE.freeShippingFromMXN)}</small>` : ''}</dt><dd>${q.shipping ? money(q.shipping) : 'Gratis'}</dd></div>
      <div class="total"><dt>Total</dt><dd>${money(q.total)}</dd></div>
    </dl>
    <p class="muted small">Tiempo de entrega estimado: ${SUPPLIER.leadTime}.</p>`;
  $('#orderThumb').src = thumbnail(240);

  const done = !!state.order;
  $('#orderForm').hidden = done;
  $('#orderDone').hidden = !done;
  if (done) renderOrderDone();
  renderAdmin();
}

function thumbnail(px) {
  const c = document.createElement('canvas');
  drawMosaic(c, state.mosaic, { maxCss: px });
  return c.toDataURL('image/png');
}

const DRAFT_KEY = 'bloquitos.envio';
try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (draft) for (const [k, v] of Object.entries(draft)) { const el = $(`#orderForm [name="${k}"]`); if (el) el.value = v; }
} catch { /* sin almacenamiento */ }

$('#orderForm').addEventListener('input', () => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(new FormData($('#orderForm'))))); } catch { /* */ }
});

$('#orderForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const err = $('#formError');
  if (state.analysis?.issues.length) {
    err.textContent = 'Primero resuelve los colores que faltan en el paso 3.';
    err.hidden = false;
    return;
  }
  if (!form.checkValidity()) {
    const bad = form.querySelector(':invalid');
    err.textContent = bad.name === 'cp' ? 'El código postal debe tener 5 dígitos.' : `Revisa el campo “${bad.closest('label').firstChild.textContent.trim()}”.`;
    err.hidden = false;
    bad.focus();
    return;
  }
  err.hidden = true;
  const s = size();
  const q = quote(s.cols, s.rows);
  const d = new Date();
  state.order = {
    id: `BQ-${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    fecha: d.toISOString(),
    cliente: Object.fromEntries(new FormData(form)),
    mosaico: { tamaño: s.name, cols: s.cols, rows: s.rows, colores: Object.fromEntries(state.counts) },
    cotizacion: q,
  };
  try {
    const hist = JSON.parse(localStorage.getItem('bloquitos.pedidos') || '[]');
    hist.push(state.order);
    localStorage.setItem('bloquitos.pedidos', JSON.stringify(hist.slice(-20)));
  } catch { /* */ }
  renderOrder();
});

function orderMessage() {
  const o = state.order, c = o.cliente, q = o.cotizacion;
  return [
    `Hola ${STORE.name}, quiero confirmar mi pedido ${o.id}.`,
    `Mosaico ${o.mosaico.tamaño} ${o.mosaico.cols}×${o.mosaico.rows} · ${num(q.pieces)} piezas · ${q.plates} placas base`,
    `Total: ${money(q.total)}`,
    '',
    `Envío: ${c.nombre}, ${c.calle}, ${c.colonia}, C.P. ${c.cp}, ${c.ciudad}, ${c.estado}`,
    `Tel. ${c.telefono} · ${c.email}`,
  ].join('\n');
}

function renderOrderDone() {
  const o = state.order;
  const msg = encodeURIComponent(orderMessage());
  const link = STORE.whatsapp
    ? `<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="https://wa.me/${STORE.whatsapp}?text=${msg}">Enviar pedido por WhatsApp</a>`
    : `<a class="btn btn-primary btn-block" href="mailto:${STORE.email}?subject=${encodeURIComponent(`Pedido ${o.id}`)}&body=${msg}">Enviar pedido por correo</a>`;
  $('#orderDone').innerHTML = `
    <div class="notice good"><b>¡Pedido ${esc(o.id)} listo!</b> Mándanoslo para confirmar el pago y empezamos a preparar tu kit.</div>
    ${link}
    <button type="button" class="btn btn-ghost btn-block" data-goto="5">Ver instrucciones de armado</button>
    <button type="button" class="btn btn-ghost btn-block" id="downloadOrder">Descargar diseño del pedido (.json)</button>
    <button type="button" class="link" id="editOrder">Modificar datos de envío</button>`;
}

$('#orderDone').addEventListener('click', (e) => {
  if (e.target.id === 'editOrder') { state.order = null; renderOrder(); }
  if (e.target.id === 'downloadOrder') {
    const data = { ...state.order, celdas: Array.from(state.mosaic.cells) };
    download(`${state.order.id}.json`, JSON.stringify(data), 'application/json');
  }
});

// Vista de la tienda (?admin): costo real, ganancia y lista de compra al proveedor.
function renderAdmin() {
  const box = $('#adminBox');
  box.hidden = !state.admin;
  if (!state.admin || !state.mosaic) return;
  const s = size();
  const q = quote(s.cols, s.rows);
  const cost = supplierCost(state.counts, q.plates);
  box.innerHTML = `<details class="admin" open>
    <summary>Vista de la tienda · compra al proveedor</summary>
    <p class="small muted">${esc(SUPPLIER.name)} · ${esc(SUPPLIER.part)} · bolsas de ${SUPPLIER.bagSize}</p>
    <dl class="lines compact">
      <div><dt>Piezas (${cost.bags} bolsas)</dt><dd>${money(cost.piecesCost)}</dd></div>
      <div><dt>Placas base (${q.plates})</dt><dd>${money(cost.platesCost)}</dd></div>
      <div><dt>Costo total</dt><dd>${money(cost.total)}</dd></div>
      <div class="total"><dt>Ganancia estimada</dt><dd>${money(q.subtotal - cost.total)}</dd></div>
    </dl>
    <table class="buy">${cost.lines.map((l) => `<tr><td>${swatch(l.color.id)}</td><td>${esc(l.color.name)}<small>${esc(l.color.en)} · #${l.color.id}</small></td>
      <td>${l.bags} bolsa${l.bags > 1 ? 's' : ''}</td><td><a target="_blank" rel="noopener" href="${SUPPLIER.searchUrl(l.color)}">Buscar</a></td></tr>`).join('')}
      <tr><td></td><td>${esc(SUPPLIER.baseplate.name)}</td><td>${q.plates}</td><td><a target="_blank" rel="noopener" href="${SUPPLIER.baseplate.searchUrl}">Buscar</a></td></tr>
    </table>
    <button type="button" class="btn btn-ghost btn-block btn-sm" id="buyCsv">Descargar lista de compra (.csv)</button>
  </details>`;
}

$('#adminBox').addEventListener('click', (e) => {
  if (e.target.id !== 'buyCsv') return;
  const q = quote(size().cols, size().rows);
  const cost = supplierCost(state.counts, q.plates);
  const rows = [['color_id', 'nombre', 'nombre_proveedor', 'piezas', 'con_repuesto', 'bolsas']];
  for (const l of cost.lines) rows.push([l.color.id, l.color.name, l.color.en, l.pieces, l.withSpare, l.bags]);
  rows.push(['', SUPPLIER.baseplate.name, '', q.plates, q.plates, q.plates]);
  download(`compra-${state.order?.id || 'mosaico'}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv');
});

// ── Instrucciones ────────────────────────────────────────────
function plateDims() {
  const p = SUPPLIER.baseplate.studs;
  return { pr: Math.ceil(state.mosaic.rows / p), pc: Math.ceil(state.mosaic.cols / p) };
}

function renderInstructions() {
  if (!state.mosaic) return;
  const { pr, pc } = plateDims();
  state.plate.r = Math.min(state.plate.r, pr - 1);
  state.plate.c = Math.min(state.plate.c, pc - 1);
  const map = $('#plateMap');
  map.style.gridTemplateColumns = `repeat(${pc}, 1fr)`;
  let html = '';
  for (let r = 0; r < pr; r++) for (let c = 0; c < pc; c++) {
    const on = r === state.plate.r && c === state.plate.c;
    html += `<button type="button" data-plate="${r},${c}" aria-pressed="${on}">${plateName(r, c)}</button>`;
  }
  map.innerHTML = html;
  $('#plateLabel').textContent = `Placa ${plateName(state.plate.r, state.plate.c)} · ${state.plate.r * pc + state.plate.c + 1} de ${pr * pc}`;
  const numbers = numbering(state.counts);
  const pcnt = [...plateCounts(state.mosaic, state.plate.r, state.plate.c)].sort((a, b) => numbers.get(a[0]) - numbers.get(b[0]));
  $('#plateLegend').innerHTML = pcnt.map(([id, n]) => {
    const c = COLOR_BY_ID.get(id);
    return `<li><span class="num" style="background:${c.hex};color:${inkFor(c.hex)}">${numbers.get(id)}</span>${esc(c.name)}<b>${n}</b></li>`;
  }).join('');
  draw();
}

$('#plateMap').addEventListener('click', (e) => {
  const b = e.target.closest('[data-plate]');
  if (!b) return;
  const [r, c] = b.dataset.plate.split(',').map(Number);
  state.plate = { r, c };
  renderInstructions();
});
function stepPlate(dir) {
  const { pr, pc } = plateDims();
  const i = (state.plate.r * pc + state.plate.c + dir + pr * pc) % (pr * pc);
  state.plate = { r: Math.floor(i / pc), c: i % pc };
  renderInstructions();
}
$('#prevPlate').addEventListener('click', () => stepPlate(-1));
$('#nextPlate').addEventListener('click', () => stepPlate(1));

$('#printBtn').addEventListener('click', () => {
  $('#printArea').innerHTML = buildPrintable({
    mosaic: state.mosaic, counts: state.counts, previewUrl: thumbnail(520), orderId: state.order?.id,
  });
  const img = $('#printArea img');
  const go = () => window.print();
  if (img.complete) go(); else img.onload = go;
});

// ── Navegación ───────────────────────────────────────────────
function goto(step) {
  if (step > 1 && !state.mosaic) step = 1;
  if (step >= 4 && state.analysis?.issues.length) {
    step = 3;
    toast('Antes de pedir, resuelve los colores que faltan.');
  }
  state.step = step;
  state.highlight = null;
  $$('[data-panel]').forEach((p) => (p.hidden = Number(p.dataset.panel) !== step));
  $$('#steps [data-step]').forEach((b) => {
    const n = Number(b.dataset.step);
    b.setAttribute('aria-current', n === step ? 'step' : 'false');
    b.disabled = n > 1 && !state.mosaic;
    b.classList.toggle('done', n < step);
  });
  const bar = $('#stageBar');
  bar.classList.toggle('plate-mode', step === 5);
  if (step === 3) { refreshStock(); renderInventory(); }
  if (step === 4) renderOrder();
  if (step === 5) renderInstructions(); else draw();
  if (window.innerWidth < 900 && step > 1) $('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#steps').addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (b && !b.disabled) goto(Number(b.dataset.step));
});
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g && !g.disabled) goto(Number(g.dataset.goto));
});

// ── Utilidades ───────────────────────────────────────────────
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
