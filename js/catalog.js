// ─────────────────────────────────────────────────────────────
// Configuración de la tienda, el proveedor y el catálogo de colores.
// Todo lo que quieras cambiar (precios, margen, WhatsApp, colores)
// vive en este archivo.
// ─────────────────────────────────────────────────────────────

export const STORE = {
  name: 'Bloquitos',
  tagline: 'Tu foto convertida en mosaico de bloques',
  currency: 'MXN',
  // Número de WhatsApp de la tienda con lada de país, sin + ni espacios.
  // Ej. '5215512345678'. Si lo dejas vacío, el pedido se manda por correo.
  whatsapp: '',
  email: 'pedidos@ejemplo.com',
  marginPct: 0.6,          // margen sobre el costo del proveedor (0.6 = +60 %)
  extraPiecesPct: 0.03,    // piezas de repuesto por color (3 %)
  shippingMXN: 149,        // envío al cliente dentro de México
  freeShippingFromMXN: 1500,
};

// Proveedor: Gobricks (GDS), piezas compatibles que imitan la paleta
// de LEGO, vendidas a granel en AliExpress con envío a México.
// Los costos son estimados: actualízalos con lo que pagues de verdad.
export const SUPPLIER = {
  name: 'Gobricks (GDS) vía AliExpress',
  part: 'Tile 1×1 redondo · 98138 / GDS-612',
  bagSize: 100,              // piezas por bolsa
  costPerBagMXN: 30,         // costo estimado por bolsa de 100
  leadTime: '10 a 20 días a México',
  searchUrl: (color) =>
    `https://www.aliexpress.com/w/wholesale-gobricks-98138-${encodeURIComponent(color.en.toLowerCase())}.html`,
  baseplate: {
    name: 'Placa base 16×16',
    studs: 16,
    costMXN: 28,
    searchUrl: 'https://www.aliexpress.com/w/wholesale-gobricks-baseplate-16x16.html',
  },
};

// Dónde se consulta el inventario. Puede ser:
//  · un JSON como data/stock.json
//  · una hoja de Google publicada como CSV (columnas: id,stock)
//  · el endpoint de tu propio backend
export const STOCK_SOURCE = {
  url: 'data/stock.json',
  pollSeconds: 30,
};

// Paleta del proveedor. `id` = número de color LEGO (Gobricks usa la misma
// numeración). `hex` según la tabla de colores de Rebrickable.
export const COLORS = [
  { id: 1,   name: 'Blanco',              en: 'White',              hex: '#FFFFFF' },
  { id: 26,  name: 'Negro',               en: 'Black',              hex: '#05131D' },
  { id: 194, name: 'Gris claro',          en: 'Light Bluish Gray',  hex: '#A0A5A9' },
  { id: 199, name: 'Gris oscuro',         en: 'Dark Bluish Gray',   hex: '#6C6E68' },
  { id: 21,  name: 'Rojo',                en: 'Red',                hex: '#C91A09' },
  { id: 154, name: 'Rojo oscuro',         en: 'Dark Red',           hex: '#720E0F' },
  { id: 353, name: 'Coral',               en: 'Coral',              hex: '#FF698F' },
  { id: 106, name: 'Naranja',             en: 'Orange',             hex: '#FE8A18' },
  { id: 191, name: 'Naranja claro',       en: 'Bright Light Orange',hex: '#F8BB3D' },
  { id: 24,  name: 'Amarillo',            en: 'Yellow',             hex: '#F2CD37' },
  { id: 226, name: 'Amarillo claro',      en: 'Bright Light Yellow',hex: '#FFF03A' },
  { id: 283, name: 'Piel clara',          en: 'Light Nougat',       hex: '#F6D7B3' },
  { id: 18,  name: 'Piel',                en: 'Nougat',             hex: '#D09168' },
  { id: 312, name: 'Piel media',          en: 'Medium Nougat',      hex: '#AA7D55' },
  { id: 5,   name: 'Arena',               en: 'Tan',                hex: '#E4CD9E' },
  { id: 138, name: 'Arena oscuro',        en: 'Dark Tan',           hex: '#958A73' },
  { id: 192, name: 'Café rojizo',         en: 'Reddish Brown',      hex: '#582A12' },
  { id: 308, name: 'Café oscuro',         en: 'Dark Brown',         hex: '#352100' },
  { id: 119, name: 'Lima',                en: 'Lime',               hex: '#BBE90B' },
  { id: 37,  name: 'Verde brillante',     en: 'Bright Green',       hex: '#4B9F4A' },
  { id: 28,  name: 'Verde',               en: 'Green',              hex: '#237841' },
  { id: 141, name: 'Verde bosque',        en: 'Dark Green',         hex: '#184632' },
  { id: 330, name: 'Verde olivo',         en: 'Olive Green',        hex: '#9B9A5A' },
  { id: 151, name: 'Verde salvia',        en: 'Sand Green',         hex: '#A0BCAC' },
  { id: 323, name: 'Aqua claro',          en: 'Light Aqua',         hex: '#ADC3C0' },
  { id: 322, name: 'Turquesa',            en: 'Medium Azure',       hex: '#36AEBF' },
  { id: 212, name: 'Azul cielo',          en: 'Bright Light Blue',  hex: '#9FC3E9' },
  { id: 102, name: 'Azul medio',          en: 'Medium Blue',        hex: '#5A93DB' },
  { id: 23,  name: 'Azul',                en: 'Blue',               hex: '#0055BF' },
  { id: 140, name: 'Azul marino',         en: 'Dark Blue',          hex: '#0A3463' },
  { id: 135, name: 'Azul grisáceo',       en: 'Sand Blue',          hex: '#6074A1' },
  { id: 325, name: 'Lavanda',             en: 'Lavender',           hex: '#E1D5ED' },
  { id: 324, name: 'Lila',                en: 'Medium Lavender',    hex: '#AC78BA' },
  { id: 268, name: 'Morado',              en: 'Dark Purple',        hex: '#3F3691' },
  { id: 124, name: 'Magenta',             en: 'Magenta',            hex: '#923978' },
  { id: 221, name: 'Rosa fuerte',         en: 'Dark Pink',          hex: '#C870A0' },
  { id: 222, name: 'Rosa claro',          en: 'Bright Pink',        hex: '#E4ADC8' },
];

