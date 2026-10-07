/* Lógica pura de sincronización (sin DOM ni red), usada por la app y probada con Node.
   Cada tarea/resumen tiene `updatedAt`; gana el cambio más reciente por registro.
   Los borrados viajan como "tombstones" {id, col, updatedAt}. */
(function (root) {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: sin I, L, O, U
  const CODE_LEN = 20; // 20 × 5 bits = 100 bits

  function makeCode(bytes) { // bytes: Uint8Array aleatorio de 20
    let out = "";
    for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % 32];
    return out;
  }
  function normalizeCode(s) {
    return String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  }
  const isValidCode = (s) => s.length === CODE_LEN && [...s].every((c) => ALPHABET.includes(c));
  const formatCode = (s) => s.match(/.{1,4}/g).join("-");

  async function spaceId(code) {
    const data = new TextEncoder().encode("sync-v1:" + normalizeCode(code));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const sig = (rec) => { const { updatedAt, ...rest } = rec; return JSON.stringify(rest); };
  /* dirty: lo que cambió aquí y aún no se subió (clave "col:id" → updatedAt del cambio). No depende del reloj. */
  const newTracker = () => ({ sigs: {}, known: { tasks: {}, books: {}, routine: {} }, dirty: {} });

  /* Al iniciar: registra el estado actual como "ya conocido" (registros sin updatedAt reciben uno). */
  function prime(col, list, tracker, now) {
    tracker.known[col] = {};
    list.forEach((rec) => {
      if (rec.isNew) return;
      if (!rec.updatedAt) rec.updatedAt = now;
      tracker.sigs[col + ":" + rec.id] = sig(rec);
      tracker.known[col][rec.id] = true;
    });
  }

  /* Antes de guardar: estampa updatedAt en lo que cambió y crea tombstones de lo borrado. Devuelve true si algo cambió. */
  function stampChanges(col, list, tracker, tombs, now) {
    let changed = false;
    const present = {};
    list.forEach((rec) => {
      if (rec.isNew) return; // borradores no se sincronizan
      present[rec.id] = true;
      const key = col + ":" + rec.id, s = sig(rec);
      if (tracker.sigs[key] !== s) {
        rec.updatedAt = Math.max(now, (rec.updatedAt || 0) + 1); tracker.sigs[key] = s; changed = true;
        if (tracker.dirty) tracker.dirty[key] = rec.updatedAt;
      }
      const t = tombs.findIndex((x) => x.col === col && x.id === rec.id);
      if (t >= 0) tombs.splice(t, 1); // reapareció: ya no está borrado
      tracker.known[col][rec.id] = true;
    });
    Object.keys(tracker.known[col]).forEach((id) => {
      if (present[id]) return;
      delete tracker.known[col][id];
      delete tracker.sigs[col + ":" + id];
      const t = tombs.findIndex((x) => x.col === col && x.id === id);
      if (t >= 0) tombs[t].updatedAt = now; else tombs.push({ id, col, updatedAt: now });
      if (tracker.dirty) tracker.dirty[col + ":" + id] = now;
      changed = true;
    });
    return changed;
  }

  /* Registros a subir: lo marcado como pendiente (tracker.dirty) y, además, lo modificado o borrado después de la
     última subida (así se suben también los datos de versiones anteriores, que no llevaban la lista de pendientes). */
  function collectPush(tasks, books, tombs, lastPushAt, tracker, more) { // more: otras colecciones, p. ej. { routine: [...] }
    const dirty = (tracker && tracker.dirty) || {};
    const out = [];
    [["tasks", tasks], ["books", books], ...Object.entries(more || {})].forEach(([col, list]) => list.forEach((rec) => {
      if (rec.isNew) return;
      if (rec.updatedAt > lastPushAt || dirty[col + ":" + rec.id] !== undefined) out.push({ id: rec.id, col, updatedAt: rec.updatedAt, deleted: 0, data: JSON.stringify(rec) });
    }));
    tombs.forEach((t) => {
      if (t.updatedAt > lastPushAt || dirty[t.col + ":" + t.id] !== undefined) out.push({ id: t.id, col: t.col, updatedAt: t.updatedAt, deleted: 1, data: "" });
    });
    return out;
  }

  /* Tras una subida correcta: deja de estar pendiente lo que no volvió a cambiar mientras se subía. */
  function clearPushed(tracker, pushed) {
    if (!tracker || !tracker.dirty) return;
    pushed.forEach((r) => {
      const key = r.col + ":" + r.id;
      if (tracker.dirty[key] !== undefined && tracker.dirty[key] <= r.updatedAt) delete tracker.dirty[key];
    });
  }

  /* Aplica registros del servidor a una colección. busy = ids en edición (se difieren). */
  function mergeIncoming(col, list, incoming, tracker, tombs, busy) {
    const res = { list, changed: false, deferred: [] };
    incoming.filter((r) => r.col === col).forEach((rec) => {
      const i = list.findIndex((x) => x.id === rec.id);
      const local = i >= 0 ? list[i] : null;
      const tIdx = tombs.findIndex((x) => x.col === col && x.id === rec.id);
      const tomb = tIdx >= 0 ? tombs[tIdx] : null;
      if (rec.deleted) {
        if (local && local.updatedAt <= rec.updatedAt) {
          if (busy && busy.has(rec.id)) { res.deferred.push(rec); return; }
          list.splice(i, 1);
          delete tracker.known[col][rec.id]; delete tracker.sigs[col + ":" + rec.id];
          if (tracker.dirty) delete tracker.dirty[col + ":" + rec.id];
          res.changed = true;
        }
        if (!local || local.updatedAt <= rec.updatedAt) {
          if (tomb) tomb.updatedAt = Math.max(tomb.updatedAt, rec.updatedAt); else tombs.push({ id: rec.id, col, updatedAt: rec.updatedAt });
        }
        return;
      }
      if (tomb && tomb.updatedAt >= rec.updatedAt) return; // yo lo borré después
      if (local && local.updatedAt >= rec.updatedAt) return; // lo mío es igual o más nuevo
      if (busy && busy.has(rec.id)) { res.deferred.push(rec); return; }
      let data;
      try { data = JSON.parse(rec.data); } catch { return; }
      data.id = rec.id; data.updatedAt = rec.updatedAt;
      if (i >= 0) list[i] = data; else list.unshift(data);
      if (tIdx >= 0) tombs.splice(tIdx, 1);
      tracker.sigs[col + ":" + rec.id] = sig(data); tracker.known[col][rec.id] = true;
      if (tracker.dirty) delete tracker.dirty[col + ":" + rec.id]; // lo de aquí quedó reemplazado: ya no hay nada que subir
      res.changed = true;
    });
    return res;
  }

  const purgeTombs = (tombs, now, days) => tombs.filter((t) => now - t.updatedAt < (days || 60) * 86400000);

  /* ---------- Cifrado de extremo a extremo ----------
     Clave AES-256-GCM = HKDF-SHA256(código normalizado, sal "pendientes-sync-v2", info "enc-aes-256-gcm").
     El servidor solo ve el "espacio" (hash del código); no puede derivar la clave.
     Cada registro: "e1:" + base64url(iv[12] + cifrado), con id|col como datos autenticados. */
  const te = new TextEncoder(), td = new TextDecoder();
  const b64u = {
    enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0)),
  };

  async function deriveKey(code) {
    const ikm = await crypto.subtle.importKey("raw", te.encode(normalizeCode(code)), "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: te.encode("pendientes-sync-v2"), info: te.encode("enc-aes-256-gcm") },
      ikm, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  }
  const importRawKey = (raw) => crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);

  async function encryptText(key, text, aad) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, te.encode(text)));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return "e1:" + b64u.enc(out);
  }
  /* Devuelve el texto, o null si no se puede descifrar (clave distinta o dato alterado). Datos sin "e1:" se tratan como texto plano antiguo. */
  async function decryptText(key, data, aad) {
    if (typeof data !== "string" || !data.startsWith("e1:")) return data;
    try {
      const raw = b64u.dec(data.slice(3));
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: te.encode(aad) }, key, raw.slice(12));
      return td.decode(pt);
    } catch { return null; }
  }

  const api = { deriveKey, importRawKey, encryptText, decryptText, b64u, makeCode, normalizeCode, isValidCode, formatCode, spaceId, newTracker, prime, stampChanges, collectPush, clearPushed, mergeIncoming, purgeTombs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Sync = api;
})(typeof self !== "undefined" ? self : this);
