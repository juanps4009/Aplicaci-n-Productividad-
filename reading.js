"use strict";
/* Lectura: el libro que el dueño está leyendo y en qué capítulo va, conectado con su resumen.
   Lógica pura (sin DOM ni red), probada con Node.

   Campos opcionales de un resumen (viajan con el libro; versiones anteriores los conservan sin tocarlos):
     reading: "" (sin empezar) · "reading" (leyendo) · "done" (terminado)
     chapter: capítulo en el que va (1..999)   chapters: total de capítulos (0 = no lo sabe)   doneAt: "AAAA-MM" */
(function (root) {
  const STATUSES = ["", "reading", "done"];
  const STATUS_LABEL = { "": "Sin empezar", reading: "Leyendo", done: "Terminado" };
  const MAX = 999, MAX_NOTE = 600;
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const int = (v, min, max, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const pad = (n) => String(n).padStart(2, "0");
  const month = (now) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

  /* Datos de lectura saneados de un libro (nunca falla con datos viejos o dañados) */
  function info(b) {
    const status = STATUSES.includes(b && b.reading) ? b.reading : "";
    const chapters = int(b && b.chapters, 0, MAX, 0);
    const chapter = int(b && b.chapter, 1, chapters || MAX, 1);
    const doneAt = typeof (b && b.doneAt) === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(b.doneAt) ? b.doneAt : "";
    // capítulos ya leídos: los anteriores al actual (o todos si terminó)
    const pct = chapters ? Math.round(((status === "done" ? chapters : chapter - 1) / chapters) * 100) : null;
    return { status, chapter, chapters, doneAt, pct };
  }
  const monthText = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
  function progressText(b) {
    const r = info(b);
    if (r.status === "done") return r.doneAt ? `Terminado · ${monthText(r.doneAt)}` : "Terminado";
    if (r.status === "reading") return r.chapters ? `Capítulo ${r.chapter} de ${r.chapters}` : `Capítulo ${r.chapter}`;
    return "";
  }

  /* Cada cambio devuelve los campos a aplicar al libro (no lo modifica) */
  function setStatus(b, status, now) {
    if (!STATUSES.includes(status)) return null;
    const r = info(b);
    if (status === "done") return { reading: "done", doneAt: r.doneAt || month(now) };
    return { reading: status, doneAt: "" };
  }
  function step(b, delta) {
    const r = info(b);
    const chapter = Math.min(r.chapters || MAX, Math.max(1, r.chapter + int(delta, -MAX, MAX, 0)));
    return { chapter, reading: r.status === "done" ? "done" : "reading" };
  }
  function setTotal(b, total) {
    const chapters = int(total, 0, MAX, 0);
    const r = info(b);
    return { chapters, chapter: chapters ? Math.min(r.chapter, chapters) : r.chapter };
  }

  /* Guarda lo que dejó el capítulo actual dentro del resumen y pasa al siguiente.
     «Por bloques»: una línea nueva en el cuadro «Notas / Resumen por capítulos». «Libre»: un párrafo al final. */
  function addChapterNote(b, text, now, uid) {
    const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
    const r = info(b);
    const out = {};
    if (t) {
      const line = `Capítulo ${r.chapter}: ${t}`;
      if (b.template === "free") out.doc = [...(Array.isArray(b.doc) ? b.doc : []), { id: uid, type: "p", text: line }];
      else out.notes = b.notes ? `${String(b.notes).replace(/\n+$/, "")}\n${line}` : line;
    }
    if (r.chapters && r.chapter >= r.chapters) Object.assign(out, { reading: "done", doneAt: r.doneAt || month(now) });
    else Object.assign(out, { chapter: r.chapter + 1, reading: "reading" });
    return out;
  }

  const reading = (books) => books.filter((b) => info(b).status === "reading");
  const counts = (books) => ({ reading: reading(books).length, done: books.filter((b) => info(b).status === "done").length });
  /* Filtro de la lista: "all" · "reading" · "done" */
  const filter = (books, f) => (f === "reading" || f === "done" ? books.filter((b) => info(b).status === f) : books);

  const api = { STATUSES, STATUS_LABEL, MAX, info, progressText, monthText, setStatus, step, setTotal, addChapterNote, reading, counts, filter };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Reading = api;
})(typeof self !== "undefined" ? self : this);
