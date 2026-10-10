/* Générateur QR Code — logique client */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    kind: "url",
    name: "Carte du menu",
    url: "https://exemple.fr/menu",
    text: "",
    keywords: ["menu", "terrasse"],
    labels: [],
    wifi: { ssid: "", password: "", security: "WPA", hidden: false },
    email: { to: "", subject: "", body: "" },
    phone: "",
    sms: { to: "", body: "" },
    vcard: { first: "", last: "", org: "", phone: "", email: "", url: "" },
    style: {
      fg: "#1c1915",
      bg: "#fffdf8",
      eye: "#9a341c",
      dot: "rounded",
      corner: "extra-rounded",
      cornerDot: "dot",
      margin: 12,
      logo: null,
      logoSize: 0.28,
      ecl: "Q",
    },
    frame: "etiquette",
  };

  let qr = null;
  let statusTimer = null;

  function setStatus(msg) {
    const el = $("#status");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 4000);
  }

  function normalizeUrl(raw) {
    const t = (raw || "").trim();
    if (!t) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
    return "https://" + t;
  }

  function wifiEscape(s) {
    return String(s).replace(/([\\;,:"])/g, "\\$1");
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
      case "vcard": {
        const c = state.vcard;
        if (!c.first && !c.last && !c.org && !c.phone && !c.email) return "";
        const fn = [c.first, c.last].filter(Boolean).join(" ");
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${c.last || ""};${c.first || ""};;;`,
          `FN:${fn || c.org || ""}`,
        ];
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

  function renderKeywords() {
    const box = $("#keyword-chips");
    if (!box) return;
    box.innerHTML = "";
    state.keywords.forEach((k, i) => {
      const span = document.createElement("span");
      span.className = "chip-tag";
      span.innerHTML = `${k} <button type="button" aria-label="Retirer">×</button>`;
      span.querySelector("button").onclick = () => {
        state.keywords.splice(i, 1);
        renderKeywords();
        updateQr();
      };
      box.appendChild(span);
    });
  }

  function showKindPanels() {
    $$("[data-kind-panel]").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-kind-panel") !== state.kind);
    });
  }

  async function ensureQr() {
    if (qr) return qr;
    const mod = await import("https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/+esm");
    const QRCodeStyling = mod.default;
    const host = $("#qr-host");
    host.innerHTML = "";
    qr = new QRCodeStyling({
      width: 320,
      height: 320,
      type: "canvas",
      data: " ",
      margin: state.style.margin,
      qrOptions: { errorCorrectionLevel: state.style.ecl },
      dotsOptions: { type: state.style.dot, color: state.style.fg },
      cornersSquareOptions: { type: state.style.corner, color: state.style.eye },
      cornersDotOptions: { type: state.style.cornerDot, color: state.style.eye },
      backgroundOptions: { color: state.style.bg },
      imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: state.style.logoSize, hideBackgroundDots: true },
    });
    qr.append(host);
    return qr;
  }

  async function updateQr() {
    const data = payload() || " ";
    $("#payload-text").textContent = payload() || "Ajoutez un contenu (URL, texte, mots-clés…).";
    const instance = await ensureQr();
    const s = state.style;
    const ecl = s.logo ? "H" : s.ecl;
    instance.update({
      data,
      margin: s.margin,
      image: s.logo || undefined,
      qrOptions: { errorCorrectionLevel: ecl },
      dotsOptions: { type: s.dot, color: s.fg },
      cornersSquareOptions: { type: s.corner, color: s.eye },
      cornersDotOptions: { type: s.cornerDot, color: s.eye },
      backgroundOptions: { color: s.bg },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: s.logoSize,
        hideBackgroundDots: true,
      },
    });
    applyFrameClass();
  }

  function applyFrameClass() {
    const card = $("#preview-frame");
    card.className = "preview-card frame-" + state.frame;
    const title = $("#frame-title");
    const sub = $("#frame-sub");
    const name = state.name.trim() || "Sans titre";
    const tags = state.kind === "keywords" ? state.keywords : state.labels;
    if (state.frame === "nu") {
      title.classList.add("hidden");
      sub.classList.add("hidden");
    } else {
      title.classList.remove("hidden");
      title.textContent = name;
      if (tags.length && (state.frame === "etiquette" || state.frame === "ticket" || state.frame === "enseigne")) {
        sub.classList.remove("hidden");
        sub.textContent = tags.join(" · ");
      } else {
        sub.classList.add("hidden");
      }
    }
  }

  async function downloadPng() {
    const instance = await ensureQr();
    await instance.download({ name: slug(state.name) || "generateur-qr", extension: "png" });
    setStatus("PNG téléchargé.");
  }

  async function downloadSvg() {
    const instance = await ensureQr();
    await instance.download({ name: slug(state.name) || "generateur-qr", extension: "svg" });
    setStatus("SVG téléchargé.");
  }

  function slug(name) {
    return (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function bind() {
    $$("[data-kind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.kind = btn.getAttribute("data-kind");
        $$("[data-kind]").forEach((b) => b.classList.toggle("active", b === btn));
        showKindPanels();
        updateQr();
      });
    });

    $$("[data-frame]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.frame = btn.getAttribute("data-frame");
        $$("[data-frame]").forEach((b) => b.classList.toggle("active", b === btn));
        applyFrameClass();
      });
    });

    $$("[data-dot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.style.dot = btn.getAttribute("data-dot");
        $$("[data-dot]").forEach((b) => b.classList.toggle("active", b === btn));
        updateQr();
      });
    });

    $("#name").addEventListener("input", (e) => {
      state.name = e.target.value;
      applyFrameClass();
    });
    $("#url").addEventListener("input", (e) => {
      state.url = e.target.value;
      updateQr();
    });
    $("#text").addEventListener("input", (e) => {
      state.text = e.target.value;
      updateQr();
    });

    $("#keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = e.target.value.trim().replace(/,$/, "");
        if (v && !state.keywords.includes(v)) {
          state.keywords.push(v.slice(0, 48));
          renderKeywords();
          updateQr();
        }
        e.target.value = "";
      }
    });

    $("#fg").addEventListener("input", (e) => {
      state.style.fg = e.target.value;
      updateQr();
    });
    $("#bg").addEventListener("input", (e) => {
      state.style.bg = e.target.value;
      updateQr();
    });
    $("#eye").addEventListener("input", (e) => {
      state.style.eye = e.target.value;
      updateQr();
    });
    $("#margin").addEventListener("input", (e) => {
      state.style.margin = Number(e.target.value);
      $("#margin-val").textContent = state.style.margin + " px";
      updateQr();
    });

    $("#logo-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.style.logo = reader.result;
        updateQr();
        setStatus("Logo ajouté.");
      };
      reader.readAsDataURL(file);
    });
    $("#logo-clear").addEventListener("click", () => {
      state.style.logo = null;
      updateQr();
      setStatus("Logo retiré.");
    });

    ["ssid", "wifipass"].forEach((id) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => {
        if (id === "ssid") state.wifi.ssid = el.value;
        else state.wifi.password = el.value;
        updateQr();
      });
    });
    $("#wifi-sec")?.addEventListener("change", (e) => {
      state.wifi.security = e.target.value;
      updateQr();
    });

    $("#email-to")?.addEventListener("input", (e) => {
      state.email.to = e.target.value;
      updateQr();
    });
    $("#phone")?.addEventListener("input", (e) => {
      state.phone = e.target.value;
      updateQr();
    });
    $("#sms-to")?.addEventListener("input", (e) => {
      state.sms.to = e.target.value;
      updateQr();
    });
    $("#sms-body")?.addEventListener("input", (e) => {
      state.sms.body = e.target.value;
      updateQr();
    });

    ["v-first", "v-last", "v-org", "v-phone", "v-email", "v-url"].forEach((id) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => {
        const map = {
          "v-first": "first",
          "v-last": "last",
          "v-org": "org",
          "v-phone": "phone",
          "v-email": "email",
          "v-url": "url",
        };
        state.vcard[map[id]] = el.value;
        updateQr();
      });
    });

    $("#btn-png").addEventListener("click", () => downloadPng().catch((err) => setStatus(err.message)));
    $("#btn-svg").addEventListener("click", () => downloadSvg().catch((err) => setStatus(err.message)));
    $("#btn-print").addEventListener("click", () => window.print());

    $("#btn-new").addEventListener("click", () => {
      state.name = "";
      state.url = "";
      state.text = "";
      state.keywords = [];
      state.style.logo = null;
      $("#name").value = "";
      $("#url").value = "";
      $("#text").value = "";
      renderKeywords();
      updateQr();
      setStatus("Nouveau code.");
    });
  }

  function initForm() {
    $("#name").value = state.name;
    $("#url").value = state.url;
    $("#fg").value = state.style.fg;
    $("#bg").value = state.style.bg;
    $("#eye").value = state.style.eye;
    $("#margin").value = state.style.margin;
    $("#margin-val").textContent = state.style.margin + " px";
    renderKeywords();
    showKindPanels();
    $$("[data-kind]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-kind") === state.kind));
    $$("[data-frame]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-frame") === state.frame));
    $$("[data-dot]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-dot") === state.style.dot));
  }

  bind();
  initForm();
  updateQr().catch((err) => setStatus(err.message || "Erreur QR"));
})();
