"use strict";
/* Edición con formato en la página: campos de una línea (.rt-line) y la barra de formato
   (negrita, tamaño, color de letra, resaltado, subrayado de color) que sale al escribir en
   cualquier campo de texto o editor (.editor). La lógica de los tramos está en richtext.js (RT). */
const RE = (() => {
  const $bar = () => document.getElementById("format-bar");

  /* ----- posiciones dentro de un elemento (en caracteres de texto, igual que RT.fromDOM) ----- */
  function pointOffset(el, node, off) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(node, off);
    return r.toString().length;
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

  function place(el, off) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = off, n;
    while ((n = w.nextNode())) {
      if (left <= n.nodeValue.length) return [n, left];
      left -= n.nodeValue.length;
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
  function clearLine(el) { el.innerHTML = ""; }

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

  /* ----- aplicar formato ----- */
  function targets() {
    const ae = document.activeElement;
    if (!ae) return [];
    if (ae.classList.contains("rt-line")) return [ae];
    if (ae.classList.contains("editor")) {
      const sel = getSelection();
      if (!sel.rangeCount) return [];
      const r = sel.getRangeAt(0);
      return [...ae.children].filter((b) => b.classList.contains("blk") && r.intersectsNode(b));
    }
    return [];
  }

  /* Da formato a la selección (o a la palabra donde está el cursor). patch: ver RT.format; "bold" alterna la negrita. */
  function apply(patch) {
    const els = targets();
    if (!els.length) return false;
    const collapsed = getSelection().getRangeAt(0).collapsed;
    const items = els.map((el) => {
      const o = selectionIn(el) || { start: 0, end: 0 };
      return { el, m: RT.fromDOM(el), start: o.start, end: o.end };
    });
    let caret = null;
    if (collapsed) { // sin selección: se usa la palabra bajo el cursor
      const it = items[0];
      caret = it.start;
      const w = RT.wordAt(it.m.text, it.start);
      if (!w) return false;
      it.start = w[0]; it.end = w[1];
    }
    const ranged = items.filter((it) => it.end > it.start);
    if (!ranged.length) return false;
    if (patch === "bold") {
      patch = { b: !ranged.every((it) => RT.every(it.m, it.start, it.end, "b")) };
    }
    ranged.forEach((it) => {
      const next = RT.format(it.m, it.start, it.end, patch);
      it.el.innerHTML = RT.toHTML(next.text, next.marks);
    });
    const first = items[0], last = items[items.length - 1];
    if (collapsed) select(first.el, caret, first.el, caret);
    else select(first.el, first.start, last.el, last.end);
    first.el.dispatchEvent(new Event("input", { bubbles: true }));
    updateBar();
    return true;
  }

  /* ----- barra de formato ----- */
  const ICON_HL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l-5 5v3h3l5-5"/><path d="M14 6l4 4-7 7-4-4z"/><path d="M3 21h18" stroke-width="3"/></svg>`;
  const MAIN = [
    { act: "bold", label: "Negrita", html: "<b>N</b>" },
    { act: "size", label: "Tamaño de letra", html: `<span class="fb-size">A<small>A</small></span>` },
    { act: "color", label: "Color de letra", html: `<span class="fb-a">A</span>` },
    { act: "hl", label: "Resaltar con color", html: ICON_HL },
    { act: "ul", label: "Subrayar con color", html: "<u>S</u>" },
    { act: "clear", label: "Quitar el formato", html: "✕" },
  ];
  let menu = ""; // submenú abierto: size | color | hl | ul

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
    else apply({ [{ color: "c", hl: "h", ul: "u" }[kind]]: val || null });
    menu = "";
    renderSub();
  }

  function renderSub() {
    const sub = $bar().querySelector(".fb-sub");
    $bar().querySelectorAll(".fb-row button").forEach((x) => x.classList.toggle("on", x.dataset.act === menu));
    if (!menu) { sub.classList.add("hidden"); sub.innerHTML = ""; return; }
    if (menu === "size") {
      sub.innerHTML = RT.SIZE_STEPS.map((s) => `<button type="button" class="fb-opt" data-kind="size" data-val="${s.z}">${s.name}</button>`).join("");
    } else {
      sub.innerHTML = RT.COLORS.map((c) => `<button type="button" class="fb-swatch" data-kind="${menu}" data-val="${c.hex}" style="--sw:${c.hex}" aria-label="${c.name}" title="${c.name}"></button>`).join("")
        + `<button type="button" class="fb-opt" data-kind="${menu}" data-val="" aria-label="Sin color" title="Sin color">✕</button>`;
    }
    sub.classList.remove("hidden");
  }

  /* La barra se queda pegada abajo, encima del teclado del celular */
  function placeBar() {
    const bar = $bar();
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    bar.style.bottom = kb + "px";
  }

  function updateBar() {
    const bar = $bar();
    if (!bar) return;
    const ae = document.activeElement;
    // La barra sale cuando hay texto seleccionado dentro de un campo con formato (así no tapa los botones de guardar)
    const sel = getSelection();
    const on = !!ae && (ae.classList.contains("rt-line") || ae.classList.contains("editor"))
      && sel.rangeCount > 0 && !sel.isCollapsed && ae.contains(sel.anchorNode);
    if (on) buildBar();
    bar.classList.toggle("hidden", !on);
    document.documentElement.classList.toggle("fbar-on", on);
    if (!on) { menu = ""; if (bar.dataset.ready) renderSub(); }
    else placeBar();
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

  return { getLine, setLine, clearLine, selectionIn, select, apply, updateBar };
})();
