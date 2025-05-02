// static/js/main.js

// SVG icons for lock states
const LOCK_CLOSED_SVG = '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>';
const LOCK_OPEN_SVG   = '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>';

// Configuration
const BASE_TILE_SIZE = 240;
const ZOOM_STEP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom-step'));
let zoomLevel = 0.75;
let cols = 4, rows = 4, tileCounter = 0;
let activeTile = null, offsetX = 0, offsetY = 0, hoverTimer = null;
const presets = JSON.parse(localStorage.getItem('presets') || '{}');

document.addEventListener('DOMContentLoaded', () => {
  const $ = sel => document.querySelector(sel);
  const gridCanvas   = $('#grid-canvas');
  const canvas       = $('#canvas');
  const container    = $('#canvas-container');

  const controls = {
    importBtn:     $('#importBtn'),
    folderInput:   $('#folder-input'),
    setGridBtn:    $('#setGridBtn'),
    zoomInBtn:     $('#zoomInBtn'),
    zoomOutBtn:    $('#zoomOutBtn'),
    savePresetBtn: $('#savePresetBtn'),
    presetList:    $('#presetList'),
    helpBtn:       $('#helpBtn'),
    closeHelp:     $('#closeHelp'),
    exportCSVBtn:  $('#exportCSVBtn'),
  };

  // Help modal
  controls.helpBtn?.addEventListener('click', () => $('#helpModal').classList.remove('hidden'));
  controls.closeHelp?.addEventListener('click', () => $('#helpModal').classList.add('hidden'));
  $('#helpModal')?.addEventListener('click', e => { if (e.target.id === 'helpModal') e.target.classList.add('hidden'); });

  // Opacity slider
  opacityRange?.addEventListener('input', e => {
    document.querySelectorAll('.tile').forEach(t => t.style.opacity = e.target.value);
  });

  // Preset management
  function refreshPresets() {
    const sel = controls.presetList;
    sel.innerHTML = '<option value="">Load Preset</option>';
    Object.keys(presets).forEach(name => {
      const opt = document.createElement('option'); opt.value = name; opt.textContent = name;
      sel.appendChild(opt);
    });
  }
  refreshPresets();

  controls.savePresetBtn.addEventListener('click', () => {
    const name = prompt('Preset name:'); if (!name) return;
    presets[name] = Array.from(canvas.querySelectorAll('.tile')).map(t => ({
      id: t.dataset.id, name: t.dataset.name,
      col: +t.dataset.col, row: +t.dataset.row
    }));
    try { localStorage.setItem('presets', JSON.stringify(presets)); }
    catch (err) { if (err.name === 'QuotaExceededError') { alert('Storage full'); delete presets[name]; } else throw err; }
    refreshPresets();
  });

  controls.presetList.addEventListener('change', e => {
    const data = presets[e.target.value]; if (!data) return;
    data.forEach(item => {
      const tile = document.querySelector(`.tile[data-id='${item.id}']`);
      if (tile) { tile.dataset.col = item.col; tile.dataset.row = item.row; }
    });
    redraw();
  });

  // Zoom
  controls.zoomInBtn.addEventListener('click',  () => setZoom(zoomLevel + ZOOM_STEP));
  controls.zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));

  function getTileSize() { return BASE_TILE_SIZE * zoomLevel; }
  function setZoom(z) { zoomLevel = Math.max(0.1, z); document.documentElement.style.setProperty('--tile-size', `${getTileSize()}px`); redraw(); }

  // Grid setup
  controls.setGridBtn.addEventListener('click', () => {
    cols = +$('#grid-cols').value; rows = +$('#grid-rows').value;
    tileCounter = 0; canvas.innerHTML = ''; drawGrid();
  });

  // Draw grid
  function drawGrid() {
    const sz = getTileSize();
    gridCanvas.width = cols * sz; gridCanvas.height = rows * sz;
    gridCanvas.style.width = `${cols * sz}px`; gridCanvas.style.height = `${rows * sz}px`;
    canvas.style.width = `${cols * sz}px`; canvas.style.height = `${rows * sz}px`;
    const ctx = gridCanvas.getContext('2d'); ctx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
    ctx.strokeStyle='#999'; ctx.lineWidth=1; ctx.font='16px sans-serif'; ctx.fillStyle='#555';
    let num=1;
    for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
      const x=c*sz, y=r*sz; ctx.strokeRect(x,y,sz,sz);
      const text=String(num++), m=ctx.measureText(text);
      ctx.fillText(text, x+(sz-m.width)/2, y+(sz+16)/2-2);
    }
  }
  drawGrid();

  // Redraw
  function redraw() {
    drawGrid(); 
    document.querySelectorAll('.tile').forEach(tile => {
      const sz=getTileSize(), col=+tile.dataset.col, row=+tile.dataset.row;
      Object.assign(tile.style, {
        left: `${col*sz}px`, top: `${row*sz}px`,
        width: `${sz}px`, height: `${sz}px`, opacity: 0.75
      });
    });
  }

  // Import PNGs
  controls.importBtn.addEventListener('click', () => controls.folderInput.click());
  controls.folderInput.addEventListener('change', e => {
    Array.from(e.target.files).filter(f=>f.type==='image/png').forEach(fileToTile);
    controls.folderInput.value='';
  });

  // Export CSV
  controls.exportCSVBtn.addEventListener('click', () => {
    const rowsArr=[['Position','TileName']];
    document.querySelectorAll('.tile').forEach(t => {
      rowsArr.push([+t.dataset.row*cols+ +t.dataset.col+1, t.dataset.name]);
    });
    const csv=rowsArr.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}), url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='tiles.csv'; a.click(); URL.revokeObjectURL(url);
  });

  // Pinch-to-zoom
  let startDist=0;
  container.addEventListener('touchstart',e=>{
    if(e.touches.length===2){ const dx=e.touches[0].clientX-e.touches[1].clientX; const dy=e.touches[0].clientY-e.touches[1].clientY; startDist=Math.hypot(dx,dy); }
  });
  container.addEventListener('touchmove',e=>{
    if(e.touches.length===2){ e.preventDefault(); const dx=e.touches[0].clientX-e.touches[1].clientX; const dy=e.touches[0].clientY-e.touches[1].clientY; const dist=Math.hypot(dx,dy); setZoom(zoomLevel*(dist/startDist)); startDist=dist; }
  });

  // Drag & Lock handlers
  function attachEvents(tile) {
    tile.addEventListener('pointerdown', e => {
      if(tile.dataset.locked==='true') return;
      activeTile = tile; offsetX=e.clientX-tile.offsetLeft; offsetY=e.clientY-tile.offsetTop;
      tile.setPointerCapture(e.pointerId); tile.style.zIndex=1000; tile.style.cursor='grabbing';
    });

    tile.addEventListener('pointermove', e => {
      if(activeTile!==tile) return;
      const sz=getTileSize(); let x=e.clientX-offsetX, y=e.clientY-offsetY;
      x=Math.max(0,Math.min(x,cols*sz-sz)); y=Math.max(0,Math.min(y,rows*sz-sz));
      tile.style.left=`${x}px`; tile.style.top=`${y}px`;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        const c=Math.round(parseInt(tile.style.left,10)/sz);
        const r=Math.round(parseInt(tile.style.top,10)/sz);
        const target=document.querySelector(`.tile[data-col='${c}'][data-row='${r}']`);
        if(target && target!==tile && tile.dataset.locked==='false' && target.dataset.locked==='false') swapTiles(tile,c,r);
      }, 1500);
    });

    tile.addEventListener('pointerup', e => {
      if(activeTile!==tile) return;
      clearTimeout(hoverTimer);
      const sz=getTileSize(); const c=Math.round(parseInt(tile.style.left,10)/sz);
      const r=Math.round(parseInt(tile.style.top,10)/sz);
      swapTiles(tile,c,r);
      tile.style.zIndex=''; tile.style.cursor='grab'; activeTile=null;
    });

    const lockBtn = tile.querySelector('.lock-btn');
    if(lockBtn){
      lockBtn.addEventListener('pointerdown', e=> e.stopPropagation());
      lockBtn.innerHTML = LOCK_CLOSED_SVG;
      lockBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isLocked = tile.dataset.locked==='true';
        const newState = !isLocked;
        tile.dataset.locked=newState.toString();
        tile.classList.toggle('locked',newState);
        lockBtn.innerHTML = newState ? LOCK_OPEN_SVG : LOCK_CLOSED_SVG;
      });
    }
  }

  // Swap helper
  function swapTiles(t,col,row){
    const sz=getTileSize();
    const other=document.querySelector(`.tile[data-col='${col}'][data-row='${row}']`);
    if(other && other!==t && other.dataset.locked==='false'){
      const ocol=t.dataset.col, orow=t.dataset.row;
      other.dataset.col=ocol; other.dataset.row=orow;
      other.style.left=`${ocol*sz}px`; other.style.top=`${orow*sz}px`;
    }
    t.dataset.col=col; t.dataset.row=row;
    t.style.left=`${col*sz}px`; t.style.top=`${row*sz}px`;
  }

  // File import & creation
  function fileToTile(file){ const reader=new FileReader(); reader.onload=ev=>createTile(ev.target.result); reader.readAsDataURL(file); }
  function createTile(src){
    const id=++tileCounter;
    const tile=document.createElement('div'); tile.className='tile';
    tile.dataset.id=id; tile.dataset.name=`tile_${id}`; tile.dataset.locked='false';
    tile.style.backgroundImage=`url(${src})`;
    const {col,row}=findFree(0,0); const sz=getTileSize();
    tile.dataset.col=col; tile.dataset.row=row;
    tile.style.left=`${col*sz}px`; tile.style.top=`${row*sz}px`;
    canvas.appendChild(tile);
    const lb=document.createElement('button'); lb.className='tile-btn lock-btn'; lb.innerHTML=LOCK_CLOSED_SVG;
    tile.appendChild(lb);
    attachEvents(tile);
  }

  // Find next free cell
  function findFree(c0,r0,exclude=null){
    const occ=new Set();
    canvas.querySelectorAll('.tile').forEach(t=>{ if(t!==exclude) occ.add(`${t.dataset.col},${t.dataset.row}`); });
    if(!occ.has(`${c0},${r0}`)) return {col:c0,row:r0};
    for(let d=1; d<cols*rows; d++){
      for(let dx=-d; dx<=d; dx++){ const dy=d-Math.abs(dx);
        for(const s of [dy,-dy]){
          const nc=c0+dx, nr=r0+s;
          if(nc<0||nr<0||nc>=cols||nr>=rows) continue;
          if(!occ.has(`${nc},${nr}`)) return {col:nc,row:nr};
        }
      }
    }
    return {col:c0,row:r0};
  }

});
