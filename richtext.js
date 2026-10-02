"use strict";
/* Texto con formato (negrita, color de letra, resaltado, subrayado de color y tamaño).
   Un texto con formato es { text, marks }: `text` es texto plano y `marks` una lista de tramos
   { s, e, b?, c?, h?, u?, z? } (inicio y fin en caracteres) que dicen cómo se ve cada tramo:
     b = negrita (1), c = color de letra, h = color de resaltado, u = color de subrayado (#rrggbb),
     z = tamaño (-1 pequeño, 1 grande, 2 enorme; sin z es normal).
   Todo lo que llega de fuera (otro dispositivo, datos viejos) se limpia: solo se aceptan colores #rrggbb y tamaños conocidos,
   así que nunca entra HTML ni estilos arbitrarios. Lógica pura: se puede probar con Node. */
(function (root) {
  const HEX = /^#[0-9a-f]{6}$/i;
  const SIZES = { "-1": 0.85, "1": 1.25, "2": 1.6 };
  const COLOR_KEYS = ["c", "h", "u"];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Estilo válido o null. Las claves se crean siempre en el mismo orden para poder compararlos como texto. */
  function cleanStyle(st) {
    if (!st || typeof st !== "object") return null;
    const out = {};
    if (st.b) out.b = 1;
    COLOR_KEYS.forEach((k) => { if (typeof st[k] === "string" && HEX.test(st[k])) out[k] = st[k].toLowerCase(); });
    const z = Number(st.z);
    if (SIZES[z] !== undefined) out.z = z;
    return Object.keys(out).length ? out : null;
  }
  const key = (st) => (st ? JSON.stringify(st) : "");
  const merge = (a, b) => cleanStyle({ ...(a || {}), ...(b || {}) });

  /* Un estilo por carácter (más fácil de editar que tramos) */
  function expand(len, marks) {
    const arr = new Array(len).fill(null);
    (Array.isArray(marks) ? marks : []).forEach((m) => {
      if (!m || typeof m !== "object") return;
      const st = cleanStyle(m);
      const s = Math.max(0, Math.floor(Number(m.s)) || 0), e = Math.min(len, Math.floor(Number(m.e)) || 0);
      if (!st) return;
      for (let i = s; i < e; i++) arr[i] = merge(arr[i], st);
    });
    return arr;
  }

  /* Vuelve a tramos, juntando los vecinos iguales */
  function compress(styles) {
    const out = [];
    let i = 0;
    while (i < styles.length) {
      const k = key(styles[i]);
      let j = i + 1;
      while (j < styles.length && key(styles[j]) === k) j++;
      if (styles[i]) out.push({ s: i, e: j, ...styles[i] });
      i = j;
    }
    return out;
  }

  const model = (text, styles) => ({ text, marks: compress(styles) });
  const norm = (m) => {
    const text = String((m && m.text) ?? "");
    return { text, styles: expand(text.length, m && m.marks) };
  };

  /* Deja los tramos válidos y ordenados (para datos que vienen de fuera) */
  function clean(text, marks) {
    text = String(text ?? "");
    return compress(expand(text.length, marks));
  }

  function slice(m, from, to) {
    const { text, styles } = norm(m);
    return model(text.slice(from, to), styles.slice(from, to));
  }

  function concat(a, b) {
    const x = norm(a), y = norm(b);
    return model(x.text + y.text, x.styles.concat(y.styles));
  }

  /* Cambia [from, to) por `str`. Si se escribe dentro de un tramo con formato, el texto nuevo lo hereda. */
  function replace(m, from, to, str) {
    const { text, styles } = norm(m);
    from = Math.max(0, Math.min(from, text.length));
    to = Math.max(from, Math.min(to, text.length));
    str = String(str ?? "");
    const before = styles[from - 1] || null, after = styles[to] || null;
    const inherit = before && after && key(before) === key(after) ? before : null;
    return model(
      text.slice(0, from) + str + text.slice(to),
      styles.slice(0, from).concat(new Array(str.length).fill(inherit), styles.slice(to)),
    );
  }

  /* patch: { b: true|false, c|h|u: "#rrggbb"|null, z: -1|1|2|0|null } */
  function format(m, from, to, patch) {
    const { text, styles } = norm(m);
    from = Math.max(0, from); to = Math.min(text.length, to);
    for (let i = from; i < to; i++) {
      const st = { ...(styles[i] || {}) };
      if ("b" in patch) { if (patch.b) st.b = 1; else delete st.b; }
      COLOR_KEYS.forEach((k) => { if (k in patch) { if (patch[k]) st[k] = patch[k]; else delete st[k]; } });
      if ("z" in patch) { if (patch.z) st.z = patch.z; else delete st.z; }
      styles[i] = cleanStyle(st);
    }
    return model(text, styles);
  }

  /* ¿Todos los caracteres de [from, to) cumplen la condición? (para alternar negrita, etc.) */
  function every(m, from, to, prop, value) {
    const { styles } = norm(m);
    if (to <= from) return false;
    for (let i = from; i < to; i++) {
      const st = styles[i];
      if (!st || (value === undefined ? !st[prop] : st[prop] !== value)) return false;
    }
    return true;
  }

  /* Quita los espacios de los extremos, ajustando los tramos */
  function trim(m) {
    const { text, styles } = norm(m);
    const a = text.length - text.trimStart().length;
    const b = text.trimEnd().length;
    return b <= a ? { text: "", marks: [] } : model(text.slice(a, b), styles.slice(a, b));
  }

  /* Palabra alrededor de la posición (para dar formato sin seleccionar). Devuelve [from, to] o null. */
  function wordAt(text, pos) {
    const isWord = (ch) => /[\p{L}\p{N}_]/u.test(ch);
    let a = pos, b = pos;
    while (a > 0 && isWord(text[a - 1])) a--;
    while (b < text.length && isWord(text[b])) b++;
    return b > a ? [a, b] : null;
  }

  function css(st) {
    const p = [];
    if (st.b) p.push("font-weight:700");
    if (st.c) p.push(`color:${st.c}`);
    if (st.h) {
      const n = parseInt(st.h.slice(1), 16);
      p.push(`background-color:rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.32)`, "border-radius:.2em", "padding:0 .08em");
    }
    if (st.u) p.push("text-decoration:underline", `text-decoration-color:${st.u}`, "text-decoration-thickness:.13em", "text-underline-offset:.16em");
    if (st.z) p.push(`font-size:${SIZES[st.z]}em`);
    return p.join(";");
  }
  const attrs = (st) => ["b", "c", "h", "u", "z"].filter((k) => st[k] !== undefined).map((k) => ` data-${k}="${st[k]}"`).join("");

  /* HTML seguro de un texto con formato. Con { nl: true } los saltos de línea se muestran como <br>. */
  function toHTML(text, marks, opts) {
    text = String(text ?? "");
    const styles = expand(text.length, marks);
    let out = "", i = 0;
    while (i < text.length) {
      const k = key(styles[i]);
      let j = i + 1;
      while (j < text.length && key(styles[j]) === k) j++;
      const seg = esc(text.slice(i, j));
      out += styles[i] ? `<span class="rt"${attrs(styles[i])} style="${css(styles[i])}">${seg}</span>` : seg;
      i = j;
    }
    return opts && opts.nl ? out.replace(/\n/g, "<br>") : out;
  }

  /* Lee un elemento editable: texto y tramos. Las etiquetas que no son nuestras (las que pueda meter el navegador) cuentan solo como texto. */
  function fromDOM(el) {
    let text = "";
    const styles = [];
    (function walk(node, st) {
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) {
          const v = c.nodeValue.replace(/​/g, "");
          for (let i = 0; i < v.length; i++) styles.push(st);
          text += v;
        } else if (c.nodeType === 1 && c.nodeName !== "BR") {
          let next = st;
          if (c.classList && c.classList.contains("rt")) {
            const d = c.dataset, own = {};
            if (d.b) own.b = 1;
            ["c", "h", "u", "z"].forEach((k) => { if (d[k] !== undefined) own[k] = d[k]; });
            next = merge(st, own);
          }
          walk(c, next);
        }
      });
    })(el, null);
    return model(text, styles);
  }

  /* ¿Solo tiene texto y nuestros tramos (sin <br>, <div>, <b>…)? Si no, conviene volver a dibujarlo. */
  function isClean(el) {
    return [...el.childNodes].every((c) => c.nodeType === 3
      || (c.nodeType === 1 && c.nodeName === "SPAN" && c.classList.contains("rt") && [...c.childNodes].every((x) => x.nodeType === 3)));
  }

  /* Paleta (la misma para letra, resaltado y subrayado: colores medios que se leen en claro y oscuro) */
  const COLORS = [
    { hex: "#dc2626", name: "Rojo" }, { hex: "#ea580c", name: "Naranja" }, { hex: "#ca8a04", name: "Amarillo" },
    { hex: "#16a34a", name: "Verde" }, { hex: "#0891b2", name: "Turquesa" }, { hex: "#2563eb", name: "Azul" },
    { hex: "#9333ea", name: "Morado" }, { hex: "#db2777", name: "Rosa" },
  ];
  const SIZE_STEPS = [
    { z: -1, name: "Pequeño" }, { z: 0, name: "Normal" }, { z: 1, name: "Grande" }, { z: 2, name: "Enorme" },
  ];

  const RT = { clean, slice, concat, replace, format, every, trim, wordAt, toHTML, fromDOM, isClean, COLORS, SIZE_STEPS, cleanStyle };
  if (typeof module !== "undefined" && module.exports) module.exports = RT;
  else root.RT = RT;
})(typeof window !== "undefined" ? window : globalThis);
