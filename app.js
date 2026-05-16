// ── Constants ────────────────────────────────────────────────────────────────
const PRESETS = {
  '1830x2750': { width: 1830, height: 2750 },
  '1220x2440': { width: 1220, height: 2440 },
  '1530x2440': { width: 1530, height: 2440 },
};

const PIECE_COLORS = [
  '#a8dadc','#457b9d','#e9c46a','#f4a261',
  '#e76f51','#2a9d8f','#8ecae6','#219ebc',
  '#ffb703','#fb8500','#95d5b2','#74c69d'
];

const EB_THICKNESS = 5;
const CANVAS_MAX_W  = 700;

// ── AppState ─────────────────────────────────────────────────────────────────
const AppState = {
  projectName: '',
  unit: 'mm',
  sheet: { width: 1830, height: 2750, presetKey: '1830x2750' },
  pieces: [],
  hardware: [],
  nestingResult: { sheets: [], totalSheets: 0, unplacedPieces: [] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
let _uid = 1;
function uid() { return 'p' + (_uid++); }

function toDisplay(mm) {
  if (AppState.unit === 'cm') return +(mm / 10).toFixed(1);
  return mm;
}
function fromDisplay(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return AppState.unit === 'cm' ? Math.round(n * 10) : Math.round(n);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pieceColor(id) {
  return PIECE_COLORS[hashStr(id) % PIECE_COLORS.length];
}

// ── MAXRECTS Nesting Engine ───────────────────────────────────────────────────
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectContains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
         inner.x + inner.w <= outer.x + outer.w &&
         inner.y + inner.h <= outer.y + outer.h;
}

function pruneContained(rects) {
  const out = [];
  for (let i = 0; i < rects.length; i++) {
    let dominated = false;
    for (let j = 0; j < rects.length; j++) {
      if (i !== j && rectContains(rects[j], rects[i])) { dominated = true; break; }
    }
    if (!dominated) out.push(rects[i]);
  }
  return out;
}

function splitFreeRects(freeRects, placed) {
  const newRects = [];
  const p = placed;
  for (const r of freeRects) {
    if (!rectsOverlap(r, p)) { newRects.push(r); continue; }
    if (p.x > r.x)
      newRects.push({ x: r.x, y: r.y, w: p.x - r.x, h: r.h });
    if (p.x + p.w < r.x + r.w)
      newRects.push({ x: p.x + p.w, y: r.y, w: (r.x + r.w) - (p.x + p.w), h: r.h });
    if (p.y > r.y)
      newRects.push({ x: r.x, y: r.y, w: r.w, h: p.y - r.y });
    if (p.y + p.h < r.y + r.h)
      newRects.push({ x: r.x, y: p.y + p.h, w: r.w, h: (r.y + r.h) - (p.y + p.h) });
  }
  return pruneContained(newRects);
}

function bestAreaFit(inst, freeRects) {
  let best = null, bestScore = Infinity, bestRot = false;
  const iw = inst.width, ih = inst.height;
  for (const r of freeRects) {
    if (iw <= r.w && ih <= r.h) {
      const score = r.w * r.h - iw * ih;
      if (score < bestScore) { bestScore = score; best = r; bestRot = false; }
    }
    if (ih <= r.w && iw <= r.h) {
      const score = r.w * r.h - ih * iw;
      if (score < bestScore) { bestScore = score; best = r; bestRot = true; }
    }
  }
  return best ? { rect: best, rotated: bestRot } : null;
}

function rotateEB(eb, rotated) {
  if (!rotated) return eb;
  return { top: eb.left, right: eb.top, bottom: eb.right, left: eb.bottom };
}

function nestAllPieces(sheet, pieces) {
  const instances = [];
  const unplaceable = [];
  for (const pc of pieces) {
    const qty = Math.max(0, Math.round(pc.quantity || 0));
    if (qty === 0) continue;
    const w = pc.width, h = pc.length;
    if (w <= 0 || h <= 0) continue;
    const fitsNorm = w <= sheet.width && h <= sheet.height;
    const fitsRot  = h <= sheet.width && w <= sheet.height;
    for (let i = 0; i < qty; i++) {
      if (!fitsNorm && !fitsRot) {
        unplaceable.push({ pieceId: pc.id, name: pc.name || LANG.defaultPieceName, instanceIndex: i });
      } else {
        instances.push({ pieceId: pc.id, instanceIndex: i, width: w, height: h,
                         name: pc.name || LANG.defaultPieceName, edgeBanding: pc.edgeBanding });
      }
    }
  }

  instances.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  const sheetArea = sheet.width * sheet.height;
  const sheets = [];
  let remaining = [...instances];

  while (remaining.length > 0) {
    let freeRects = [{ x: 0, y: 0, w: sheet.width, h: sheet.height }];
    const placements = [];
    const nextRemaining = [];
    let placedAny = false;

    for (const inst of remaining) {
      const result = bestAreaFit(inst, freeRects);
      if (result) {
        const { rect, rotated } = result;
        const pw = rotated ? inst.height : inst.width;
        const ph = rotated ? inst.width  : inst.height;
        placements.push({
          pieceId: inst.pieceId,
          instanceIndex: inst.instanceIndex,
          x: rect.x, y: rect.y, width: pw, height: ph,
          rotated,
          name: inst.name,
          origWidth: inst.width,
          origHeight: inst.height,
          edgeBanding: rotateEB(inst.edgeBanding, rotated),
        });
        freeRects = splitFreeRects(freeRects, { x: rect.x, y: rect.y, w: pw, h: ph });
        placedAny = true;
      } else {
        nextRemaining.push(inst);
      }
    }

    if (!placedAny) {
      for (const inst of nextRemaining)
        unplaceable.push({ pieceId: inst.pieceId, name: inst.name, instanceIndex: inst.instanceIndex });
      break;
    }

    const usedArea = placements.reduce((s, p) => s + p.width * p.height, 0);
    const wastePercent = ((sheetArea - usedArea) / sheetArea) * 100;
    sheets.push({ placements, wastePercent });
    remaining = nextRemaining;
  }

  return { sheets, totalSheets: sheets.length, unplacedPieces: unplaceable };
}

// ── Canvas Renderer ───────────────────────────────────────────────────────────
function drawSheet(canvas, sheetW, sheetH, placements) {
  const scale = canvas.width / sheetW;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 0.8;
  for (let i = -canvas.height; i < canvas.width + canvas.height; i += 18) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + canvas.height, canvas.height); ctx.stroke();
  }

  for (const p of placements) {
    const x = Math.round(p.x * scale);
    const y = Math.round(p.y * scale);
    const w = Math.round(p.width * scale);
    const h = Math.round(p.height * scale);
    const color = pieceColor(p.pieceId);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    const eb = p.edgeBanding;
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = EB_THICKNESS;
    ctx.lineCap = 'butt';
    if (eb.top)    { ctx.beginPath(); ctx.moveTo(x, y + EB_THICKNESS/2); ctx.lineTo(x + w, y + EB_THICKNESS/2); ctx.stroke(); }
    if (eb.bottom) { ctx.beginPath(); ctx.moveTo(x, y + h - EB_THICKNESS/2); ctx.lineTo(x + w, y + h - EB_THICKNESS/2); ctx.stroke(); }
    if (eb.left)   { ctx.beginPath(); ctx.moveTo(x + EB_THICKNESS/2, y); ctx.lineTo(x + EB_THICKNESS/2, y + h); ctx.stroke(); }
    if (eb.right)  { ctx.beginPath(); ctx.moveTo(x + w - EB_THICKNESS/2, y); ctx.lineTo(x + w - EB_THICKNESS/2, y + h); ctx.stroke(); }

    if (w > 30 && h > 22) {
      ctx.save();
      ctx.fillStyle = '#111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = Math.min(13, Math.max(8, Math.floor(Math.min(w, h) / 5)));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const label = (p.name || LANG.defaultPieceName) + (p.rotated ? ' ↺' : '');
      ctx.fillText(label, x + w / 2, y + h / 2 - (h > 36 ? fontSize * 0.7 : 0), w - 6);
      if (h > 36) {
        ctx.font = `${Math.max(7, fontSize - 2)}px sans-serif`;
        ctx.fillStyle = '#444';
        const dimLabel = `${p.origWidth}×${p.origHeight}`;
        ctx.fillText(dimLabel, x + w / 2, y + h / 2 + fontSize * 0.8, w - 6);
      }
      ctx.restore();
    }
  }
}

