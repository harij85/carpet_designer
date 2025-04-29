document.addEventListener('DOMContentLoaded', () => {
    const canvas       = document.getElementById('canvas');
    const importBtn    = document.getElementById('importBtn');
    const folderInput  = document.getElementById('folder-input');
    const sortBtn      = document.getElementById('sortBtn');
    const exportBtn    = document.getElementById('exportBtn');
    const exportCanvas = document.getElementById('export-canvas');
  
    const tileSize = parseInt(getComputedStyle(document.documentElement)
                                .getPropertyValue('--tile-size'));
    let tileCounter = 0;
    let activeTile = null;
    let offsetX = 0, offsetY = 0;
    let hoverTimer = null;
  
    // IMPORT FOLDER
    importBtn.addEventListener('click', () => folderInput.click());
    folderInput.addEventListener('change', e => {
      const files = Array.from(e.target.files).filter(f => f.type === 'image/png');
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = evt => createTile(evt.target.result);
        reader.readAsDataURL(file);
      });
      folderInput.value = '';
    });
  
    // Create tile in nearest free cell
    function createTile(imgSrc) {
      const id = tileCounter++;
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.id = id;
      tile.dataset.locked = 'false';
      tile.style.backgroundImage = `url("${imgSrc}")`;
      tile.style.backgroundSize = 'cover';
      tile.style.backgroundPosition = 'center';
  
      const {col, row} = findNearestFreeCell(0, 0);
      tile.dataset.col = col;
      tile.dataset.row = row;
      tile.style.left = `${col * tileSize}px`;
      tile.style.top  = `${row * tileSize}px`;
  
      const lockBtn = document.createElement('button');
      lockBtn.className = 'tile-btn lock-btn';
      lockBtn.textContent = '🔒';
      tile.appendChild(lockBtn);
  
      canvas.appendChild(tile);
    }
  
    // Get occupied cells excluding one tile, always include locked
    function getOccupied(exclude) {
      const set = new Set();
      canvas.querySelectorAll('.tile').forEach(t => {
        if (t === exclude) return;
        set.add(`${t.dataset.col},${t.dataset.row}`);
      });
      return set;
    }
  
    // Find nearest free cell via BFS
    function findNearestFreeCell(c0, r0, exclude = null) {
      const occupied = getOccupied(exclude);
      const key0 = `${c0},${r0}`;
      if (!occupied.has(key0)) return {col: c0, row: r0};
      const maxDist = 100;
      for (let dist = 1; dist <= maxDist; dist++) {
        for (let dx = -dist; dx <= dist; dx++) {
          const dy = dist - Math.abs(dx);
          for (const sign of [dy, -dy]) {
            const nc = c0 + dx;
            const nr = r0 + sign;
            if (nc < 0 || nr < 0) continue;
            const key = `${nc},${nr}`;
            if (!occupied.has(key)) return {col: nc, row: nr};
          }
        }
      }
      return {col: c0, row: r0};
    }
  
    // DRAG START
    canvas.addEventListener('mousedown', e => {
      const t = e.target.closest('.tile');
      if (!t || t.dataset.locked === 'true') return;  // locked can't move
      activeTile = t;
      offsetX = e.clientX - t.offsetLeft;
      offsetY = e.clientY - t.offsetTop;
      t.style.cursor = 'grabbing';
    });
  
    // DRAG MOVE
    document.addEventListener('mousemove', e => {
      if (!activeTile) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      const rect = canvas.getBoundingClientRect();
      x = Math.max(0, Math.min(x, rect.width - tileSize));
      y = Math.max(0, Math.min(y, rect.height - tileSize));
      activeTile.style.left = `${x}px`;
      activeTile.style.top  = `${y}px`;
  
      const col = Math.round(x / tileSize);
      const row = Math.round(y / tileSize);
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        // find un-locked occupying tile
        const collide = Array.from(canvas.querySelectorAll('.tile'))
          .find(t => +t.dataset.col === col
                    && +t.dataset.row === row
                    && t !== activeTile
                    && t.dataset.locked === 'false');
        if (collide) {
          const {col: nc, row: nr} = findNearestFreeCell(col, row, activeTile);
          collide.dataset.col = nc;
          collide.dataset.row = nr;
          collide.style.left = `${nc * tileSize}px`;
          collide.style.top  = `${nr * tileSize}px`;
        }
      }, 2000);
    });
  
    // DRAG END (DROP)
    document.addEventListener('mouseup', () => {
      if (!activeTile) return;
      clearTimeout(hoverTimer);
      const col = Math.round(parseInt(activeTile.style.left) / tileSize);
      const row = Math.round(parseInt(activeTile.style.top)  / tileSize);
      const {col: nc, row: nr} = findNearestFreeCell(col, row, activeTile);
  
      // push aside only if occupier is not locked
      const occupier = Array.from(canvas.querySelectorAll('.tile'))
        .find(t => +t.dataset.col === nc
                  && +t.dataset.row === nr
                  && t !== activeTile
                  && t.dataset.locked === 'false');
      if (occupier) {
        const moveTo = findNearestFreeCell(nc, nr, activeTile);
        occupier.dataset.col = moveTo.col;
        occupier.dataset.row = moveTo.row;
        occupier.style.left = `${moveTo.col * tileSize}px`;
        occupier.style.top  = `${moveTo.row * tileSize}px`;
      }
  
      activeTile.dataset.col = nc;
      activeTile.dataset.row = nr;
      activeTile.style.left = `${nc * tileSize}px`;
      activeTile.style.top  = `${nr * tileSize}px`;
      activeTile.style.cursor = 'grab';
      activeTile = null;
    });
  
    // LOCK/UNLOCK
    canvas.addEventListener('click', e => {
      const lb = e.target.closest('.lock-btn');
      if (!lb) return;
      const tile = lb.closest('.tile');
      const locked = tile.dataset.locked === 'true';
      tile.dataset.locked = (!locked).toString();
      tile.classList.toggle('locked');
      lb.textContent = locked ? '🔒' : '🔓';
    });
  
    // SORT
    sortBtn.addEventListener('click', () => {
      const tiles = Array.from(canvas.querySelectorAll('.tile'))
                         .sort((a,b) => +a.dataset.id - +b.dataset.id);
      const cols = Math.floor(canvas.clientWidth / tileSize) || 1;
      tiles.forEach((t,i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        if (t.dataset.locked === 'true') return; // leave locked in place
        t.dataset.col = col;
        t.dataset.row = row;
        t.style.left = `${col * tileSize}px`;
        t.style.top  = `${row * tileSize}px`;
      });
    });
  
    // EXPORT
    exportBtn.addEventListener('click', () => {
      exportCanvas.width  = canvas.clientWidth;
      exportCanvas.height = canvas.clientHeight;
      const ctx = exportCanvas.getContext('2d');
      ctx.fillStyle = getComputedStyle(canvas).backgroundColor;
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  
      const tiles = Array.from(canvas.querySelectorAll('.tile'));
      let loaded = 0;
      if (tiles.length === 0) return download();
      tiles.forEach(t => {
        const url = t.style.backgroundImage.slice(5, -2);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, t.dataset.col*tileSize, t.dataset.row*tileSize, tileSize, tileSize); if (++loaded === tiles.length) download(); };
        img.onerror = () => { if (++loaded === tiles.length) download(); };
        img.src = url;
      });
  
      function download() {
        const a = document.createElement('a');
        a.href = exportCanvas.toDataURL('image/png');
        a.download = 'carpet-layout.png';
        a.click();
      }
    });
  
  });