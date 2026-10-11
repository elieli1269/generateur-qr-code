/* QR Folio v1.2 */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const STORAGE_DRAFT = "gqr-draft-v1";
  const STORAGE_LIB = "gqr-library-v1";

  const PRESETS = [
    { id: "classic", label: "Classic", fg: "#12151c", bg: "#ffffff", eye: "#12151c" },
    { id: "ink", label: "Ink", fg: "#12151c", bg: "#ffffff", eye: "#1b4f8a" },
    { id: "night", label: "Night", fg: "#e8ecf2", bg: "#12151c", eye: "#7eb6ff" },
    { id: "ocean", label: "Ocean", fg: "#0c4a6e", bg: "#f0f9ff", eye: "#0369a1" },
    { id: "forest", label: "Forest", fg: "#14532d", bg: "#f0fdf4", eye: "#15803d" },
    { id: "rose", label: "Rose", fg: "#9f1239", bg: "#fff1f2", eye: "#be123c" },
  ];

  const defaultState = () => ({
    kind: "url",
    name: "Menu card",
    url: "https://exemple.fr/menu",
    text: "",
    keywords: ["menu", "terrasse"],
    labels: [],
    frameNote: "",
    wifi: { ssid: "", password: "", security: "WPA", hidden: false },
    email: { to: "", subject: "", body: "" },
    phone: "",
    sms: { to: "", body: "" },
    whatsapp: { phone: "", message: "" },
    geo: { place: "" },
    event: { title: "", location: "", start: "", end: "", notes: "" },
    vcard: { first: "", last: "", org: "", phone: "", email: "", url: "" },
    style: {
      fg: "#12151c",
      bg: "#ffffff",
      eye: "#12151c",
      dot: "square",
      corner: "square",
      cornerDot: "square",
      margin: 16,
      logo: null,
      logoSize: 0.28,
      ecl: "M",
    },
    frame: "nu",
    exportSize: 1024,
  });

  let state = defaultState();
  let library = [];
  let qr = null;
  let statusTimer = null;
  let updateToken = 0;
  let debounceTimer = null;

  function setStatus(msg, ok) {
    const el = $("#status");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("ok", !!ok);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (el.textContent === msg) {
        el.textContent = "";
        el.classList.remove("ok");
      }
    }, 4200);
  }

  function slug(name) {
    return (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "qr-folio";
  }

  function normalizeUrl(raw) {
    const t = (raw || "").trim();
    if (!t) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
    return "https://" + t;
  }

  function wifiEscape(s) {
    return String(s).replace(/([\\;,:\"])/g, "\\$1");
  }

  function payload() {
    switch (state.kind) {
      case "url":
        return normalizeUrl(state.url);
      case "text":
        return (state.text || "").trim();
      case "keywords":
        return state.keywords.filter(Boolean).join("\n");
      case "wifi": {
        if (!state.wifi.ssid.trim()) return "";
        const sec = state.wifi.security;
        const pass = sec === "nopass" ? "" : wifiEscape(state.wifi.password);
        return `WIFI:T:${sec};S:${wifiEscape(state.wifi.ssid)};P:${pass};H:${state.wifi.hidden ? "true" : "false"};;`;
      }
      case "email": {
        if (!state.email.to.trim()) return "";
        const q = new URLSearchParams();
        if (state.email.subject.trim()) q.set("subject", state.email.subject.trim());
        if (state.email.body.trim()) q.set("body", state.email.body.trim());
        const qs = q.toString();
        return `mailto:${state.email.to.trim()}${qs ? "?" + qs : ""}`;
      }
      case "phone": {
        const n = state.phone.trim();
        return n ? `tel:${n.replace(/\s+/g, "")}` : "";
      }
      case "sms": {
        if (!state.sms.to.trim()) return "";
        const body = state.sms.body.trim();
        return `sms:${state.sms.to.trim().replace(/\s+/g, "")}${body ? "?body=" + encodeURIComponent(body) : ""}`;
      }
      case "whatsapp": {
        const phone = (state.whatsapp.phone || "").replace(/\D/g, "");
        if (!phone) return "";
        const msg = (state.whatsapp.message || "").trim();
        return `https://wa.me/${phone}${msg ? "?text=" + encodeURIComponent(msg) : ""}`;
      }
      case "geo": {
        const place = (state.geo.place || "").trim();
        if (!place) return "";
        return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place);
      }
      case "event": {
        const e = state.event;
        if (!(e.title || "").trim()) return "";
        const fmt = (v) => {
          if (!v) return "";
          const d = new Date(v);
          if (Number.isNaN(d.getTime())) return "";
          return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        };
        const lines = ["BEGIN:VEVENT", `SUMMARY:${e.title.trim()}`];
        if (e.location) lines.push(`LOCATION:${e.location}`);
        if (e.start) lines.push(`DTSTART:${fmt(e.start)}`);
        if (e.end) lines.push(`DTEND:${fmt(e.end)}`);
        if (e.notes) lines.push(`DESCRIPTION:${e.notes}`);
        lines.push("END:VEVENT");
        return "BEGIN:VCALENDAR\nVERSION:2.0\n" + lines.join("\n") + "\nEND:VCALENDAR";
      }
      case "vcard": {
        const c = state.vcard;
        if (!c.first && !c.last && !c.org && !c.phone && !c.email) return "";
        const fn = [c.first, c.last].filter(Boolean).join(" ");
        const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${c.last || ""};${c.first || ""};;;`, `FN:${fn || c.org || ""}`];
        if (c.org) lines.push(`ORG:${c.org}`);
        if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
        if (c.email) lines.push(`EMAIL:${c.email}`);
        if (c.url) lines.push(`URL:${normalizeUrl(c.url)}`);
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      default:
        return "";
    }
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_DRAFT, JSON.stringify(state)); } catch (_) {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state = {
        ...defaultState(),
        ...parsed,
        style: { ...defaultState().style, ...(parsed.style || {}) },
        wifi: { ...defaultState().wifi, ...(parsed.wifi || {}) },
        email: { ...defaultState().email, ...(parsed.email || {}) },
        sms: { ...defaultState().sms, ...(parsed.sms || {}) },
        whatsapp: { ...defaultState().whatsapp, ...(parsed.whatsapp || {}) },
        geo: { ...defaultState().geo, ...(parsed.geo || {}) },
        event: { ...defaultState().event, ...(parsed.event || {}) },
        vcard: { ...defaultState().vcard, ...(parsed.vcard || {}) },
      };
    } catch (_) {}
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(STORAGE_LIB);
      library = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(library)) library = [];
    } catch (_) { library = []; }
  }

  function saveLibrary() {
    try { localStorage.setItem(STORAGE_LIB, JSON.stringify(library)); }
    catch (_) { setStatus("Impossible d'enregistrer la collection (stockage plein ?)."); }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderKeywords() {
    const box = $("#keyword-chips");
    if (!box) return;
    box.innerHTML = "";
    state.keywords.forEach((k, i) => {
      const span = document.createElement("span");
      span.className = "chip-tag";
      span.innerHTML = `${escapeHtml(k)} <button type="button" aria-label="Retirer">×</button>`;
      span.querySelector("button").onclick = () => {
        state.keywords.splice(i, 1);
        renderKeywords();
        scheduleUpdate();
      };
      box.appendChild(span);
    });
  }

  function showKindPanels() {
    $$("[data-kind-panel]").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-kind-panel") !== state.kind);
    });
  }

  function showSection(id) {
    $$("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.getAttribute("data-panel") !== id));
    $$("[data-section]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-section") === id));
  }

  function renderPresets() {
    const box = $("#presets");
    if (!box) return;
    box.innerHTML = "";
    PRESETS.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";
      btn.innerHTML = `<span class="preset-swatch" style="--a:${p.fg};--b:${p.bg}"></span>${p.label}`;
      btn.onclick = () => {
        state.style.fg = p.fg;
        state.style.bg = p.bg;
        state.style.eye = p.eye;
        $("#fg").value = p.fg;
        $("#bg").value = p.bg;
        $("#eye").value = p.eye;
        scheduleUpdate();
        setStatus("Preset « " + p.label + " » appliqué.", true);
      };
      box.appendChild(btn);
    });
  }

  function renderLibrary() {
    const list = $("#library-list");
    const empty = $("#library-empty");
    if (!list) return;
    list.innerHTML = "";
    if (!library.length) { empty?.classList.remove("hidden"); return; }
    empty?.classList.add("hidden");
    library.slice().reverse().forEach((item) => {
      const row = document.createElement("div");
      row.className = "lib-item";
      const meta = document.createElement("div");
      meta.innerHTML = `<strong>${escapeHtml(item.name || "Sans titre")}</strong><span>${escapeHtml(item.kind)} · ${new Date(item.savedAt).toLocaleString("fr-FR")}</span>`;
      const actions = document.createElement("div");
      actions.className = "lib-actions";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "btn sm";
      loadBtn.textContent = "Ouvrir";
      loadBtn.onclick = () => {
        state = { ...defaultState(), ...item.design, style: { ...defaultState().style, ...(item.design.style || {}) } };
        syncFormFromState();
        scheduleUpdate();
        setStatus("Code chargé depuis la collection.", true);
        showSection("contenu");
      };
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn sm";
      delBtn.textContent = "Suppr.";
      delBtn.onclick = () => {
        library = library.filter((x) => x.id !== item.id);
        saveLibrary();
        renderLibrary();
        setStatus("Supprimé de la collection.");
      };
      actions.append(loadBtn, delBtn);
      row.append(meta, actions);
      list.appendChild(row);
    });
  }

  async function ensureQr() {
    if (qr) return qr;
    const mod = await import("https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/+esm");
    const QRCodeStyling = mod.default;
    const host = $("#qr-host");
    host.innerHTML = "";
    qr = new QRCodeStyling(buildQrOptions(320));
    qr.append(host);
    return qr;
  }

  function buildQrOptions(size) {
    const s = state.style;
    const ecl = s.logo ? "H" : s.ecl;
    return {
      width: size,
      height: size,
      type: "canvas",
      data: payload() || " ",
      margin: s.margin,
      qrOptions: { errorCorrectionLevel: ecl },
      dotsOptions: { type: s.dot, color: s.fg },
      cornersSquareOptions: { type: s.corner, color: s.eye },
      cornersDotOptions: { type: s.cornerDot, color: s.eye },
      backgroundOptions: { color: s.bg },
      image: s.logo || undefined,
      imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: s.logoSize, hideBackgroundDots: true },
    };
  }

  function applyFrameClass() {
    const card = $("#preview-frame");
    card.className = "preview-card frame-" + state.frame;
    const title = $("#frame-title");
    const sub = $("#frame-sub");
    const name = state.name.trim() || "Sans titre";
    const note = (state.frameNote || "").trim() || (state.kind === "keywords" ? state.keywords.join(" · ") : state.labels.join(" · "));
    if (state.frame === "nu") {
      title.classList.add("hidden");
      sub.classList.add("hidden");
    } else {
      title.classList.remove("hidden");
      title.textContent = name;
      if (note && ["etiquette", "ticket", "enseigne", "tampon"].includes(state.frame)) {
        sub.classList.remove("hidden");
        sub.textContent = note;
      } else sub.classList.add("hidden");
    }
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateQr(), 70);
    saveDraft();
  }

  async function updateQr() {
    const token = ++updateToken;
    const data = payload();
    $("#payload-text").textContent = data || "Ajoutez un contenu (URL, texte, mots-clés…).";
    try {
      const instance = await ensureQr();
      if (token !== updateToken) return;
      instance.update(buildQrOptions(320));
      applyFrameClass();
    } catch (err) {
      setStatus(err.message || "Erreur de rendu QR");
    }
  }

  async function makeExportInstance() {
    const mod = await import("https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/+esm");
    const QRCodeStyling = mod.default;
    return new QRCodeStyling(buildQrOptions(Number(state.exportSize) || 1024));
  }

  async function downloadPng() {
    const instance = await makeExportInstance();
    await instance.download({ name: slug(state.name), extension: "png" });
    setStatus("PNG téléchargé (" + state.exportSize + " px).", true);
  }

  async function downloadSvg() {
    const instance = await makeExportInstance();
    await instance.download({ name: slug(state.name), extension: "svg" });
    setStatus("SVG téléchargé.", true);
  }

  async function copyPng() {
    const instance = await makeExportInstance();
    const blob = await instance.getRawData("png");
    if (!blob) throw new Error("Impossible de générer l'image.");
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Image copiée dans le presse-papiers.", true);
    } else throw new Error("Copie image non supportée sur ce navigateur.");
  }

  function addToLibrary() {
    const item = {
      id: "q" + Date.now().toString(36),
      name: state.name.trim() || "Sans titre",
      kind: state.kind,
      savedAt: Date.now(),
      design: JSON.parse(JSON.stringify({ ...state, style: { ...state.style } })),
    };
    library.push(item);
    saveLibrary();
    renderLibrary();
    setStatus("Ajouté à la collection.", true);
  }

  function exportLibraryJson() {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qr-folio-library.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Collection exportée.", true);
  }

  function importLibraryJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("JSON invalide");
        library = data.concat(library);
        saveLibrary();
        renderLibrary();
        setStatus(data.length + " code(s) importé(s).", true);
      } catch (e) { setStatus("Import impossible : " + e.message); }
    };
    reader.readAsText(file);
  }

  async function generatePlanche() {
    const text = $("#planche-text").value || "";
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 48);
    const grid = $("#planche-grid");
    grid.innerHTML = "";
    if (!lines.length) { setStatus("Ajoutez au moins une ligne."); return; }
    const mod = await import("https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/+esm");
    const QRCodeStyling = mod.default;
    setStatus("Génération de " + lines.length + " code(s)…");
    for (const line of lines) {
      const cell = document.createElement("div");
      cell.className = "planche-cell";
      const host = document.createElement("div");
      cell.appendChild(host);
      const lbl = document.createElement("div");
      lbl.className = "lbl";
      lbl.textContent = line;
      cell.appendChild(lbl);
      grid.appendChild(cell);
      const opts = buildQrOptions(180);
      opts.data = /^[a-z][a-z0-9+.-]*:/i.test(line) ? line : (line.includes(".") && !line.includes(" ") ? normalizeUrl(line) : line);
      opts.image = state.style.logo || undefined;
      new QRCodeStyling(opts).append(host);
    }
    setStatus("Planche prête (" + lines.length + ").", true);
  }

  function syncFormFromState() {
    $("#name").value = state.name || "";
    $("#url").value = state.url || "";
    $("#text").value = state.text || "";
    $("#fg").value = state.style.fg;
    $("#bg").value = state.style.bg;
    $("#eye").value = state.style.eye;
    $("#margin").value = state.style.margin;
    $("#margin-val").textContent = state.style.margin + " px";
    $("#logo-size").value = Math.round(state.style.logoSize * 100);
    $("#logo-size-val").textContent = Math.round(state.style.logoSize * 100) + " %";
    $("#ecl").value = state.style.ecl;
    $("#export-size").value = String(state.exportSize || 1024);
    $("#frame-note").value = state.frameNote || "";
    $("#ssid").value = state.wifi.ssid || "";
    $("#wifipass").value = state.wifi.password || "";
    $("#wifi-sec").value = state.wifi.security || "WPA";
    if ($("#wifi-hidden")) $("#wifi-hidden").checked = !!state.wifi.hidden;
    $("#email-to").value = state.email.to || "";
    $("#email-subject").value = state.email.subject || "";
    $("#email-body").value = state.email.body || "";
    $("#phone").value = state.phone || "";
    $("#sms-to").value = state.sms.to || "";
    $("#sms-body").value = state.sms.body || "";
    $("#v-first").value = state.vcard.first || "";
    $("#v-last").value = state.vcard.last || "";
    $("#v-org").value = state.vcard.org || "";
    $("#v-phone").value = state.vcard.phone || "";
    $("#v-email").value = state.vcard.email || "";
    $("#v-url").value = state.vcard.url || "";
    if ($("#wa-phone")) $("#wa-phone").value = state.whatsapp?.phone || "";
    if ($("#wa-msg")) $("#wa-msg").value = state.whatsapp?.message || "";
    if ($("#geo-place")) $("#geo-place").value = state.geo?.place || "";
    if ($("#ev-title")) $("#ev-title").value = state.event?.title || "";
    if ($("#ev-loc")) $("#ev-loc").value = state.event?.location || "";
    if ($("#ev-start")) $("#ev-start").value = state.event?.start || "";
    if ($("#ev-end")) $("#ev-end").value = state.event?.end || "";
    if ($("#ev-notes")) $("#ev-notes").value = state.event?.notes || "";
    renderKeywords();
    showKindPanels();
    $$("[data-kind]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-kind") === state.kind));
    $$("[data-frame]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-frame") === state.frame));
    $$("[data-dot]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-dot") === state.style.dot));
    $$("[data-corner]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-corner") === state.style.corner));
  }

  function bind() {
    $$("[data-section]").forEach((btn) => btn.addEventListener("click", () => showSection(btn.getAttribute("data-section"))));
    $$("[data-kind]").forEach((btn) => btn.addEventListener("click", () => {
      state.kind = btn.getAttribute("data-kind");
      $$("[data-kind]").forEach((b) => b.classList.toggle("active", b === btn));
      showKindPanels();
      scheduleUpdate();
    }));
    $$("[data-frame]").forEach((btn) => btn.addEventListener("click", () => {
      state.frame = btn.getAttribute("data-frame");
      $$("[data-frame]").forEach((b) => b.classList.toggle("active", b === btn));
      applyFrameClass();
      saveDraft();
    }));
    $$("[data-dot]").forEach((btn) => btn.addEventListener("click", () => {
      state.style.dot = btn.getAttribute("data-dot");
      $$("[data-dot]").forEach((b) => b.classList.toggle("active", b === btn));
      scheduleUpdate();
    }));
    $$("[data-corner]").forEach((btn) => btn.addEventListener("click", () => {
      state.style.corner = btn.getAttribute("data-corner");
      $$("[data-corner]").forEach((b) => b.classList.toggle("active", b === btn));
      scheduleUpdate();
    }));

    const mapInput = (id, fn) => {
      const el = $("#" + id);
      if (!el) return;
      const run = () => { fn(el); scheduleUpdate(); };
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    };

    mapInput("name", (el) => { state.name = el.value; applyFrameClass(); });
    mapInput("url", (el) => { state.url = el.value; });
    mapInput("text", (el) => { state.text = el.value; });
    mapInput("frame-note", (el) => { state.frameNote = el.value; applyFrameClass(); });
    mapInput("fg", (el) => { state.style.fg = el.value; });
    mapInput("bg", (el) => { state.style.bg = el.value; });
    mapInput("eye", (el) => { state.style.eye = el.value; });
    mapInput("margin", (el) => { state.style.margin = Number(el.value); $("#margin-val").textContent = el.value + " px"; });
    mapInput("logo-size", (el) => { state.style.logoSize = Number(el.value) / 100; $("#logo-size-val").textContent = el.value + " %"; });
    mapInput("ecl", (el) => { state.style.ecl = el.value; });
    mapInput("export-size", (el) => { state.exportSize = Number(el.value); });
    mapInput("ssid", (el) => { state.wifi.ssid = el.value; });
    mapInput("wifipass", (el) => { state.wifi.password = el.value; });
    mapInput("wifi-sec", (el) => { state.wifi.security = el.value; });
    mapInput("wifi-hidden", (el) => { state.wifi.hidden = el.checked; });
    mapInput("email-to", (el) => { state.email.to = el.value; });
    mapInput("email-subject", (el) => { state.email.subject = el.value; });
    mapInput("email-body", (el) => { state.email.body = el.value; });
    mapInput("phone", (el) => { state.phone = el.value; });
    mapInput("sms-to", (el) => { state.sms.to = el.value; });
    mapInput("sms-body", (el) => { state.sms.body = el.value; });
    mapInput("v-first", (el) => { state.vcard.first = el.value; });
    mapInput("v-last", (el) => { state.vcard.last = el.value; });
    mapInput("v-org", (el) => { state.vcard.org = el.value; });
    mapInput("v-phone", (el) => { state.vcard.phone = el.value; });
    mapInput("v-email", (el) => { state.vcard.email = el.value; });
    mapInput("v-url", (el) => { state.vcard.url = el.value; });
    mapInput("wa-phone", (el) => { state.whatsapp = state.whatsapp || { phone: "", message: "" }; state.whatsapp.phone = el.value; });
    mapInput("wa-msg", (el) => { state.whatsapp = state.whatsapp || { phone: "", message: "" }; state.whatsapp.message = el.value; });
    mapInput("geo-place", (el) => { state.geo = state.geo || { place: "" }; state.geo.place = el.value; });
    mapInput("ev-title", (el) => { state.event = state.event || { title: "", location: "", start: "", end: "", notes: "" }; state.event.title = el.value; });
    mapInput("ev-loc", (el) => { state.event = state.event || { title: "", location: "", start: "", end: "", notes: "" }; state.event.location = el.value; });
    mapInput("ev-start", (el) => { state.event = state.event || { title: "", location: "", start: "", end: "", notes: "" }; state.event.start = el.value; });
    mapInput("ev-end", (el) => { state.event = state.event || { title: "", location: "", start: "", end: "", notes: "" }; state.event.end = el.value; });
    mapInput("ev-notes", (el) => { state.event = state.event || { title: "", location: "", start: "", end: "", notes: "" }; state.event.notes = el.value; });

    $("#btn-classic")?.addEventListener("click", () => {
      const d = defaultState();
      state.style = { ...d.style };
      state.frame = "nu";
      $("#fg").value = d.style.fg;
      $("#bg").value = d.style.bg;
      $("#eye").value = d.style.eye;
      $("#margin").value = d.style.margin;
      $("#margin-val").textContent = d.style.margin + " px";
      $("#ecl").value = d.style.ecl;
      $$("[data-dot]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-dot") === "square"));
      $$("[data-corner]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-corner") === "square"));
      $$("[data-frame]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-frame") === "nu"));
      scheduleUpdate();
      applyFrameClass();
      setStatus("QR classique appliqué.", true);
    });

    const keywordInput = $("#keyword-input");
    keywordInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = keywordInput.value.replace(/,/g, "").trim();
        if (v && !state.keywords.includes(v)) {
          state.keywords.push(v);
          keywordInput.value = "";
          renderKeywords();
          scheduleUpdate();
        }
      } else if (e.key === "Backspace" && !keywordInput.value && state.keywords.length) {
        state.keywords.pop();
        renderKeywords();
        scheduleUpdate();
      }
    });

    $("#logo-file")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.style.logo = reader.result;
        scheduleUpdate();
        setStatus("Logo ajouté.", true);
      };
      reader.readAsDataURL(f);
    });
    $("#logo-clear")?.addEventListener("click", () => {
      state.style.logo = null;
      scheduleUpdate();
      setStatus("Logo retiré.");
    });

    $("#btn-new")?.addEventListener("click", () => {
      state = defaultState();
      syncFormFromState();
      scheduleUpdate();
      setStatus("Nouveau code.", true);
    });
    $("#btn-save")?.addEventListener("click", () => { saveDraft(); addToLibrary(); });
    const bindExport = (id, fn) => $("#" + id)?.addEventListener("click", () => fn().catch((e) => setStatus(e.message)));
    bindExport("btn-png", downloadPng);
    bindExport("btn-svg", downloadSvg);
    bindExport("btn-copy", copyPng);
    bindExport("btn-png-2", downloadPng);
    bindExport("btn-svg-2", downloadSvg);
    bindExport("btn-copy-2", copyPng);
    $("#btn-print")?.addEventListener("click", () => window.print());
    $("#btn-print-2")?.addEventListener("click", () => window.print());
    $("#btn-save-lib")?.addEventListener("click", addToLibrary);
    $("#btn-export-lib")?.addEventListener("click", exportLibraryJson);
    $("#import-lib")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) importLibraryJson(f);
    });
    $("#btn-planche")?.addEventListener("click", () => generatePlanche().catch((e) => setStatus(e.message)));

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
        addToLibrary();
      }
    });
  }

  loadDraft();
  loadLibrary();
  bind();
  renderPresets();
  renderLibrary();
  syncFormFromState();
  updateQr().catch((err) => setStatus(err.message || "Erreur QR"));
})();