function makeCanvas(sheetW, sheetH, placements) {
  const canvas = document.createElement('canvas');
  const scale = CANVAS_MAX_W / sheetW;
  canvas.width  = CANVAS_MAX_W;
  canvas.height = Math.round(sheetH * scale);
  canvas.style.width  = '100%';
  canvas.style.height = 'auto';
  drawSheet(canvas, sheetW, sheetH, placements);
  return canvas;
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
function saveState() {
  try {
    const { projectName, unit, sheet, pieces, hardware } = AppState;
    localStorage.setItem('mdfcutlist', JSON.stringify({ projectName, unit, sheet, pieces, hardware }));
  } catch(_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('mdfcutlist');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.projectName !== undefined) AppState.projectName = saved.projectName;
    if (saved.unit)     AppState.unit = saved.unit;
    if (saved.sheet)    Object.assign(AppState.sheet, saved.sheet);
    if (Array.isArray(saved.pieces))   AppState.pieces   = saved.pieces;
    if (Array.isArray(saved.hardware)) AppState.hardware = saved.hardware;
    for (const pc of AppState.pieces) {
      pc.edgeBanding = pc.edgeBanding || { top: false, bottom: false, left: false, right: false };
    }
    for (const pc of AppState.pieces)   { const n = parseInt(pc.id?.slice(1)); if (n >= _uid) _uid = n + 1; }
    for (const hw of AppState.hardware) { const n = parseInt(hw.id?.slice(1)); if (n >= _uid) _uid = n + 1; }
  } catch(_) {}
}

