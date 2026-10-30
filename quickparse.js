"use strict";
/* Captura rápida: entiende frases en español como «mañana 9am llamar a Ana !» y decide a dónde van.
   Lógica pura (sin DOM): la usa capture.js y se prueba con Node (tests/quickparse-test.js).

   parse(texto, ahora) → {
     kind:     "task" | "routine" | "opp" | "income" | "read"
     title:    el texto sin las partes que se entendieron, con mayúscula inicial
     due:      "AAAA-MM-DD" | ""        (fecha de la tarea o del ingreso)
     time:     "HH:MM" | ""             (en la app se vuelve un recordatorio de una vez)
     priority: "high" | "medium" | "low" | ""
     remind:   true si pidió aviso («recuérdame», «avísame»)
     rec:      { freq: "daily"|"weekly"|"monthly", days: [1..7] } | null   (1 = lunes … 7 = domingo)
     amount:   número entero en pesos | null
     itype:    "claude" | "presencial" | ""
     url:      enlace http(s) | ""
     closes:   "AAAA-MM-DD" | ""        (cierre de una oferta: «cierra el viernes»)
     chapter:  número de capítulo | null
     spans:    [{ s, e, type }] posiciones de lo entendido, para resaltarlo en el campo
   } */
(function (root) {
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DAY_WORDS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const NUM_WORDS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
  const B = "(?<![\\p{L}\\d])", E = "(?![\\p{L}\\d])";
  const DAYS_RX = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?";
  const MONTHS_RX = MONTHS.join("|") + "|" + MONTHS.map((m) => m.slice(0, 3)).join("|");
  const plain = (w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dayIndex = (w) => DAY_WORDS[plain(w).replace(/s$/, "").replace(/^(lune|marte|miercole|jueve|vierne)$/, "$1s")];
  const isoDay = (jsDay) => (jsDay === 0 ? 7 : jsDay);
  const num = (w) => NUM_WORDS[w] || Number(w);

  function parse(text, now) {
    text = String(text || "");
    now = now instanceof Date ? now : new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextDay = (jsDay, allowToday) => { const n = (jsDay - today.getDay() + 7) % 7; return addDays(today, n === 0 && !allowToday ? 7 : n); };
    const lower = text.toLowerCase();
    const spans = [];
    const out = { kind: "", title: "", due: "", time: "", priority: "", remind: false, rec: null, amount: null, itype: "", url: "", closes: "", chapter: null, spans };
    let closeWord = -1;

    /* Busca un patrón; cada coincidencia que no se cruce con una anterior se marca. fn puede devolver false para ignorarla. */
    const take = (rx, type, fn) => {
      const r = new RegExp(rx, "giu");
      let m;
      while ((m = r.exec(lower))) {
        if (!m[0].length) { r.lastIndex++; continue; }
        const s = m.index, e = s + m[0].length;
        if (spans.some((p) => s < p.e && e > p.s)) continue;
        if (fn && fn(m) === false) continue;
        spans.push({ s, e, type });
      }
    };
    const setDate = (d, m) => {
      const near = closeWord >= 0 && m.index - closeWord <= 12 && m.index > closeWord;
      if (near) out.closes = dateKey(d); else out.due = dateKey(d);
    };
    const setTime = (h, mi, ap, extra, loose) => {
      h = Number(h); mi = Number(mi || 0);
      if (h > 23 || mi > 59) return false;
      if (ap && /p/.test(ap) && h < 12) h += 12;
      if (ap && /a/.test(ap) && h === 12) h = 0;
      if (!ap && loose && h >= 1 && h <= 6) h += 12; // «a las 4» casi siempre es en la tarde
      if (extra) mi = /media/.test(extra) ? 30 : 15;
      out.time = `${pad(h)}:${pad(mi)}`;
    };

    take(`https?://[^\\s<>"']+`, "url", (m) => { out.url = text.substr(m.index, m[0].length); });

    // Rutina: lo que se repite
    take(`${B}(todos los d[ií]as|cada d[ií]a|a diario|diariamente|diario)${E}`, "rut", () => { out.rec = { freq: "daily", days: [] }; });
    take(`${B}(de lunes a viernes|lunes a viernes|entre semana)${E}`, "rut", () => { out.rec = { freq: "daily", days: [1, 2, 3, 4, 5] }; });
    take(`${B}((los |cada )?fines de semana|cada fin de semana)${E}`, "rut", () => { out.rec = { freq: "daily", days: [6, 7] }; });
    take(`${B}(cada|todos los) (${DAYS_RX})${E}`, "rut", (m) => {
      const d = isoDay(dayIndex(m[2]));
      out.rec = out.rec && out.rec.freq === "daily" && out.rec.days.length ? { freq: "daily", days: [...out.rec.days, d].sort() } : { freq: "daily", days: [d] };
    });
    take(`${B}(cada semana|semanal(mente)?|una vez (por|a la) semana)${E}`, "rut", () => { out.rec = { freq: "weekly", days: [] }; });
    take(`${B}(cada mes|mensual(mente)?|una vez al mes)${E}`, "rut", () => { out.rec = { freq: "monthly", days: [] }; });

    // Ingresos: dinero y palabras de cobro
    take(`\\$\\s?\\d[\\d.,]*(\\s?(k|mil))?${E}|${B}\\d[\\d.,]*\\s?(k|mil|pesos)${E}`, "money", (m) => {
      let n = Number(m[0].replace(/[^\d]/g, ""));
      if (/k|mil/.test(m[0])) n *= 1000;
      if (!n) return false;
      out.amount = n;
    });
    take(`${B}(cobr[eé]|me pagaron|me pag[oó]|ingreso de|ingreso|pago de)${E}`, "kind", () => { out.kind = out.kind || "income"; });
    take(`${B}(con claude|presencial)${E}`, "money", (m) => {
      if (out.amount == null && out.kind !== "income") return false;
      out.itype = m[0].includes("claude") ? "claude" : "presencial";
    });

    // Ofertas y lectura
    take(`^\\s*(oferta|oportunidad|vacante)( de)?${E}`, "kind", () => { out.kind = out.kind || "opp"; });
    take(`${B}(cierra|cierre|vence|cerrar[aá])${E}`, "opp", (m) => { closeWord = m.index + m[0].length; });
    take(`^\\s*(leyendo|voy en|termin[eé])${E}`, "kind", () => { out.kind = out.kind || "read"; });
    take(`${B}(cap[ií]tulo|cap\\.?)\\s?(\\d{1,3})${E}`, "read", (m) => { out.chapter = Number(m[2]); });

    // Prioridad y aviso
    take(`${B}(urgente|importante|prioridad alta)${E}|(?<=^|\\s)(!!!|!alta|!)(?=\\s|$)`, "prio", () => { out.priority = "high"; });
    take(`(?<=^|\\s)(!!|!media)(?=\\s|$)|${B}prioridad media${E}`, "prio", () => { out.priority = "medium"; });
    take(`(?<=^|\\s)!baja(?=\\s|$)|${B}prioridad baja${E}`, "prio", () => { out.priority = "low"; });
    take(`${B}(recu[eé]rdame|recordarme|av[ií]same|con aviso)${E}`, "rem", () => { out.remind = true; });

    // Hora
    take(`${B}(por|en|de) la (mañana|tarde|noche)${E}|${B}(al )?mediod[ií]a${E}`, "time", (m) => {
      out.time = /mañana/.test(m[0]) ? "09:00" : /tarde/.test(m[0]) ? "15:00" : /noche/.test(m[0]) ? "20:00" : "12:00";
    });
    take(`${B}en (\\d+|un|una|media) (horas?|minutos?|min)${E}`, "time", (m) => {
      const n = m[1] === "media" ? 30 : num(m[1]);
      const at = new Date(now.getTime() + (/h/.test(m[2]) ? n * 60 : n) * 60000);
      out.time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
      if (!out.due) out.due = dateKey(at);
    });
    take(`${B}(a las|a la)\\s(\\d{1,2})(?:[:.](\\d{2}))?\\s?(am|pm|a\\.\\s?m\\.|p\\.\\s?m\\.)?( y media| y cuarto)?(?![\\p{L}\\d])`, "time", (m) => setTime(m[2], m[3], m[4], m[5], true));
    take(`${B}(\\d{1,2})(?:[:.](\\d{2}))?\\s?(am|pm|a\\.\\s?m\\.|p\\.\\s?m\\.)(?![\\p{L}])`, "time", (m) => setTime(m[1], m[2], m[3]));
    take(`${B}(\\d{1,2}):(\\d{2})${E}|${B}(\\d{1,2})\\s?h${E}`, "time", (m) => setTime(m[1] || m[3], m[2]));

    // Fecha
    take(`${B}pasado mañana${E}`, "date", (m) => setDate(addDays(today, 2), m));
    take(`${B}esta noche${E}`, "date", (m) => { setDate(today, m); if (!out.time) out.time = "20:00"; });
    take(`${B}hoy${E}`, "date", (m) => setDate(today, m));
    take(`${B}mañana${E}`, "date", (m) => setDate(addDays(today, 1), m));
    take(`${B}((el|este|pr[oó]ximo|el pr[oó]ximo) )?(${DAYS_RX})${E}`, "date", (m) => setDate(nextDay(dayIndex(m[3]), m[2] === "este"), m));
    take(`${B}(la pr[oó]xima semana|la semana que viene)${E}`, "date", (m) => setDate(nextDay(1), m));
    take(`${B}(este )?fin de semana${E}`, "date", (m) => setDate(nextDay(6, true), m));
    take(`${B}(en|dentro de) (\\d+|un|una|dos|tres|cuatro|cinco) (d[ií]as?|semanas?)${E}`, "date", (m) => setDate(addDays(today, (/sem/.test(m[3]) ? 7 : 1) * num(m[2])), m));
    take(`${B}(el )?(\\d{1,2})( de)? (${MONTHS_RX})${E}`, "date", (m) => {
      const mo = MONTHS.findIndex((x) => x.startsWith(m[4].slice(0, 3)));
      const d = new Date(today.getFullYear(), mo, Number(m[2]));
      if (d.getMonth() !== mo) return false;
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      setDate(d, m);
    });
    take(`${B}(\\d{1,2})/(\\d{1,2})${E}`, "date", (m) => {
      const mo = Number(m[2]) - 1, d = new Date(today.getFullYear(), mo, Number(m[1]));
      if (mo > 11 || d.getMonth() !== mo) return false;
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      setDate(d, m);
    });

    if (!out.kind) {
      out.kind = out.amount != null && /\$|cobr|pag/.test(lower) ? "income"
        : out.url || out.closes ? "opp"
        : out.chapter != null ? "read"
        : out.rec ? "routine" : "task";
    }
    if (out.kind === "income" && out.amount == null) out.kind = "task";
    if (out.kind === "opp" && !out.closes && out.due && closeWord < 0) { out.closes = out.due; out.due = ""; }

    spans.sort((a, b) => a.s - b.s);
    let title = "", last = 0;
    spans.forEach((p) => { title += text.slice(last, p.s) + " "; last = p.e; });
    title += text.slice(last);
    title = title.replace(/\s+/g, " ").replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, "")
      .replace(/^(a|de|el|la|para|por|que|y)\s+/i, "").replace(/\s+(a|de|el|la|para|por|y|en)$/i, "").trim();
    out.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : "";
    return out;
  }

  const api = { parse, dateKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuickParse = api;
})(typeof self !== "undefined" ? self : this);
