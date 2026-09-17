// Flange Torque Builder -- client logic. Talks to the FastAPI backend
// (/api/extract, /api/generate, /api/qc-defaults) running alongside this
// static page. No data goes anywhere except that one server.

const $ = (id) => document.getElementById(id);

const DEFAULT_JOB = {
  system: 'PH02', workPack: 'N/A', customer: '', operator: '',
  job: '', site: ''
};

let job = load('flange_job', DEFAULT_JOB);
let qc = load('flange_qc', null); // filled from server on first load
let pendingFiles = [];
let reports = load('flange_reports', []);
let lastExtracted = [];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

// ---------- Job info ----------
function renderJob() {
  $('jSystem').value = job.system || '';
  $('jWorkPack').value = job.workPack || '';
  $('jCustomer').value = job.customer || '';
  $('jOperator').value = job.operator || '';
  $('jJob').value = job.job || '';
  $('jSite').value = job.site || '';
}
['jSystem','jWorkPack','jCustomer','jOperator','jJob','jSite'].forEach(id => {
  $(id).addEventListener('input', () => {
    const map = {jSystem:'system', jWorkPack:'workPack', jCustomer:'customer',
      jOperator:'operator', jJob:'job', jSite:'site'};
    job[map[id]] = $(id).value;
    save('flange_job', job);
  });
});