// ── i18n: apply all static strings from LANG ─────────────────────────────────
function applyLang() {
  document.title = LANG.pageTitle;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (typeof LANG[key] === 'string') el.textContent = LANG[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (typeof LANG[key] === 'string') el.placeholder = LANG[key];
  });
}

// ── DOM Rendering ─────────────────────────────────────────────────────────────
function renderSheetConfig() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === AppState.sheet.presetKey);
  });
  document.getElementById('sheetW').value = toDisplay(AppState.sheet.width);
  document.getElementById('sheetH').value = toDisplay(AppState.sheet.height);
  document.querySelectorAll('#unitToggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === AppState.unit);
  });
}

function renderPieceRow(pc) {
  const div = document.createElement('div');
  div.className = 'piece-row' + (pc.quantity <= 0 ? ' zero-qty' : '');
  div.dataset.id = pc.id;

  const eb = pc.edgeBanding;
  div.innerHTML = `
    <div class="piece-row-top">
      <label>${LANG.pieceNameLabel}<input type="text" class="piece-name" value="${escHtml(pc.name)}" placeholder="${escHtml(LANG.pieceNamePlaceholder)}"></label>
      <label>${LANG.pieceQtyLabel}<input type="number" class="piece-qty" value="${pc.quantity}" min="0" step="1"></label>
    </div>
    <div class="piece-row-dims">
      <label>${LANG.pieceWidthLabel} (${AppState.unit})<input type="number" class="piece-w" value="${toDisplay(pc.width)}" min="0" step="1"></label>
      <label>${LANG.pieceLengthLabel} (${AppState.unit})<input type="number" class="piece-l" value="${toDisplay(pc.length)}" min="0" step="1"></label>
    </div>
    <div class="piece-row-bottom">
      <div class="edge-banding-group">
        <span>${LANG.pieceBandLabel}</span>
        <button class="edge-btn${eb.top    ? ' active' : ''}" data-edge="top"    title="${LANG.edgeTopTitle}">${LANG.edgeTopLabel}</button>
        <button class="edge-btn${eb.bottom ? ' active' : ''}" data-edge="bottom" title="${LANG.edgeBottomTitle}">${LANG.edgeBottomLabel}</button>
        <button class="edge-btn${eb.left   ? ' active' : ''}" data-edge="left"   title="${LANG.edgeLeftTitle}">${LANG.edgeLeftLabel}</button>
        <button class="edge-btn${eb.right  ? ' active' : ''}" data-edge="right"  title="${LANG.edgeRightTitle}">${LANG.edgeRightLabel}</button>
      </div>
      <div class="piece-actions">
        <button class="btn-dup" title="${LANG.btnDupTitle}">⧉</button>
        <button class="btn-del" title="${LANG.btnDelTitle}">✕</button>
      </div>
    </div>`;
  return div;
}

