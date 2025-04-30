const BASE_TILE_SIZE = 240;  // px per cell at zoom=1
const ZOOM_STEP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom-step'));
let zoomLevel = 1;

function getTileSize() {
  return BASE_TILE_SIZE * zoomLevel;
}

document.addEventListener('DOMContentLoaded', () => {
  const gridCanvas   = document.getElementById('grid-canvas');
  const container    = document.getElementById('canvas-container');
  const canvas       = document.getElementById('canvas');
  const importBtn    = document.getElementById('importBtn');
  const folderInput  = document.getElementById('folder-input');
  const setGridBtn   = document.getElementById('setGridBtn');
  const zoomInBtn    = document.getElementById('zoomInBtn');
  const zoomOutBtn   = document.getElementById('zoomOutBtn');
  const sortBtn      = document.getElementById('sortBtn');
  const exportBtn    = document.getElementById('exportBtn');
  const exportCSVBtn = document.getElementById('exportCSVBtn');
  const exportCanvas = document.getElementById('export-canvas');

  let cols = 10, rows = 10;
  let tileCounter = 0;
  let activeTile = null, offsetX = 0, offsetY = 0, hoverTimer = null;

  // Zoom controls
  zoomInBtn.addEventListener('click', () => setZoom(zoomLevel + ZOOM_STEP));
  zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));

  function setZoom(z) {
    zoomLevel = Math.max(0.1, z);
    document.documentElement.style.setProperty('--tile-size', `${getTileSize()}px`);
    redrawGridAndTiles();
  }

  function redrawGridAndTiles() {
    drawGrid();
    document.querySelectorAll('.tile').forEach(tile => {
      const col = +tile.dataset.col;
      const row = +tile.dataset.row;
      const sz = getTileSize();
      tile.style.left = `${col * sz}px`;
      tile.style.top  = `${row * sz}px`;
    });
  }

  // Grid setup
  setGridBtn.addEventListener('click', () => {
    cols = +document.getElementById('grid-cols').value;
    rows = +document.getElementById('grid-rows').value;
    canvas.innerHTML = '';
    tileCounter = 0;
    drawGrid();
  });

  function drawGrid() {
    const sz = getTileSize();
    gridCanvas.width  = cols * sz;
    gridCanvas.height = rows * sz;
    gridCanvas.style.width  = `${gridCanvas.width}px`;
    gridCanvas.style.height = `${gridCanvas.height}px`;
    canvas.style.width      = `${gridCanvas.width}px`;
    canvas.style.height     = `${gridCanvas.height}px`;

    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    ctx.strokeStyle = '#999';
    ctx.lineWidth   = 1;
    ctx.font        = '16px sans-serif';
    ctx.fillStyle   = '#555';
    let num = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * sz, y = r * sz;
        ctx.strokeRect(x, y, sz, sz);
        // center-align the number
        const text = String(num++);
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const fontSize = 16;
        const tx = x + (sz - textWidth) / 2;
        const ty = y + (sz + fontSize) / 2 - 2;
        ctx.fillText(text, tx, ty);
      }
    }
  }
  drawGrid();

  // Import via button
  importBtn.addEventListener('click', () => folderInput.click());
  folderInput.addEventListener('change', e => {
    Array.from(e.target.files)
      .filter(f => f.type === 'image/png')
      .forEach(f => fileToTile(f));
    folderInput.value = '';
  });

  // Drag & drop import
  ['dragenter', 'dragover'].forEach(evt => canvas.addEventListener(evt, e => { e.preventDefault(); canvas.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => canvas.addEventListener(evt, e => { e.preventDefault(); canvas.classList.remove('drag-over'); }));
  canvas.addEventListener('drop', e => {
    const items = e.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) traverse(entry);
    }
  });

  function traverse(entry) {
    if (entry.isFile) entry.file(f => { if (f.type === 'image/png') fileToTile(f); });
    else entry.createReader().readEntries(en => en.forEach(traverse));
  }

  function fileToTile(file) {
    const reader = new FileReader();
    reader.onload = ev => createTile(ev.target.result);
    reader.readAsDataURL(file);
  }

  // Create tile
  function createTile(src) {
    const id = ++tileCounter;
    const tile = document.createElement('div');
    tile.className            = 'tile';
    tile.dataset.id           = id;
    tile.dataset.name         = `tile_${id}`;
    tile.dataset.locked       = 'false';
    tile.style.backgroundImage = `url(${src})`;

    const {col, row} = findFree(0, 0);
    const sz = getTileSize();
    tile.dataset.col = col;
    tile.dataset.row = row;
    tile.style.left = `${col * sz}px`;
    tile.style.top  = `${row * sz}px`;

    const lb = document.createElement('button');
    lb.className = 'tile-btn lock-btn';
    lb.textContent = '🔒';
    tile.appendChild(lb);
    canvas.appendChild(tile);
    attachEvents(tile);
  }

  // Attach events
  function attachEvents(tile) {
    tile.addEventListener('mousedown', e => {
      if (tile.dataset.locked === 'true') return;
      activeTile = tile;
      const sz = getTileSize();
      offsetX     = e.clientX - tile.offsetLeft;
      offsetY     = e.clientY - tile.offsetTop;
      tile.style.cursor = 'grabbing';
      tile.style.zIndex = 1000;
    });
    tile.querySelector('.lock-btn').addEventListener('click', e => {
      e.stopPropagation();
      const locked = tile.dataset.locked === 'true';
      tile.dataset.locked = (!locked).toString();
      tile.classList.toggle('locked');
      e.currentTarget.textContent = locked ? '🔒' : '🔓';
    });
  }

  // Drag move & drop
  document.addEventListener('mousemove', e => {
    if (!activeTile) return;
    const sz = getTileSize();
    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    x = Math.max(0, Math.min(x, cols * sz - sz));
    y = Math.max(0, Math.min(y, rows * sz - sz));
    activeTile.style.left = `${x}px`;
    activeTile.style.top  = `${y}px`;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const c = Math.round(x / sz);
      const r = Math.round(y / sz);
      const hit = Array.from(canvas.querySelectorAll('.tile')).find(t =>
        +t.dataset.col === c && +t.dataset.row === r && t !== activeTile && t.dataset.locked === 'false'
      );
      if (hit) {
        const dest = findFree(c, r, activeTile);
        hit.dataset.col = dest.col;
        hit.dataset.row = dest.row;
        hit.style.left = `${dest.col * sz}px`;
        hit.style.top  = `${dest.row * sz}px`;
      }
    }, 2000);
  });

  document.addEventListener('mouseup', () => {
    if (!activeTile) return;
    clearTimeout(hoverTimer);
    const sz = getTileSize();
    const c = Math.round(parseInt(activeTile.style.left) / sz);
    const r = Math.round(parseInt(activeTile.style.top)  / sz);
    const dest = findFree(c, r, activeTile);
    const hit = Array.from(canvas.querySelectorAll('.tile')).find(t =>
      +t.dataset.col === dest.col && +t.dataset.row === dest.row && t !== activeTile && t.dataset.locked === 'false'
    );
    if (hit) {
      const alt = findFree(dest.col, dest.row, activeTile);
      hit.dataset.col = alt.col;
      hit.dataset.row = alt.row;
      hit.style.left = `${alt.col * sz}px`;
      hit.style.top  = `${alt.row * sz}px`;
    }
    activeTile.dataset.col = dest.col;
    activeTile.dataset.row = dest.row;
    activeTile.style.left = `${dest.col * sz}px`;
    activeTile.style.top  = `${dest.row * sz}px`;
    activeTile.style.cursor = 'grab';
    activeTile.style.zIndex = '';
    activeTile = null;
  });

  // Sort tiles
  sortBtn.addEventListener('click', () => {
    const tiles = Array.from(canvas.querySelectorAll('.tile')).sort((a, b) => +a.dataset.id - +b.dataset.id);
    tiles.forEach((t, i) => {
      if (t.dataset.locked === 'true') return;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const sz = getTileSize();
      t.dataset.col = c;
      t.dataset.row = r;
      t.style.left = `${c * sz}px`;
      t.style.top  = `${r * sz}px`;
    });
  });

  // Export CSV
  exportCSVBtn.addEventListener('click', () => {
    const data = [['Position', 'TileName']];
    canvas.querySelectorAll('.tile').forEach(t => {
      const pos = +t.dataset.row * cols + +t.dataset.col + 1;
      data.push([pos, t.dataset.name]);
    });
    const csv = data.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tiles.csv';
    a.click();
  });

  // Export PNG (unchanged)

  // Grid helper
  function findFree(c0, r0, exclude = null) {
    const occ = new Set();
    canvas.querySelectorAll('.tile').forEach(t => { if (t !== exclude) occ.add(`${t.dataset.col},${t.dataset.row}`); });
    if (!occ.has(`${c0},${r0}`)) return { col: c0, row: r0 };
    for (let d = 1; d < cols * rows; d++) {
      for (let dx = -d; dx <= d; dx++) {
        const dy = d - Math.abs(dx);
        for (const s of [dy, -dy]) {
          const nc = c0 + dx;
          const nr = r0 + s;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (!occ.has(`${nc},${nr}`)) return { col: nc, row: nr };
        }
      }
    }
    return { col: c0, row: r0 };
  }
});