export const COLOR_BY_ID = new Map(COLORS.map((c) => [c.id, c]));

// Tamaños en bloques (cada bloque mide 8 mm; cada placa base cubre 16×16).
export const SIZES = [
  { id: 's',  cols: 32, rows: 32, name: 'Chico' },
  { id: 'm',  cols: 48, rows: 48, name: 'Mediano' },
  { id: 'l',  cols: 64, rows: 64, name: 'Grande' },
  { id: 'v',  cols: 48, rows: 64, name: 'Vertical' },
  { id: 'h',  cols: 64, rows: 48, name: 'Horizontal' },
  { id: 'xl', cols: 96, rows: 96, name: 'Extra grande' },
];

export const STUD_MM = 8;

// ── Precios ──────────────────────────────────────────────────
const piecePrice = () => (SUPPLIER.costPerBagMXN / SUPPLIER.bagSize) * (1 + STORE.marginPct);
const platePrice = () => SUPPLIER.baseplate.costMXN * (1 + STORE.marginPct);

export function platesFor(cols, rows) {
  const s = SUPPLIER.baseplate.studs;
  return Math.ceil(cols / s) * Math.ceil(rows / s);
}

export function quote(cols, rows) {
  const pieces = cols * rows;
  const plates = platesFor(cols, rows);
  const piecesTotal = round2(pieces * piecePrice());
  const platesTotal = round2(plates * platePrice());
  const subtotal = piecesTotal + platesTotal;
  const shipping = subtotal >= STORE.freeShippingFromMXN ? 0 : STORE.shippingMXN;
  return { pieces, plates, piecesTotal, platesTotal, subtotal, shipping, total: subtotal + shipping };
}

// Lo que te cuesta a ti comprarle al proveedor (vista de admin).
export function supplierCost(counts, plates) {
  let bags = 0;
  const lines = [];
  for (const [id, n] of counts) {
    const need = Math.ceil(n * (1 + STORE.extraPiecesPct));
    const b = Math.ceil(need / SUPPLIER.bagSize);
    bags += b;
    lines.push({ color: COLOR_BY_ID.get(id), pieces: n, withSpare: need, bags: b });
  }
  const piecesCost = bags * SUPPLIER.costPerBagMXN;
  const platesCost = plates * SUPPLIER.baseplate.costMXN;
  return { lines, bags, piecesCost, platesCost, total: piecesCost + platesCost };
}

const round2 = (n) => Math.round(n * 100) / 100;

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
export const money = (n) => fmt.format(n);
export const num = (n) => n.toLocaleString('es-MX');