function renderCutList() {
  const container = document.getElementById('cutListRows');
  container.innerHTML = '';
  for (const pc of AppState.pieces) {
    container.appendChild(renderPieceRow(pc));
  }
}

function renderHardwareRow(hw) {
  const div = document.createElement('div');
  div.className = 'hw-row';
  div.dataset.id = hw.id;
  div.innerHTML = `
    <input type="text"   class="hw-desc" value="${escHtml(hw.description)}" placeholder="${escHtml(LANG.hwDescPlaceholder)}">
    <input type="number" class="hw-qty"  value="${hw.quantity}" min="0" step="1">
    <button class="btn-del-hw" title="${LANG.btnRemoveTitle}">✕</button>`;
  return div;
}

function renderHardwareList() {
  const container = document.getElementById('hardwareRows');
  container.innerHTML = '';
  for (const hw of AppState.hardware) {
    container.appendChild(renderHardwareRow(hw));
  }
}

function renderRightPanel() {
  const result = AppState.nestingResult;
  const allPieces = AppState.pieces.filter(p => (p.quantity || 0) > 0 && p.width > 0 && p.length > 0);

  document.getElementById('sumSheets').textContent = result.totalSheets || '—';

  if (result.sheets.length > 0) {
    const avgWaste = result.sheets.reduce((s, sh) => s + sh.wastePercent, 0) / result.sheets.length;
    document.getElementById('sumWaste').textContent = avgWaste.toFixed(1) + '%';
  } else {
    document.getElementById('sumWaste').textContent = '—';
  }

  const totalInstances = AppState.pieces.reduce((s, p) => s + Math.max(0, p.quantity || 0), 0);
  document.getElementById('sumPieces').textContent = totalInstances || '—';

  const banner = document.getElementById('warningBanner');
  if (result.unplacedPieces.length > 0) {
    const names = [...new Set(result.unplacedPieces.map(u => u.name))].join(', ');
    banner.textContent = LANG.warningUnplaced(result.unplacedPieces.length, names);
    banner.classList.add('show');
  } else {
    banner.textContent = '';
    banner.classList.remove('show');
  }

  const emptyState = document.getElementById('emptyState');
  const canvasContainer = document.getElementById('sheetCanvases');

  if (allPieces.length === 0) {
    emptyState.classList.add('show');
    canvasContainer.innerHTML = '';
    return;
  }
  emptyState.classList.remove('show');

  canvasContainer.innerHTML = '';
  const { width, height } = AppState.sheet;

  result.sheets.forEach((sh, i) => {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    card.innerHTML = `
      <div class="sheet-card-header">
        <h3>${LANG.sheetCardTitle(i + 1, result.totalSheets)}</h3>
        <span class="waste-label">${LANG.wasteLabel} ${sh.wastePercent.toFixed(1)}%</span>
      </div>
      <div class="sheet-canvas-wrap"></div>`;
    const wrap = card.querySelector('.sheet-canvas-wrap');
    const canvas = makeCanvas(width, height, sh.placements);
    wrap.appendChild(canvas);
    canvasContainer.appendChild(card);
  });
}

