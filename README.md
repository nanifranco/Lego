# Bloquitos · tienda de mosaicos de bloques

Página donde tus clientes suben una foto, ven cómo queda como mosaico de bloques 1×1,
eligen el tamaño, revisan los colores contra el inventario del proveedor, piden su kit
y descargan instrucciones numeradas para armarlo.

## Cómo correrla

Es HTML + JavaScript sin dependencias. Necesita un servidor local (los módulos de JS
no funcionan abriendo el archivo directo):

```bash
python3 -m http.server 5173
```

Abre <http://localhost:5173>. Para ver costos, ganancia y la lista de compra al proveedor,
abre <http://localhost:5173/?admin>.

## Pasos de la página

1. **Foto**: subir o arrastrar una imagen.
2. **Diseño**: tamaño (32×32 a 96×96 bloques, también vertical u horizontal), zoom,
   encuadre, brillo, contraste, saturación y difuminado. Solo se usan los colores del catálogo
   del proveedor, y puedes excluir colores.
3. **Colores**: se consulta el inventario cada 30 s. Si de algún color no alcanza, propone
   el más parecido que sí hay (distancia CIEDE2000) y tú decides: *Sí, cambiar*,
   escoger otra opción o quitar el color.
4. **Pedido**: piezas + placas base 16×16 + envío, con datos de envío. El pedido se manda por
   WhatsApp o correo.
5. **Instrucciones**: cada color lleva un número; vista placa por placa y PDF imprimible
   (portada con mapa de placas + una hoja por placa).

## Qué configurar (`js/catalog.js`)

- `STORE.whatsapp`: tu número (ej. `5215512345678`) para recibir pedidos por WhatsApp.
- `STORE.marginPct`, `shippingMXN`, `freeShippingFromMXN`: tus precios.
- `SUPPLIER.costPerBagMXN` y `baseplate.costMXN`: lo que pagas de verdad al proveedor.
- `COLORS`: la paleta que vende tu proveedor.

## Inventario en vivo

`STOCK_SOURCE.url` apunta a `data/stock.json` (piezas disponibles por id de color).
**Los números que trae ahorita son de ejemplo.** Para actualizarlo sin tocar código,
puedes usar una hoja de Google con columnas `id,stock`, publicarla como CSV
(Archivo → Compartir → Publicar en la web → CSV) y poner esa URL en `STOCK_SOURCE.url`.

## Proveedor

Por defecto: piezas **Gobricks (GDS)** *Tile 1×1 redondo* (equivalente a 98138), compradas
a granel en AliExpress con envío a México. Usan la misma numeración de colores que LEGO,
así que los ids del catálogo coinciden.
