# GeoCollab-IA VR Demo

Visualización 3D (A‑Frame) con anotaciones persistentes, panel de filtros, sincronización en tiempo real (Socket.IO) y avatares multiusuario.

## Requisitos
- Node.js 18+ (recomendado 20)
- npm 8+
- (Opcional) PostgreSQL 13+ si quieres persistir anotaciones entre reinicios
- Un navegador compatible con WebXR (Chrome/Edge) si vas a usar VR

## Instalación
En la carpeta raíz del proyecto:

```bash
npm init -y
npm install express cors socket.io pg
```

Si usarás PostgreSQL:
- Crea la base de datos y ejecuta el esquema:
  ```bash
  psql -U <usuario> -d <basedatos> -f backend/schema.sql
  ```
- Configura variables de entorno (ejemplos):
  - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
  - o un `DATABASE_URL` si tu `server.js` lo soporta.

## Ejecutar
```bash
node backend/server.js
```
Verás en consola:
```
API+Sockets en http://localhost:3000
```
Abre en el navegador: http://localhost:3000/

Para probar multiusuario, abre esa URL en otra pestaña o en otro dispositivo en la misma red.

## Probar desde Internet (ngrok)
Si deseas compartir tu sesión local:
```bash
ngrok http 3000
```
Copia la URL pública HTTPS que te da ngrok y ábrela en otro dispositivo. Esa URL tunela hacia tu `http://localhost:3000`.

## Características y uso
- Panel de filtros junto a la gráfica, con etiquetas “Filtros / Franja / Zona / Tipo / Umbral Y”.
  - Puntos 3D: soporta `slot`, `zone`, `type`, `yThreshold`.
  - Barras 3D: soporta `slot` y `zone`.
- Anotaciones:
  - En VR: se abre un picker de presets para el texto.
  - En desktop (no VR): al pulsar “Guardar Anotación Aquí” crea una nota genérica “Nota …”.
  - Se sincronizan en tiempo real entre usuarios (sin refrescar) por Socket.IO.
- Avatares multiusuario:
  - Cápsula/Esfera por defecto.
  - Puedes cargar un modelo humanoide GLB: en `index.html` ajusta el componente `avatars-sync`:
    ```html
    <a-entity avatars-sync="
      updateHz: 12;
      modelUrl: url(assets/humanoid.glb);
      modelScale: 1 1 1;
      modelYOffset: 0.0
    "></a-entity>
    ```
  - Coloca tu archivo en `assets/humanoid.glb`.

## Controles
- Desktop:
  - Apuntar con mouse: añade este cursor (si no existe) dentro de `<a-scene>`:
    ```html
    <a-entity cursor="rayOrigin: mouse"
              raycaster="objects: .collidable, .viz-option, .ui-panel; far: 30; recursive: true"></a-entity>
    ```
  - Botón “Guardar Anotación Aquí” crea la anotación donde estás apuntando.
- VR:
  - Usa el láser de la mano para seleccionar filtros y crear anotaciones (se abrirá el picker de presets).

## Solución de problemas
- No veo la UI / filtros no reaccionan:
  - Asegura que los raycasters incluyen UI: `.viz-option, .ui-panel` además de `.collidable`.
- No se ven avatares ni anotaciones en tiempo real:
  - Verifica que cargas `/socket.io/socket.io.js` sin 404.
  - Asegura que el server muestre “API+Sockets …”.
- Anotaciones no persisten tras reinicio:
  - Configura PostgreSQL y ejecuta `schema.sql`. Revisa variables de entorno.

## Estructura relevante
- `index.html`: escena A‑Frame y carga de scripts
- `viz-panel.js`: panel de filtros y cambios de modo de gráfica
- `barchart-3d.js`, `points-3d.js`, `terrain-3d.js`, `terrain-wire.js`: visualizaciones
- `anotacion-persistencia.js`: anotaciones, VR keyboard, sync en tiempo real
- `avatars-sync.js`: avatares multiusuario (Socket.IO)
- `backend/server.js`: servidor Express + Socket.IO + API anotaciones
- `backend/schema.sql`: esquema PostgreSQL para anotaciones

## Notas
- El servidor sirve archivos estáticos desde la raíz del proyecto, por eso `assets/` funciona directo en el navegador.
- Si cambias de modo de vista (Barras/Terreno/Puntos/Wire), se cargan las anotaciones correspondientes a ese modo.
