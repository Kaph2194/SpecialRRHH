// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · KIT VISUAL (VZ)
// Componentes reutilizables estilo Power BI / Tableau, sin librerías:
// tarjetas KPI, barras, columnas, líneas, donas, medidores, matriz de
// calor y tableros kanban (con arrastrar y soltar opcional).
// Todo devuelve HTML/SVG como texto. Estilos en analytics.css.
// ═══════════════════════════════════════════════════════════════

const VZ = (() => {
  const PALETA = ['#111f4d','#2563eb','#0d9488','#f59e0b','#7c3aed','#ea580c','#0ea5e9','#16a34a','#dc2626','#64748b'];
  const TONO = { navy:'#111f4d', blue:'#2563eb', teal:'#0d9488', green:'#16a34a', amber:'#f59e0b',
                 orange:'#ea580c', red:'#dc2626', purple:'#7c3aed', sky:'#0ea5e9', slate:'#64748b' };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color = (c, i = 0) => TONO[c] || c || PALETA[i % PALETA.length];
  const num = (n, dec = 0) => (Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: dec, minimumFractionDigits: 0 });

  // ── Sparkline ────────────────────────────────────────────
  function spark(values, { w = 90, h = 28, c = 'blue', area = true } = {}) {
    const v = (values || []).map(Number).filter(x => !isNaN(x));
    if (v.length < 2) return '';
    const mn = Math.min(...v), mx = Math.max(...v), rg = (mx - mn) || 1;
    const pts = v.map((y, i) => [ (i / (v.length - 1)) * (w - 2) + 1, h - 3 - ((y - mn) / rg) * (h - 6) ]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const col = color(c);
    const fill = area ? `<path d="${d}L${w - 1},${h}L1,${h}Z" fill="${col}" opacity=".12"/>` : '';
    const last = pts[pts.length - 1];
    return `<svg class="vz-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${fill}
      <path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2.4" fill="${col}"/></svg>`;
  }

  // ── Tarjeta KPI ──────────────────────────────────────────
  // { label, value, unit, sub, icon, tone, delta (número, %), deltaGoodUp (bool), trend [], onclick }
  function kpi(o) {
    const c = color(o.tone || 'navy');
    let delta = '';
    if (o.delta != null && isFinite(o.delta)) {
      const d = Number(o.delta);
      const bueno = o.deltaGoodUp === false ? d < 0 : d > 0;
      const cls = d === 0 ? 'flat' : (bueno ? 'up' : 'down');
      delta = `<span class="vz-delta ${cls}" title="Variación frente al periodo anterior">${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${num(Math.abs(d), 1)}%</span>`;
    }
    const click = o.onclick ? ` is-click" onclick="${esc(o.onclick)}" role="button" tabindex="0` : '';
    return `<div class="vz-kpi${click}" style="--kpi-c:${c}">
      <div class="vz-kpi-top">
        <div class="vz-kpi-label">${esc(o.label)}</div>
        ${o.icon ? `<div class="vz-kpi-icon">${o.icon}</div>` : ''}
      </div>
      <div class="vz-kpi-value">${esc(o.value)}${o.unit ? `<small>${esc(o.unit)}</small>` : ''}</div>
      <div class="vz-kpi-foot">
        <div class="vz-kpi-sub">${delta} ${o.sub ? esc(o.sub) : ''}</div>
        ${o.trend ? spark(o.trend, { c: o.tone || 'blue' }) : ''}
      </div>
    </div>`;
  }

  // ── Panel ────────────────────────────────────────────────
  function panel(title, body, { sub = '', span = 6, actions = '', id = '' } = {}) {
    return `<div class="vz-panel vz-span-${span}" ${id ? `id="${esc(id)}"` : ''}>
      <div class="vz-panel-head"><div><div class="vz-panel-title">${esc(title)}</div>
        ${sub ? `<div class="vz-panel-sub">${esc(sub)}</div>` : ''}</div>${actions}</div>
      <div class="vz-panel-body">${body}</div></div>`;
  }

  const empty = (msg = 'Sin datos para mostrar') => `<div class="vz-empty">${esc(msg)}</div>`;

  // ── Barras horizontales ─────────────────────────────────
  // items: [{label, value, color, onclick}]
  function bars(items, { max, unit = '', limit = 12, sort = true } = {}) {
    let it = (items || []).filter(x => x && x.value != null);
    if (!it.length) return empty();
    if (sort) it = it.slice().sort((a, b) => b.value - a.value);
    const resto = it.length > limit ? it.slice(limit) : [];
    it = it.slice(0, limit);
    if (resto.length) it.push({ label: `Otros (${resto.length})`, value: resto.reduce((s, x) => s + x.value, 0), color: '#94a3b8' });
    const m = max || Math.max(...it.map(x => x.value), 1);
    return it.map((x, i) => `
      <div class="vz-hbar${x.onclick ? ' is-click' : ''}" ${x.onclick ? `onclick="${esc(x.onclick)}"` : ''} title="${esc(x.label)}: ${num(x.value, 1)}${esc(unit)}">
        <div class="vz-hbar-label">${esc(x.label)}</div>
        <div class="vz-hbar-track"><div class="vz-hbar-fill" style="width:${Math.max(2, (x.value / m) * 100)}%;background:${color(x.color, i)}"></div></div>
        <div class="vz-hbar-val">${num(x.value, 1)}${esc(unit)}</div>
      </div>`).join('');
  }

  // ── Columnas (una o varias series) ──────────────────────
  // labels: [..], series: [{name, values:[..], color}]
  function columns(labels, series, { h = 190, stacked = false, unit = '' } = {}) {
    if (!labels?.length || !series?.length) return empty();
    const W = 560, H = h, padL = 30, padB = 26, padT = 10;
    const n = labels.length, gw = (W - padL - 6) / n;
    const totals = labels.map((_, i) => stacked ? series.reduce((s, se) => s + (Number(se.values[i]) || 0), 0)
                                                 : Math.max(...series.map(se => Number(se.values[i]) || 0)));
    const mx = Math.max(...totals, 1);
    const yScale = v => (v / mx) * (H - padB - padT);
    const ticks = [0, .5, 1].map(t => {
      const y = H - padB - t * (H - padB - padT);
      return `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" stroke="#eef1f7"/>
              <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${num(mx * t)}</text>`;
    }).join('');
    let barsSvg = '';
    labels.forEach((lb, i) => {
      const x0 = padL + i * gw + gw * .14, bw = gw * .72;
      if (stacked) {
        let acc = 0;
        series.forEach((se, si) => {
          const v = Number(se.values[i]) || 0; if (!v) return;
          const hh = yScale(v), y = H - padB - yScale(acc) - hh; acc += v;
          barsSvg += `<rect x="${x0}" y="${y}" width="${bw}" height="${hh}" rx="2" fill="${color(se.color, si)}"><title>${esc(lb)} · ${esc(se.name)}: ${num(v, 1)}${esc(unit)}</title></rect>`;
        });
      } else {
        const sw = bw / series.length;
        series.forEach((se, si) => {
          const v = Number(se.values[i]) || 0, hh = yScale(v);
          barsSvg += `<rect x="${x0 + si * sw}" y="${H - padB - hh}" width="${Math.max(1, sw - 2)}" height="${hh}" rx="2" fill="${color(se.color, si)}"><title>${esc(lb)} · ${esc(se.name)}: ${num(v, 1)}${esc(unit)}</title></rect>`;
        });
      }
      barsSvg += `<text x="${x0 + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#64748b">${esc(lb)}</text>`;
    });
    const legend = series.length > 1 ? `<div class="vz-legend">${series.map((se, si) => `<span><i style="background:${color(se.color, si)}"></i>${esc(se.name)}</span>`).join('')}</div>` : '';
    return `<svg class="vz-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" style="height:${H}px">${ticks}${barsSvg}</svg>${legend}`;
  }

  // ── Líneas ──────────────────────────────────────────────
  function line(labels, series, { h = 190, unit = '', meta = null } = {}) {
    if (!labels?.length || !series?.length) return empty();
    const W = 560, H = h, padL = 34, padB = 26, padT = 12, padR = 10;
    const all = series.flatMap(s => s.values.map(Number).filter(v => !isNaN(v)));
    if (meta != null) all.push(Number(meta));
    if (!all.length) return empty();
    let mn = Math.min(0, ...all), mx = Math.max(...all, 1);
    const rg = (mx - mn) || 1;
    const xs = i => padL + (labels.length === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (labels.length - 1));
    const ys = v => H - padB - ((v - mn) / rg) * (H - padB - padT);
    const ticks = [0, .5, 1].map(t => {
      const v = mn + rg * t, y = ys(v);
      return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#eef1f7"/>
              <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${num(v, 1)}</text>`;
    }).join('');
    const metaSvg = meta != null ? `<line x1="${padL}" x2="${W - padR}" y1="${ys(meta)}" y2="${ys(meta)}" stroke="#dc2626" stroke-dasharray="4 4" stroke-width="1.2"/>
      <text x="${W - padR}" y="${ys(meta) - 4}" text-anchor="end" font-size="9" fill="#dc2626">Meta ${num(meta, 1)}${esc(unit)}</text>` : '';
    const paths = series.map((se, si) => {
      const c = color(se.color, si);
      const pts = se.values.map((v, i) => v == null || isNaN(Number(v)) ? null : [xs(i), ys(Number(v)), Number(v), labels[i]]);
      let d = '', started = false;
      pts.forEach(p => { if (!p) { started = false; return; } d += `${started ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; started = true; });
      const dots = pts.filter(Boolean).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff" stroke="${c}" stroke-width="2"><title>${esc(p[3])} · ${esc(se.name)}: ${num(p[2], 2)}${esc(unit)}</title></circle>`).join('');
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>${dots}`;
    }).join('');
    const step = Math.ceil(labels.length / 12);
    const xl = labels.map((lb, i) => i % step ? '' : `<text x="${xs(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#64748b">${esc(lb)}</text>`).join('');
    const legend = series.length > 1 ? `<div class="vz-legend">${series.map((se, si) => `<span><i style="background:${color(se.color, si)}"></i>${esc(se.name)}</span>`).join('')}</div>` : '';
    return `<svg class="vz-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" style="height:${H}px">${ticks}${metaSvg}${paths}${xl}</svg>${legend}`;
  }

  // ── Dona ────────────────────────────────────────────────
  function donut(segments, { size = 132, center = null, centerSub = '' } = {}) {
    const seg = (segments || []).filter(s => s.value > 0);
    const total = seg.reduce((s, x) => s + x.value, 0);
    if (!total) return empty();
    const r = 46, cx = 60, cy = 60, sw = 16, circ = 2 * Math.PI * r;
    let off = 0;
    const arcs = seg.map((s, i) => {
      const f = s.value / total, dash = f * circ;
      const a = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color(s.color, i)}" stroke-width="${sw}"
        stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off * circ}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label)}: ${num(s.value)} (${num(f * 100, 1)}%)</title></circle>`;
      off += f; return a;
    }).join('');
    const ctr = center ?? num(total);
    const svg = `<svg class="vz-svg" width="${size}" height="${size}" viewBox="0 0 120 120">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef1f7" stroke-width="${sw}"/>${arcs}
      <text x="60" y="${centerSub ? 60 : 65}" text-anchor="middle" font-size="18" font-weight="700" fill="#0d1a3a">${esc(ctr)}</text>
      ${centerSub ? `<text x="60" y="76" text-anchor="middle" font-size="9" fill="#64748b">${esc(centerSub)}</text>` : ''}</svg>`;
    const legend = `<div class="vz-legend">${seg.map((s, i) => `<span><i style="background:${color(s.color, i)}"></i>${esc(s.label)}<b>${num(s.value)}</b> <span style="color:#94a3b8">${num(s.value / total * 100, 0)}%</span></span>`).join('')}</div>`;
    return `<div class="vz-donut-wrap">${svg}${legend}</div>`;
  }

  // ── Medidor semicircular ────────────────────────────────
  function gauge(pct, { label = '', size = 150, thresholds = [60, 85] } = {}) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const c = p >= thresholds[1] ? '#16a34a' : p >= thresholds[0] ? '#f59e0b' : '#dc2626';
    const r = 50, len = Math.PI * r;
    return `<div class="vz-gauge"><svg class="vz-svg" width="${size}" height="${size * .62}" viewBox="0 0 120 74">
      <path d="M10,64 A50,50 0 0 1 110,64" fill="none" stroke="#eef1f7" stroke-width="12" stroke-linecap="round"/>
      <path d="M10,64 A50,50 0 0 1 110,64" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${(p / 100) * len} ${len}"/>
      <text x="60" y="58" text-anchor="middle" font-size="20" font-weight="800" fill="#0d1a3a">${num(p, 0)}%</text></svg>
      ${label ? `<div class="vz-gauge-label">${esc(label)}</div>` : ''}</div>`;
  }

  // ── Barra de progreso ───────────────────────────────────
  function progress(pct, c) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const col = c ? color(c) : (p >= 85 ? '#16a34a' : p >= 60 ? '#f59e0b' : '#dc2626');
    return `<div class="vz-progress"><div style="width:${p}%;background:${col}"></div></div>`;
  }

  // ── Semáforo para un valor frente a una meta ────────────
  // sentido 'mayor' = más es mejor; 'menor' = menos es mejor
  function semaforo(valor, meta, sentido = 'mayor') {
    if (valor == null || meta == null || isNaN(valor) || isNaN(meta)) return { c: '#94a3b8', txt: 'Sin medir', k: 'gris' };
    const v = Number(valor), m = Number(meta);
    const ok = sentido === 'menor' ? v <= m : v >= m;
    const cerca = sentido === 'menor' ? v <= m * 1.15 : v >= m * 0.85;
    if (ok)    return { c: '#16a34a', txt: 'En meta', k: 'verde' };
    if (cerca) return { c: '#f59e0b', txt: 'En riesgo', k: 'amarillo' };
    return { c: '#dc2626', txt: 'Fuera de meta', k: 'rojo' };
  }

  // ── Kanban ──────────────────────────────────────────────
  // columns: [{key, title, color, cards:[{id, title, sub, color, chips:[{t,c}], onclick, actions}]}]
  // opts: { id, limit, draggable, onDrop: 'nombreFuncionGlobal' }  →  window[onDrop](cardId, toKey)
  function kanban(columns, { id = 'vzk' + Math.random().toString(36).slice(2, 7), limit = 30, onDrop = null } = {}) {
    const drag = !!onDrop;
    const cols = columns.map(col => {
      const cards = col.cards || [];
      const vis = cards.slice(0, limit);
      const body = vis.length ? vis.map(cd => `
        <div class="vz-card" style="--card-c:${color(cd.color || col.color)}" data-id="${esc(cd.id)}"
             ${drag ? `draggable="true" ondragstart="VZ._ds(event)" ondragend="VZ._de(event)"` : ''}
             ${cd.onclick ? `onclick="${esc(cd.onclick)}"` : ''}>
          <div class="vz-card-title">${esc(cd.title)}</div>
          ${cd.sub ? `<div class="vz-card-sub">${esc(cd.sub)}</div>` : ''}
          ${cd.chips?.length ? `<div class="vz-card-meta">${cd.chips.map(ch => `<span class="vz-chip ${ch.c ? 'c-' + ch.c : ''}">${esc(ch.t)}</span>`).join('')}</div>` : ''}
          ${cd.actions ? `<div class="vz-card-actions" onclick="event.stopPropagation()">${cd.actions}</div>` : ''}
        </div>`).join('') : `<div class="vz-col-empty">Sin elementos</div>`;
      const more = cards.length > limit ? `<div class="vz-col-more">+ ${cards.length - limit} más</div>` : '';
      return `<div class="vz-col" style="--col-c:${color(col.color)}" data-key="${esc(col.key)}"
                ${drag ? `ondragover="VZ._do(event)" ondragleave="VZ._dl(event)" ondrop="VZ._dp(event,'${esc(onDrop)}')"` : ''}>
        <div class="vz-col-head"><span class="vz-col-title">${esc(col.title)}</span><span class="vz-col-count">${cards.length}</span></div>
        <div class="vz-col-body">${body}${more}</div></div>`;
    }).join('');
    return `<div class="vz-kanban" id="${esc(id)}">${cols}</div>`;
  }
  // Arrastrar y soltar
  function _ds(e) { e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); }
  function _de(e) { e.currentTarget.classList.remove('dragging'); }
  function _do(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
  function _dl(e) { e.currentTarget.classList.remove('drag-over'); }
  function _dp(e, fn) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    const cardId = e.dataTransfer.getData('text/plain'), toKey = e.currentTarget.dataset.key;
    if (cardId && typeof window[fn] === 'function') window[fn](cardId, toKey);
  }

  // ── Selector Tabla / Kanban ─────────────────────────────
  function toggle(actual, opciones, onchange) {
    return `<div class="vz-toggle" role="group">${opciones.map(o =>
      `<button class="${o.k === actual ? 'on' : ''}" onclick="${esc(onchange)}('${esc(o.k)}')">${esc(o.t)}</button>`).join('')}</div>`;
  }

  // ── Utilidades de fechas ────────────────────────────────
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function ultimosMeses(n = 6, desde = new Date()) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(desde.getFullYear(), desde.getMonth() - i, 1);
      out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES[d.getMonth()] });
    }
    return out;
  }
  const pctVar = (act, ant) => (ant ? ((act - ant) / ant) * 100 : (act ? 100 : 0));

  return { esc, num, color, spark, kpi, panel, empty, bars, columns, line, donut, gauge, progress, semaforo,
           kanban, toggle, ultimosMeses, pctVar, MESES, PALETA, _ds, _de, _do, _dl, _dp };
})();
window.VZ = VZ;
