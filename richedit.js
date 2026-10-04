"use strict";
/* Edición con formato en la página: campos de una línea (.rt-line) y la barra de formato
   (negrita, tamaño, color de letra, resaltado, subrayado de color, alineación) que sale al escribir en
   cualquier campo de texto o editor (.editor). La lógica de los tramos está en richtext.js (RT). */
const RE = (() => {
  const $bar = () => document.getElementById("format-bar");
  const ZW = "​"; // ancla invisible: marca dónde se escribe con otro estilo; no cuenta como texto
  const noZW = (s) => s.replace(/​/g, "");

  /* ----- posiciones dentro de un elemento (en caracteres de texto, igual que RT.fromDOM: sin contar anclas) ----- */
  function pointOffset(el, node, off) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(node, off);
    return noZW(r.toString()).length;
  }
  const lengthOf = (el) => RT.fromDOM(el).text.length;

  /* Selección actual dentro de `el`: { start, end } o null si no toca ese elemento */
  function selectionIn(el) {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!r.intersectsNode(el)) return null;
    const len = lengthOf(el);
    const start = el.contains(r.startContainer) ? pointOffset(el, r.startContainer, r.startOffset) : 0;
    const end = el.contains(r.endContainer) ? pointOffset(el, r.endContainer, r.endOffset) : len;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  /* Nodo de texto y posición dentro de él para la posición `off` del elemento */
  function place(el, off) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = off, n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue, len = noZW(v).length;
      if (left <= len) {
        let i = 0, seen = 0;
        while (i < v.length && seen < left) { if (v[i] !== ZW) seen++; i++; }
        return [n, i];
      }
      left -= len;
    }
    return [el, el.childNodes.length];
  }

  function select(startEl, start, endEl, end) {
    const r = document.createRange();
    const a = place(startEl, start), b = place(endEl, end);
    r.setStart(a[0], a[1]);
    r.setEnd(b[0], b[1]);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /* ----- campos de una línea ----- */
  const getLine = (el) => RT.fromDOM(el);
  function setLine(el, text, marks) { el.innerHTML = RT.toHTML(text, marks); }
  function clearLine(el) { el.innerHTML = ""; el.removeAttribute("data-align"); }
  const getAlign = (el) => RT.cleanAlign(el.dataset.align);

  function rerender(el, m, caret) {
    el.innerHTML = RT.toHTML(m.text, m.marks);
    if (caret !== undefined && document.activeElement === el) select(el, caret, el, caret);
  }

  /* Vuelve a dibujar un campo si el navegador metió etiquetas ajenas o se pasó del máximo */
  function normalizeLine(el) {
    const max = Number(el.dataset.max) || 0;
    let m = RT.fromDOM(el);
    const clean = RT.isClean(el) && (!max || m.text.length <= max);
    if (clean) return;
    const o = selectionIn(el);
    if (max && m.text.length > max) m = RT.slice(m, 0, max);
    const caret = o ? Math.min(o.end, m.text.length) : undefined;
    if (!m.text) { el.innerHTML = ""; return; }
    rerender(el, m, caret);
  }

  document.addEventListener("beforeinput", (e) => {
    const el = e.target.closest && e.target.closest(".rt-line");
    if (!el) return;
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      e.preventDefault();
      el.dispatchEvent(new CustomEvent("rt-enter", { bubbles: true }));
    }
  });

  document.addEventListener("input", (e) => {
    const el = e.target.closest && e.target.closest(".rt-line");
    if (!el || e.isComposing) return;
    normalizeLine(el);
  });
  document.addEventListener("compositionend", (e) => {
    const el = e.target.closest && e.target.closest(".rt-line");
    if (el) normalizeLine(el);
  });

  /* Pegar: siempre como texto plano y en una sola línea */
  document.addEventListener("paste", (e) => {
    const el = e.target.closest && e.target.closest(".rt-line");
    if (!el) return;
    e.preventDefault();
    const txt = ((e.clipboardData || window.clipboardData).getData("text/plain") || "").replace(/\s*\n\s*/g, " ").replace(/\r/g, "");
    if (!txt) return;
    const o = selectionIn(el) || { start: lengthOf(el), end: lengthOf(el) };
    let m = RT.replace(RT.fromDOM(el), o.start, o.end, txt);
    const max = Number(el.dataset.max) || 0;
    if (max && m.text.length > max) m = RT.slice(m, 0, max);
    rerender(el, m, Math.min(o.start + txt.length, m.text.length));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.addEventListener("drop", (e) => {
    if (e.target.closest && e.target.closest(".rt-line")) e.preventDefault();
  });

  /* Al salir de un campo se quitan las anclas invisibles que hayan quedado */
  document.addEventListener("focusout", (e) => {
    const host = e.target;
    if (!host || !host.classList) return;
    const els = host.classList.contains("rt-line") ? [host] : host.classList.contains("editor") ? [...host.children] : [];
    els.forEach((el) => {
      if (!el.textContent.includes(ZW)) return;
      const m = RT.fromDOM(el);
      el.innerHTML = RT.toHTML(m.text, m.marks);
    });
  });

  /* ----- dónde se aplica el formato ----- */
  function host() {
    const ae = document.activeElement;
    return ae && ae.classList && (ae.classList.contains("rt-line") || ae.classList.contains("editor")) ? ae : null;
  }

  /* Elementos de texto que toca la selección: el campo, o los párrafos del editor */
  function targets() {
    const h = host();
    if (!h) return [];
    if (h.classList.contains("rt-line")) return [h];
    const sel = getSelection();
    if (!sel.rangeCount) return [];
    const r = sel.getRangeAt(0);
    return [...h.children].filter((b) => b.classList.contains("blk") && r.intersectsNode(b));
  }

  /* Estilo con el que se escribiría ahora (cursor) o el del inicio de la selección */
  function currentStyle() {
    const sel = getSelection();
    const h = host();
    if (!h || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (r.collapsed) {
      const n = r.startContainer;
      const span = (n.nodeType === 1 ? n : n.parentElement)?.closest(".rt");
      if (!span || !h.contains(span)) return null;
      const d = span.dataset, own = {};
      if (d.b) own.b = 1;
      ["c", "h", "u", "z"].forEach((k) => { if (d[k] !== undefined) own[k] = d[k]; });
      return RT.cleanStyle(own);
    }
    const el = targets()[0];
    if (!el) return null;
    const o = selectionIn(el);
    return o ? RT.styleAt(RT.fromDOM(el), o.start) : null;
  }

  /* Sin selección: deja el cursor listo para escribir con `style` (o sin formato) justo donde está.
     Se parte el texto en el cursor y se pone un ancla invisible con ese estilo; el navegador escribe dentro de ella,
     así que no hace falta redibujar mientras se teclea (importante para los teclados de celular). */
  function setTypingStyle(el, pos, style) {
    const m = RT.fromDOM(el);
    const left = RT.slice(m, 0, pos), right = RT.slice(m, pos, m.text.length);
    el.innerHTML = RT.toHTML(left.text, left.marks) + RT.wrap(style, ZW) + RT.toHTML(right.text, right.marks);
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const i = n.nodeValue.indexOf(ZW);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i + 1);
      r.collapse(true);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
  }

  /* Da formato a la selección; sin selección, cambia el estilo de lo próximo que se escriba (como en Word).
     patch: ver RT.format; "bold" alterna la negrita. */
  function apply(patch) {
    const els = targets();
    if (!els.length) return false;
    const collapsed = getSelection().getRangeAt(0).collapsed;
    if (collapsed) {
      const el = els[0];
      const cur = currentStyle();
      if (patch === "bold") patch = { b: !(cur && cur.b) };
      const o = selectionIn(el) || { start: 0 };
      setTypingStyle(el, o.start, RT.patchStyle(cur, patch));
      updateBar();
      return true;
    }
    const items = els.map((el) => {
      const o = selectionIn(el) || { start: 0, end: 0 };
      return { el, m: RT.fromDOM(el), start: o.start, end: o.end };
    });
    const ranged = items.filter((it) => it.end > it.start);
    if (!ranged.length) return false;
    if (patch === "bold") patch = { b: !ranged.every((it) => RT.every(it.m, it.start, it.end, "b")) };
    ranged.forEach((it) => {
      const next = RT.format(it.m, it.start, it.end, patch);
      it.el.innerHTML = RT.toHTML(next.text, next.marks);
    });
    const first = items[0], last = items[items.length - 1];
    select(first.el, first.start, last.el, last.end);
    first.el.dispatchEvent(new Event("input", { bubbles: true }));
    updateBar();
    return true;
  }

  /* Alinea los párrafos (o el campo) donde está el cursor o la selección: "" (izquierda), "center" o "right" */
  function align(value) {
    const els = targets();
    if (!els.length) return false;
    value = RT.cleanAlign(value);
    els.forEach((el) => { if (value) el.dataset.align = value; else el.removeAttribute("data-align"); });
    els[0].dispatchEvent(new Event("input", { bubbles: true }));
    updateBar();
    return true;
  }

  /* ----- barra de formato ----- */
  const svg = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_HL = svg(`<path d="M9 11l-5 5v3h3l5-5"/><path d="M14 6l4 4-7 7-4-4z"/><path d="M3 21h18" stroke-width="3" class="fb-cur"/>`);
  const ICON_ALIGN = { "": svg(`<path d="M4 6h16M4 12h10M4 18h13"/>`), center: svg(`<path d="M4 6h16M7 12h10M5.5 18h13"/>`), right: svg(`<path d="M4 6h16M10 12h10M7 18h13"/>`) };
  const MAIN = [
    { act: "bold", label: "Negrita", html: "<b>N</b>" },
    { act: "size", label: "Tamaño de letra", html: `<span class="fb-size">A<small>A</small></span>` },
    { act: "color", label: "Color de letra", html: `<span class="fb-a">A</span>` },
    { act: "hl", label: "Resaltar con color", html: ICON_HL },
    { act: "ul", label: "Subrayar con color", html: `<span class="fb-u">S</span>` },
    { act: "align", label: "Alinear el texto", html: ICON_ALIGN[""] },
    { act: "clear", label: "Quitar el formato", html: "✕" },
  ];
  const NONE = { color: "Color normal", hl: "Sin resaltado", ul: "Sin subrayado" };
  const ALIGNS = [{ v: "", name: "Izquierda" }, { v: "center", name: "Centro" }, { v: "right", name: "Derecha" }];
  const KEY = { color: "c", hl: "h", ul: "u" };
  let menu = ""; // submenú abierto: size | color | hl | ul | align

  function buildBar() {
    const bar = $bar();
    if (!bar || bar.dataset.ready) return;
    bar.dataset.ready = "1";
    bar.innerHTML = `<div class="fb-sub hidden" role="group"></div>
      <div class="fb-row">${MAIN.map((b) => `<button type="button" data-act="${b.act}" aria-label="${b.label}" title="${b.label}">${b.html}</button>`).join("")}</div>`;
    // pointerdown + preventDefault: tocar la barra no le quita el foco ni la selección al texto
    bar.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const b = e.target.closest("button");
      if (b) onAction(b);
    });
    bar.addEventListener("mousedown", (e) => e.preventDefault());
  }

  function onAction(b) {
    if (b.dataset.act) {
      const act = b.dataset.act;
      if (act === "bold") { menu = ""; apply("bold"); }
      else if (act === "clear") { menu = ""; apply({ b: false, c: null, h: null, u: null, z: 0 }); }
      else menu = menu === act ? "" : act;
      renderSub();
      return;
    }
    // elementos del submenú
    const kind = b.dataset.kind, val = b.dataset.val;
    if (kind === "size") apply({ z: Number(val) });
    else if (kind === "align") align(val);
    else apply({ [KEY[kind]]: val || null });
    menu = "";
    renderSub();
  }

  function renderSub() {
    const bar = $bar(), sub = bar.querySelector(".fb-sub");
    bar.querySelectorAll(".fb-row button").forEach((x) => x.classList.toggle("open", x.dataset.act === menu));
    if (!menu) { sub.classList.add("hidden"); sub.innerHTML = ""; return; }
    if (menu === "size") {
      sub.innerHTML = RT.SIZE_STEPS.map((s) => `<button type="button" class="fb-opt" data-kind="size" data-val="${s.z}">${s.name}</button>`).join("");
    } else if (menu === "align") {
      sub.innerHTML = ALIGNS.map((a) => `<button type="button" class="fb-opt" data-kind="align" data-val="${a.v}" aria-label="${a.name}" title="${a.name}">${ICON_ALIGN[a.v]}</button>`).join("");
    } else { // primero el círculo vacío: quita ese color / deja de subrayar o resaltar
      sub.innerHTML = `<button type="button" class="fb-swatch fb-none" data-kind="${menu}" data-val="" aria-label="${NONE[menu]}" title="${NONE[menu]}"></button>`
        + RT.COLORS.map((c) => `<button type="button" class="fb-swatch" data-kind="${menu}" data-val="${c.hex}" style="--sw:${c.hex}" aria-label="${c.name}" title="${c.name}"></button>`).join("");
    }
    sub.classList.remove("hidden");
  }

  /* Los botones muestran el estilo con el que se está escribiendo (o el de la selección) */
  function reflect() {
    const bar = $bar();
    const st = currentStyle() || {};
    const btn = (act) => bar.querySelector(`.fb-row [data-act=${act}]`);
    btn("bold").classList.toggle("on", !!st.b);
    btn("size").classList.toggle("on", !!st.z);
    [["color", "c"], ["hl", "h"], ["ul", "u"]].forEach(([act, k]) => {
      btn(act).classList.toggle("on", !!st[k]);
      btn(act).style.setProperty("--cur", st[k] || "currentColor");
    });
    const el = targets()[0];
    const a = el ? RT.cleanAlign(el.dataset.align) : "";
    btn("align").innerHTML = ICON_ALIGN[a];
    btn("align").classList.toggle("on", !!a);
  }

  /* La barra se queda abajo: encima del teclado del celular o, sin teclado, encima de la barra de navegación */
  function placeBar() {
    const bar = $bar();
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    const nav = document.querySelector(".bottom-nav");
    const pageOpen = document.querySelector(".page:not(.hidden)");
    const base = !pageOpen && nav ? nav.offsetHeight : 0;
    bar.style.bottom = (kb > 40 ? kb : base) + "px";
  }

  function updateBar() {
    const bar = $bar();
    if (!bar) return;
    const on = !!host();
    if (on) buildBar();
    bar.classList.toggle("hidden", !on);
    if (!on) { menu = ""; if (bar.dataset.ready) renderSub(); return; }
    placeBar();
    reflect();
  }

  document.addEventListener("focusin", updateBar);
  document.addEventListener("focusout", () => setTimeout(updateBar, 80));
  document.addEventListener("selectionchange", updateBar);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", placeBar);
    window.visualViewport.addEventListener("scroll", placeBar);
  }
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b" && targets().length) {
      e.preventDefault();
      apply("bold");
    }
  });

  return { getLine, setLine, clearLine, getAlign, selectionIn, select, place, pointOffset, apply, align, updateBar, noZW };
})();
