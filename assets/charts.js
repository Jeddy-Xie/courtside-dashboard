// Small SVG charts: one y-axis, recessive grid, 2px lines, direct end labels, crosshair/hover tooltips, table view.
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const usd = (x) => (x < 0 ? "−$" : x > 0 ? "+$" : "$") + Math.abs(x).toFixed(2);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => span / x <= n) || mag * 10;
  const out = [], top = Math.ceil(hi / step - 1e-9) * step;  // last tick at or above the max, so no mark overflows
  for (let v = Math.floor(lo / step + 1e-9) * step; v <= top + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function frame(host, { w = 720, h = 280, l = 52, r = 96, t = 14, b = 30 } = {}) {
  host.innerHTML = ""; host.classList.add("chart");
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" }, host);
  const tip = document.createElement("div"); tip.className = "tip"; host.appendChild(tip);
  return { svg, tip, w, h, l, r, t, b, iw: w - l - r, ih: h - t - b };
}

function yAxis(f, ticks, y, fmt) {
  const g = el("g", { class: "grid" }, f.svg), a = el("g", { class: "axis" }, f.svg);
  ticks.forEach((v) => { el("line", { x1: f.l, x2: f.l + f.iw, y1: y(v), y2: y(v) }, g);
    el("text", { x: f.l - 8, y: y(v) + 4, "text-anchor": "end" }, a).textContent = fmt(v); });
}

function watermark(f, text) {
  if (!text) return;
  el("text", { class: "water", x: f.l + f.iw / 2, y: f.t + f.ih / 2 + 18, "text-anchor": "middle" }, f.svg).textContent = text;
}

// series: [{key,label,color,points:[[x,y],...]}]; x numeric
function lineChart(host, series, o = {}) {
  const f = frame(host, o.size);
  const xs = series.flatMap((s) => s.points.map((p) => p[0])), ys = series.flatMap((s) => s.points.map((p) => p[1]));
  const x0 = o.xMin ?? Math.min(...xs), x1 = o.xMax ?? Math.max(...xs);
  const z = o.zeroBase === false ? [] : [0];  // P&L anchors at zero; a threshold curve need not
  const ticks = niceTicks(Math.min(...z, ...ys, o.yMin ?? Infinity), Math.max(...z, ...ys, o.yMax ?? -Infinity));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (v) => f.l + ((v - x0) / (x1 - x0 || 1)) * f.iw, y = (v) => f.t + (1 - (v - lo) / (hi - lo || 1)) * f.ih;
  yAxis(f, ticks, y, o.yFmt || ((v) => v));
  watermark(f, o.watermark);
  if (lo < 0 && hi > 0) el("line", { class: "zero", x1: f.l, x2: f.l + f.iw, y1: y(0), y2: y(0) }, f.svg);
  const ax = el("g", { class: "axis" }, f.svg);
  (o.xTicks || niceTicks(x0, x1, 6)).forEach((v) => {
    el("text", { x: x(v), y: f.h - 8, "text-anchor": "middle" }, ax).textContent = (o.xFmt || ((v) => v))(v); });
  series.forEach((s) => {
    el("path", { d: s.points.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join(""),
      fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }, f.svg);
    const last = s.points[s.points.length - 1];
    if (o.endLabels !== false) el("text", { class: "lab", x: x(last[0]) + 8, y: y(last[1]) + 4 }, f.svg).textContent =
      s.label + "  " + (o.yFmt || ((v) => v))(last[1]);
  });
  (o.markers || []).forEach((m) => {
    el("circle", { cx: x(m.x), cy: y(m.y), r: 5, fill: m.color, stroke: css("--panel"), "stroke-width": 2 }, f.svg);
    el("text", { class: "lab", x: x(m.x) + (m.dx ?? 9), y: y(m.y) + (m.dy ?? -8), "text-anchor": m.anchor || "start" }, f.svg).textContent = m.label;
  });
  // crosshair + tooltip
  const xh = el("line", { class: "xhair", y1: f.t, y2: f.t + f.ih, visibility: "hidden" }, f.svg);
  const dots = series.map((s) => el("circle", { r: 4, fill: s.color, stroke: css("--panel"), "stroke-width": 2, visibility: "hidden" }, f.svg));
  const hit = el("rect", { x: f.l, y: f.t, width: f.iw, height: f.ih, fill: "transparent" }, f.svg);
  hit.addEventListener("mousemove", (ev) => {
    const r = f.svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * f.w;
    const xv = x0 + ((sx - f.l) / f.iw) * (x1 - x0);
    const rows = series.map((s, i) => { const p = s.points.reduce((a, b) => (Math.abs(b[0] - xv) < Math.abs(a[0] - xv) ? b : a));
      dots[i].setAttribute("cx", x(p[0])); dots[i].setAttribute("cy", y(p[1])); dots[i].setAttribute("visibility", "visible");
      return { s, p }; });
    const px = x(rows[0].p[0]); xh.setAttribute("x1", px); xh.setAttribute("x2", px); xh.setAttribute("visibility", "visible");
    f.tip.innerHTML = `<div class="t">${(o.tipX || o.xFmt || ((v) => v))(rows[0].p[0])}</div>` + rows.map(({ s, p }) =>
      `<div><span class="dot" style="background:${s.color}"></span>${s.label} ${(o.yFmt || ((v) => v))(p[1])}</div>`).join("");
    f.tip.style.display = "block";
    f.tip.style.left = Math.min((px / f.w) * r.width + 12, r.width - f.tip.offsetWidth - 4) + "px"; f.tip.style.top = "8px";
  });
  hit.addEventListener("mouseleave", () => { f.tip.style.display = "none"; xh.setAttribute("visibility", "hidden");
    dots.forEach((d) => d.setAttribute("visibility", "hidden")); });
}

// grouped bars: cats = [x...], series [{label,color,values:[...]}]; bars anchored to zero, 4px rounded data end
function barChart(host, cats, series, o = {}) {
  const f = frame(host, o.size);
  const ys = series.flatMap((s) => s.values), ticks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys));
  const lo = ticks[0], hi = ticks[ticks.length - 1], y = (v) => f.t + (1 - (v - lo) / (hi - lo || 1)) * f.ih;
  yAxis(f, ticks, y, o.yFmt || ((v) => v));
  watermark(f, o.watermark);
  const band = f.iw / cats.length, gap = 2, bw = Math.min(28, Math.max(2, (band - 6 - gap * (series.length - 1)) / series.length));
  const ax = el("g", { class: "axis" }, f.svg);
  cats.forEach((c, i) => { if (i % (o.every || 5) === 0 || i === cats.length - 1)
    el("text", { x: f.l + band * i + band / 2, y: f.h - 8, "text-anchor": "middle" }, ax).textContent = (o.xFmt || ((v) => v))(c); });
  series.forEach((s, k) => s.values.forEach((v, i) => {
    if (!v) return;
    const bx = f.l + band * i + (band - series.length * bw - gap * (series.length - 1)) / 2 + k * (bw + gap), top = y(Math.max(0, v)), bot = y(Math.min(0, v)), hgt = Math.max(1, bot - top), rr = Math.min(4, bw / 2, hgt);
    const d = v >= 0
      ? `M${bx} ${bot}V${top + rr}Q${bx} ${top} ${bx + rr} ${top}H${bx + bw - rr}Q${bx + bw} ${top} ${bx + bw} ${top + rr}V${bot}Z`
      : `M${bx} ${top}V${bot - rr}Q${bx} ${bot} ${bx + rr} ${bot}H${bx + bw - rr}Q${bx + bw} ${bot} ${bx + bw} ${bot - rr}V${top}Z`;
    const p = el("path", { d, fill: s.color }, f.svg);
    const hit = el("rect", { x: bx - 1, y: f.t, width: bw + 2, height: f.ih, fill: "transparent" }, f.svg);
    hit.addEventListener("mousemove", (ev) => { const r = f.svg.getBoundingClientRect();
      f.tip.innerHTML = `<div class="t">${(o.tipX || o.xFmt || ((v) => v))(cats[i])}</div><div><span class="dot" style="background:${s.color}"></span>${s.label} ${(o.yFmt || ((v) => v))(v)}</div>`;
      f.tip.style.display = "block"; p.setAttribute("opacity", ".75");
      f.tip.style.left = Math.min(((bx + bw) / f.w) * r.width + 8, r.width - f.tip.offsetWidth - 4) + "px"; f.tip.style.top = "8px"; });
    hit.addEventListener("mouseleave", () => { f.tip.style.display = "none"; p.removeAttribute("opacity"); });
  }));
  if (lo < 0) el("line", { class: "zero", x1: f.l, x2: f.l + f.iw, y1: y(0), y2: y(0) }, f.svg);
}

function tableView(host, head, rows, label = "Show as table") {
  const d = document.createElement("details"); d.className = "tv";
  d.innerHTML = `<summary>${label}</summary><table><thead><tr>${head.map((h, i) => `<th class="${i ? "n" : ""}">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const old = host.nextElementSibling;
  if (old && old.matches("details.tv")) old.replaceWith(d); else host.after(d);
}