function renderCutListTable() {
  const tbody = document.getElementById('cutListTableBody');
  tbody.innerHTML = '';
  AppState.pieces.forEach((pc, i) => {
    const eb = pc.edgeBanding;
    const sides = [
      eb.top    ? '<span class="eb-badge">T</span>' : '',
      eb.bottom ? '<span class="eb-badge">B</span>' : '',
      eb.left   ? '<span class="eb-badge">L</span>' : '',
      eb.right  ? '<span class="eb-badge">R</span>' : '',
    ].join('');
    const ebCell = sides || `<span class="eb-none">${LANG.ebNoneLabel}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escHtml(pc.name) || '<span class="eb-none">—</span>'}</td>
      <td>${pc.quantity || 0}</td>
      <td>${toDisplay(pc.width)}</td>
      <td>${toDisplay(pc.length)}</td>
      <td>${ebCell}</td>`;
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderSheetConfig();
  renderCutList();
  renderHardwareList();
  renderRightPanel();
  renderCutListTable();
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Update cycle ──────────────────────────────────────────────────────────────
function update(mutation) {
  if (mutation) mutation();
  AppState.nestingResult = nestAllPieces(AppState.sheet, AppState.pieces);
  renderRightPanel();
  renderCutListTable();
  saveState();
}

// ── Event Binding ─────────────────────────────────────────────────────────────
document.getElementById('projectName').addEventListener('input', e => {
  AppState.projectName = e.target.value;
  saveState();
});

document.getElementById('unitToggle').addEventListener('click', e => {
  const btn = e.target.closest('button[data-unit]');
  if (!btn || btn.dataset.unit === AppState.unit) return;
  AppState.unit = btn.dataset.unit;
  renderSheetConfig();
  renderCutList();
  renderHardwareList();
  saveState();
});

document.getElementById('presetButtons').addEventListener('click', e => {
  const btn = e.target.closest('.preset-btn');
  if (!btn) return;
  const key = btn.dataset.preset;
  if (key === 'custom') {
    AppState.sheet.presetKey = 'custom';
    document.getElementById('sheetW').focus();
  } else {
    AppState.sheet.presetKey = key;
    AppState.sheet.width  = PRESETS[key].width;
    AppState.sheet.height = PRESETS[key].height;
  }
  update();
  renderSheetConfig();
});

function bindSheetInput(id, prop) {
  document.getElementById(id).addEventListener('change', e => {
    const val = fromDisplay(e.target.value);
    if (val > 0) {
      AppState.sheet[prop] = val;
      AppState.sheet.presetKey = 'custom';
    }
    update();
    renderSheetConfig();
  });
}
bindSheetInput('sheetW', 'width');
bindSheetInput('sheetH', 'height');

document.getElementById('btnAddPiece').addEventListener('click', () => {
  const pc = {
    id: uid(), name: '', quantity: 1, width: 0, length: 0,
    edgeBanding: { top: false, bottom: false, left: false, right: false }
  };
  AppState.pieces.push(pc);
  const container = document.getElementById('cutListRows');
  container.appendChild(renderPieceRow(pc));
  update();
});

document.getElementById('cutListRows').addEventListener('input', e => {
  const row = e.target.closest('.piece-row');
  if (!row) return;
  const pc = AppState.pieces.find(p => p.id === row.dataset.id);
  if (!pc) return;
  if (e.target.classList.contains('piece-name'))  pc.name     = e.target.value;
  if (e.target.classList.contains('piece-qty'))   { pc.quantity = Math.max(0, parseInt(e.target.value) || 0); row.classList.toggle('zero-qty', pc.quantity <= 0); }
  if (e.target.classList.contains('piece-w'))     pc.width    = fromDisplay(e.target.value);
  if (e.target.classList.contains('piece-l'))     pc.length   = fromDisplay(e.target.value);
  update();
});

document.getElementById('cutListRows').addEventListener('click', e => {
  const row = e.target.closest('.piece-row');
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.closest('.edge-btn')) {
    const pc = AppState.pieces.find(p => p.id === id);
    if (!pc) return;
    const edge = e.target.dataset.edge;
    pc.edgeBanding[edge] = !pc.edgeBanding[edge];
    e.target.classList.toggle('active', pc.edgeBanding[edge]);
    update();
    return;
  }

  if (e.target.closest('.btn-dup')) {
    const idx = AppState.pieces.findIndex(p => p.id === id);
    if (idx === -1) return;
    const src = AppState.pieces[idx];
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.name = (copy.name || LANG.defaultPieceName) + LANG.copySuffix;
    AppState.pieces.splice(idx + 1, 0, copy);
    renderCutList();
    update();
    return;
  }

  if (e.target.closest('.btn-del')) {
    AppState.pieces = AppState.pieces.filter(p => p.id !== id);
    row.remove();
    update();
    return;
  }
});

document.getElementById('btnAddHardware').addEventListener('click', () => {
  const hw = { id: uid(), description: '', quantity: 1 };
  AppState.hardware.push(hw);
  const container = document.getElementById('hardwareRows');
  container.appendChild(renderHardwareRow(hw));
  saveState();
});

document.getElementById('hardwareRows').addEventListener('input', e => {
  const row = e.target.closest('.hw-row');
  if (!row) return;
  const hw = AppState.hardware.find(h => h.id === row.dataset.id);
  if (!hw) return;
  if (e.target.classList.contains('hw-desc')) hw.description = e.target.value;
  if (e.target.classList.contains('hw-qty'))  hw.quantity = Math.max(0, parseInt(e.target.value) || 0);
  saveState();
});

document.getElementById('hardwareRows').addEventListener('click', e => {
  if (!e.target.closest('.btn-del-hw')) return;
  const row = e.target.closest('.hw-row');
  if (!row) return;
  AppState.hardware = AppState.hardware.filter(h => h.id !== row.dataset.id);
  row.remove();
  saveState();
});

// ── PDF Export ────────────────────────────────────────────────────────────────
document.getElementById('btnExportPdf').addEventListener('click', exportPdf);

function exportPdf() {
  if (typeof window.jspdf === 'undefined') { alert(LANG.jspdfError); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pW = 210, pH = 297, mg = 14;
  let cy = mg;

  function checkPageBreak(needed) {
    if (cy + needed > pH - mg) { doc.addPage(); cy = mg; }
  }

  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(AppState.projectName || LANG.pdfUntitled, mg, cy); cy += 9;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  doc.text(
    `${LANG.pdfGenerated} ${new Date().toLocaleDateString()}  |  ${LANG.pdfSheetSize} ${toDisplay(AppState.sheet.width)} × ${toDisplay(AppState.sheet.height)} ${AppState.unit}  |  ${LANG.pdfSheetsNeeded} ${AppState.nestingResult.totalSheets}`,
    mg, cy
  );
  doc.setTextColor(0); cy += 10;

  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(LANG.pdfCutList, mg, cy); cy += 6;

  const totalW = pW - 2 * mg;
  const cols = [
    { label: LANG.pdfColName,         w: 55 },
    { label: LANG.pdfColQty,          w: 14 },
    { label: `${LANG.pdfColW} (${AppState.unit})`, w: 24 },
    { label: `${LANG.pdfColL} (${AppState.unit})`, w: 24 },
    { label: LANG.pdfColEdgeBanding,  w: 63 },
  ];

  function drawTableHeader(startY) {
    let cx = mg;
    doc.setFillColor(42, 157, 143); doc.setTextColor(255);
    doc.rect(mg, startY, totalW, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    for (const col of cols) {
      doc.text(col.label, cx + 2, startY + 5, { maxWidth: col.w - 3 });
      cx += col.w;
    }
    doc.setTextColor(0);
    return startY + 7;
  }

  function ebLabel(eb) {
    const parts = [];
    if (eb.top)    parts.push(LANG.pdfEbTop);
    if (eb.bottom) parts.push(LANG.pdfEbBot);
    if (eb.left)   parts.push(LANG.pdfEbLeft);
    if (eb.right)  parts.push(LANG.pdfEbRight);
    return parts.join(', ') || '—';
  }

  cy = drawTableHeader(cy);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  let rowBg = false;
  for (const pc of AppState.pieces) {
    checkPageBreak(7);
    if (cy === mg) cy = drawTableHeader(cy);
    if (rowBg) { doc.setFillColor(245, 245, 245); doc.rect(mg, cy, totalW, 6.5, 'F'); }
    rowBg = !rowBg;
    let cx = mg;
    const vals = [
      pc.name || '—',
      String(pc.quantity || 0),
      toDisplay(pc.width).toString(),
      toDisplay(pc.length).toString(),
      ebLabel(pc.edgeBanding),
    ];
    for (let i = 0; i < cols.length; i++) {
      doc.text(vals[i], cx + 2, cy + 4.5, { maxWidth: cols[i].w - 3 });
      cx += cols[i].w;
    }
    doc.setDrawColor(210); doc.line(mg, cy + 6.5, mg + totalW, cy + 6.5);
    cy += 6.5;
  }
  doc.setDrawColor(180); doc.rect(mg, cy - AppState.pieces.length * 6.5 - 7, totalW, AppState.pieces.length * 6.5 + 7);
  cy += 8;

  if (AppState.hardware.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(LANG.pdfHardware, mg, cy); cy += 6;

    const hwCols = [{ label: LANG.pdfColDescription, w: totalW - 30 }, { label: LANG.pdfColQty, w: 30 }];
    let cx = mg;
    doc.setFillColor(42, 157, 143); doc.setTextColor(255);
    doc.rect(mg, cy, totalW, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    for (const c of hwCols) { doc.text(c.label, cx + 2, cy + 5); cx += c.w; }
    doc.setTextColor(0); cy += 7;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    rowBg = false;
    for (const hw of AppState.hardware) {
      checkPageBreak(7);
      if (rowBg) { doc.setFillColor(245,245,245); doc.rect(mg, cy, totalW, 6.5, 'F'); }
      rowBg = !rowBg;
      cx = mg;
      doc.text(hw.description || '—', cx + 2, cy + 4.5, { maxWidth: hwCols[0].w - 3 }); cx += hwCols[0].w;
      doc.text(String(hw.quantity || 0), cx + 2, cy + 4.5);
      doc.setDrawColor(210); doc.line(mg, cy + 6.5, mg + totalW, cy + 6.5);
      cy += 6.5;
    }
    doc.setDrawColor(180); doc.rect(mg, cy - AppState.hardware.length * 6.5 - 7, totalW, AppState.hardware.length * 6.5 + 7);
  }

  const { width: shW, height: shH } = AppState.sheet;
  const result = AppState.nestingResult;

  result.sheets.forEach((sh, i) => {
    doc.addPage();
    cy = mg;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(LANG.pdfSheetTitle(i + 1, result.totalSheets), mg, cy);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
    doc.text(`${LANG.pdfWaste} ${sh.wastePercent.toFixed(1)}%  |  ${toDisplay(shW)} × ${toDisplay(shH)} ${AppState.unit}`, mg + 60, cy);
    doc.setTextColor(0); cy += 6;

    const hiCanvas = document.createElement('canvas');
    const scale2 = (CANVAS_MAX_W * 2) / shW;
    hiCanvas.width  = CANVAS_MAX_W * 2;
    hiCanvas.height = Math.round(shH * scale2);
    drawSheet(hiCanvas, shW, shH, sh.placements);

    const imgData = hiCanvas.toDataURL('image/png');
    const imgW = pW - 2 * mg;
    const imgH = (hiCanvas.height / hiCanvas.width) * imgW;
    doc.addImage(imgData, 'PNG', mg, cy, imgW, imgH);
  });

  doc.save(`${(AppState.projectName || 'cutlist').replace(/\s+/g, '_')}.pdf`);
}

// Cut list panel toggle
document.getElementById('cutListPanelHeader').addEventListener('click', () => {
  const panel = document.getElementById('cutListPanel');
  const label = document.getElementById('cutListToggleLabel');
  const collapsed = panel.classList.toggle('collapsed');
  label.textContent = collapsed ? LANG.toggleShow : LANG.toggleHide;
});

// ── Init ──────────────────────────────────────────────────────────────────────
applyLang();
loadState();
document.getElementById('projectName').value = AppState.projectName;
update();
renderAll();