// ---------- QC table ----------
function findQcRow(size, cls) {
  const norm = s => String(s).replace(/["\s]/g,'').toLowerCase();
  return qc.find(r => norm(r.size) === norm(size) && String(r.cls).trim() === String(cls).trim());
}
function renderQc() {
  let rows = qc.map((r, i) => `
    <tr>
      <td><input value="${r.size}" data-i="${i}" data-f="size"></td>
      <td><input value="${r.cls}" data-i="${i}" data-f="cls"></td>
      <td><input value="${r.boltOD}" data-i="${i}" data-f="boltOD"></td>
      <td><input value="${r.boltCount}" data-i="${i}" data-f="boltCount"></td>
      <td><input value="${r.tMin}" data-i="${i}" data-f="tMin"></td>
      <td><input value="${r.tMax}" data-i="${i}" data-f="tMax"></td>
      <td class="qc-row-actions"><button class="btn danger small" data-del="${i}">&times;</button></td>
    </tr>`).join('');
  $('qcTable').innerHTML = `
    <table><thead><tr>
      <th>Size</th><th>Class</th><th>Bolt OD</th><th>Bolt Ct</th><th>Torque Min</th><th>Torque Max</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  $('qcTable').querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      qc[i][f] = ['cls','boltCount','tMin','tMax'].includes(f) ? Number(inp.value) : inp.value;
      save('flange_qc', qc);
    });
  });
  $('qcTable').querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      qc.splice(+btn.dataset.del, 1);
      save('flange_qc', qc);
      renderQc();
    });
  });
}
$('addQcRow').addEventListener('click', () => {
  qc.push({size:'', cls:150, boltOD:'', boltCount:8, tMin:45, tMax:45, ratios:[0.33,0.67,1,1]});
  save('flange_qc', qc);
  renderQc();
});
$('resetQc').addEventListener('click', async () => {
  const r = await fetch('/api/qc-defaults').then(r => r.json());
  qc = r.qc;
  save('flange_qc', qc);
  renderQc();
});

// ---------- Upload / extract ----------
$('dropzone').addEventListener('click', (e) => { /* native label->input */ });
$('fileInput').addEventListener('change', (e) => addFiles(e.target.files));
$('dropzone').addEventListener('dragover', e => e.preventDefault());
$('dropzone').addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
  for (const f of fileList) pendingFiles.push(f);
  renderThumbs();
}
function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  pendingFiles.forEach(f => {
    const div = document.createElement('div');
    div.className = 't';
    const fn = document.createElement('div');
    fn.className = 'fn'; fn.textContent = f.name;
    if (f.type === 'application/pdf') {
      div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center';
      div.style.fontSize = '22px'; div.style.color = '#fff';
      div.textContent = '📄';
    } else {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      div.appendChild(img);
    }
    div.appendChild(fn);
    box.appendChild(div);
  });
  $('extractBtn').disabled = pendingFiles.length === 0;
  $('clearPhotosBtn').hidden = pendingFiles.length === 0;
}
$('clearPhotosBtn').addEventListener('click', () => {
  pendingFiles = [];
  $('fileInput').value = '';
  renderThumbs();
});

$('extractBtn').addEventListener('click', async () => {
  if (!pendingFiles.length) return;
  $('extractBtn').disabled = true;
  $('statusLine').hidden = false;
  $('statusText').textContent = pendingFiles.length > 1
    ? `Reading ${pendingFiles.length} files...` : 'Reading tag...';
  const fd = new FormData();
  pendingFiles.forEach(f => fd.append('files', f, f.name));
  try {
    const res = await fetch('/api/extract', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    const data = await res.json();
    lastExtracted = data.tags || [];
    if (data.errors && data.errors.length) {
      alert('Some files could not be read:\n' + data.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
    }
    renderReview(lastExtracted);
    pendingFiles = [];
    $('fileInput').value = '';
    renderThumbs();
  } catch (err) {
    alert("Couldn't read tags: " + err.message);
  } finally {
    $('statusLine').hidden = true;
    $('extractBtn').disabled = pendingFiles.length === 0;
  }
});

function computeDerived(d) {
  // d: {drawing, line, flangeNo, flangeSize, flangeClass, ...}
  const pid = d.line ? `${d.drawing} / ${d.line}` : (d.drawing || '');
  const flangeNo = `FL#${d.flangeNo || ''}`;
  const rule = findQcRow(d.flangeSize, d.flangeClass);
  return { pid, flangeNo, rule };
}

function renderReview(list) {
  const box = $('reviewList');
  box.innerHTML = '';
  list.forEach((d, idx) => {
    const { pid, flangeNo, rule } = computeDerived(d);
    const uncertain = new Set(d.uncertain || []);
    const mismatches = [];
    if (rule) {
      const normBolt = s => String(s || '').replace(/["\s]/g,'');
      if (normBolt(d.boltSize) !== normBolt(rule.boltOD)) mismatches.push('boltSize');
      const t = parseFloat(d.finalTorque);
      if (!isNaN(t) && (t < rule.tMin - 0.5 || t > rule.tMax + 0.5)) mismatches.push('finalTorque');
    }
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <h3>Tag ${escapeHtml(d.tag || '?')} <span class="tagn">${escapeHtml(d._source || '')}</span></h3>
      <div class="grid2">
        ${field('P&ID #', 'pid', pid, idx)}
        ${field('Flange #', 'flangeNoDisp', flangeNo, idx)}
        ${field('Flange Size', 'flangeSize', d.flangeSize, idx, mismatches.includes('flangeSize'))}
        ${field('Class', 'flangeClass', d.flangeClass, idx)}
        ${field('Bolt Size', 'boltSize', d.boltSize, idx, mismatches.includes('boltSize'))}
        ${field('Bolt Material', 'boltMaterial', d.boltMaterial, idx)}
        ${field('Final Torque', 'finalTorque', d.finalTorque, idx, mismatches.includes('finalTorque'))}
        ${field('Gasket', 'gasket', d.gasket, idx)}
        ${field('Lubricant Type', 'lubricantType', d.lubricantType, idx)}
        ${field('Insul. Kit (Yes/No/N-A)', 'insulKit', d.insulKit, idx)}
        ${field('Tool Serial', 'toolSerial', d.toolSerial, idx)}
        ${field('Technician', 'technician', d.technician, idx)}
        ${field('Date', 'technicianDate', d.technicianDate, idx)}
      </div>
      ${(uncertain.size || !rule) ? `<div class="note">${!rule ? '⚠ No matching QC standard for this size/class &mdash; add one below, or double-check bolt size/torque by hand. ' : ''}${uncertain.size ? '⚠ Flagged by the reader as uncertain: ' + [...uncertain].join(', ') : ''}</div>` : ''}
      <div class="btn-row">
        <button class="btn small" data-add="${idx}">Add to Report</button>
      </div>`;
    box.appendChild(card);
  });
  box.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.add;
      const card = btn.closest('.review-card');
      const get = f => card.querySelector(`[data-field="${f}"]`).value;
      const d = list[idx];
      const rule = findQcRow(get('flangeSize'), get('flangeClass'));
      const entry = buildEntry({
        pid: get('pid'), flangeNoDisp: get('flangeNoDisp'), tag: d.tag,
        flangeSize: get('flangeSize'), flangeClass: get('flangeClass'),
        boltSize: get('boltSize'), boltMaterial: get('boltMaterial'),
        finalTorque: get('finalTorque'), gasket: get('gasket'),
        lubricantType: get('lubricantType'), toolSerial: get('toolSerial'),
        technician: get('technician'), technicianDate: get('technicianDate'),
        insulKit: get('insulKit'), uncertain: d.uncertain,
      }, rule);
      reports.push(entry);
      save('flange_reports', reports);
      renderReports();
      btn.textContent = 'Added ✓';
      btn.disabled = true;
    });
  });
}
function field(label, key, val, idx, flagged) {
  return `<div class="field${flagged ? ' flag' : ''}"><label>${label}${flagged ? ' ⚠' : ''}</label>
    <input type="text" data-field="${key}" value="${escapeHtml(val || '')}"></div>`;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildEntry(fields, rule) {
  const torque = parseFloat(fields.finalTorque) || (rule ? rule.tMax : 0);
  const ratios = rule ? rule.ratios : [0.33, 0.67, 1, 1];
  const stages = ratios.map(r => Math.round(torque * r));
  const boltCount = rule ? rule.boltCount : 8;
  const comments = [];
  if (!rule) comments.push('No matching QC standard on file for this size/class -- verify bolt size and torque by hand.');
  if ((fields.uncertain || []).length) comments.push('Reader flagged as uncertain: ' + fields.uncertain.join(', ') + ' -- verify against the original tag.');
  return {
    tab: fields.tag || ('T' + Date.now()),
    pid: fields.pid,
    flange_no: fields.flangeNoDisp,
    tag: fields.tag,
    date: fields.technicianDate || '',
    size: fields.flangeSize,
    cls: fields.flangeClass,
    bolt_od: (rule ? rule.boltOD : fields.boltSize),
    boltcount: boltCount,
    torqued_by: fields.technician || '',
    stages: stages,
    tool_label: 'OTHER',
    tool_serial: fields.toolSerial || '',
    tool_cal: '',
    system: job.system || 'PH02',
    gasket: fields.gasket || '',
    lubricant_type: fields.lubricantType || '',
    joint_material: fields.gasket || '',
    bolt_material: fields.boltMaterial || '',
    insul_kit: fields.insulKit || '',
    comment: comments.join(' ') || null,
  };
}

// ---------- Manual entry ----------
function renderManualForm() {
  $('manualForm').innerHTML = `
    <div class="grid2">
      ${manualField('Tag #','mTag')}
      ${manualField('P&ID #','mPid')}
      ${manualField('Flange # (just the number)','mFlangeNo')}
      ${manualField('Flange Size (e.g. 6")','mSize')}
      ${manualField('Class','mClass','150')}
      ${manualField('Bolt Size','mBoltSize')}
      ${manualField('Final Torque','mTorque')}
      ${manualField('Gasket','mGasket','Rubber')}
      ${manualField('Lubricant Type','mLube','LB771')}
      ${manualField('Tool Serial #','mTool')}
      ${manualField('Torqued By (initials)','mBy')}
      ${manualField('Date','mDate')}
    </div>
    <div class="btn-row"><button class="btn small" id="manualAdd">Add to Report</button></div>`;
  $('manualAdd').addEventListener('click', () => {
    const v = id => $(id).value;
    const rule = findQcRow(v('mSize'), v('mClass'));
    const entry = buildEntry({
      pid: v('mPid'), flangeNoDisp: `FL#${v('mFlangeNo')}`, tag: v('mTag'),
      flangeSize: v('mSize'), flangeClass: v('mClass'), boltSize: v('mBoltSize'),
      finalTorque: v('mTorque'), gasket: v('mGasket'), lubricantType: v('mLube'),
      toolSerial: v('mTool'), technician: v('mBy'), technicianDate: v('mDate'),
      uncertain: [],
    }, rule);
    reports.push(entry);
    save('flange_reports', reports);
    renderReports();
    ['mTag','mPid','mFlangeNo','mSize','mBoltSize','mTorque','mTool','mBy','mDate']
      .forEach(id => $(id).value = '');
  });
}
function manualField(label, id, def) {
  return `<div class="field"><label>${label}</label><input type="text" id="${id}" value="${def || ''}"></div>`;
}

// ---------- Reports list ----------
function renderReports() {
  const box = $('reportsList');
  if (!reports.length) {
    box.innerHTML = '<div class="empty">No reports added yet.</div>';
  } else {
    box.innerHTML = reports.map((r, i) => `
      <div class="r">
        <div class="meta"><b>${escapeHtml(r.tag)} &mdash; ${escapeHtml(r.pid)} ${escapeHtml(r.flange_no)}</b>
        <span>${escapeHtml(r.size)}" ${escapeHtml(String(r.cls))} &middot; ${escapeHtml(r.bolt_od)} bolt &middot; ${r.stages[3]} ft-lb</span></div>
        <button class="btn ghost small" data-rm="${i}">Remove</button>
      </div>`).join('');
    box.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        reports.splice(+btn.dataset.rm, 1);
        save('flange_reports', reports);
        renderReports();
      });
    });
  }
  const has = reports.length > 0;
  $('genPdfBtn').disabled = !has;
  $('genXlsxBtn').disabled = !has;
  $('clearReportsBtn').disabled = !has;
  const cb = $('reportCount');
  if (has) { cb.style.display = 'inline-block'; cb.textContent = `${reports.length} flange${reports.length>1?'s':''}`; }
  else cb.style.display = 'none';
}
$('clearReportsBtn').addEventListener('click', () => {
  if (!confirm('Remove all reports from this list?')) return;
  reports = [];
  save('flange_reports', reports);
  renderReports();
});
async function generate(fmt) {
  $('genStatus').hidden = false;
  $('genPdfBtn').disabled = true; $('genXlsxBtn').disabled = true;
  try {
    const res = await fetch('/api/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ entries: reports, format: fmt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({detail: res.statusText}));
      throw new Error(err.detail || 'Server error');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fmt === 'xlsx' ? 'Flange_Torque_Report.xlsx' : 'Flange_Torque_Report.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Couldn't generate the report: " + err.message);
  } finally {
    $('genStatus').hidden = true;
    $('genPdfBtn').disabled = false; $('genXlsxBtn').disabled = false;
  }
}
$('genPdfBtn').addEventListener('click', () => generate('pdf'));
$('genXlsxBtn').addEventListener('click', () => generate('xlsx'));

// ---------- Init ----------
(async function init() {
  renderJob();
  if (!qc) {
    try {
      const r = await fetch('/api/qc-defaults').then(r => r.json());
      qc = r.qc;
    } catch (e) { qc = []; }
    save('flange_qc', qc);
  }
  renderQc();
  renderManualForm();
  renderReports();
})();
