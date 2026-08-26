const $ = (x) => document.getElementById(x);
const get = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const set = (o) => new Promise((r) => chrome.storage.local.set(o, r));
const remove = (k) => new Promise((r) => chrome.storage.local.remove(k, r));
const sk = (id) => `playlist:${id}`;
const ik = (i) => i.videoId || `missing:${i.index || ""}:${i.title}`;
const esc = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const send = (m) => new Promise((r, j) => chrome.runtime.sendMessage(m, (x) => chrome.runtime.lastError ? j(new Error(chrome.runtime.lastError.message)) : r(x)));

let lang = "es";
let theme = "neon";
let pendingDelete = null;
let flashPlaylistId = null;

const T = {
  es: {
    tag: "Recuerda lo que YouTube olvida.",
    hero: "Protege una playlist",
    sub: "Pega el enlace. Cada playlist se controla por separado.",
    add: "Añadir",
    lib: "Playlists",
    miss: "Desaparecidos",
    search: "Buscar playlist, canción o canal…",
    backup: "Exportar",
    import: "Importar",
    empty: "Todavía no protegiste ninguna playlist.",
    missSearch: "Buscar video desaparecido…",
    emptyMiss: "No hay videos desaparecidos actualmente.",
    last: "Última revisión",
    auto: "Automática",
    manual: "Manual",
    m15: "15 min", m30: "30 min", h1: "1 hora", h6: "6 horas", h12: "12 horas", d1: "1 día", d3: "3 días", d7: "7 días",
    videos: "videos",
    missing: "desaparecidos",
    restored: "restaurados",
    new: "nuevos",
    checking: "Actualizando en segundo plano…",
    done: "Actualización completada.",
    added: "Playlist protegida.",
    bad: "Enlace de playlist inválido.",
    historyEmpty: "Sin cambios registrados.",
    evMissing: "Desapareció",
    evRestored: "Volvió",
    evAdded: "Añadido",
    yt: "Buscar en YouTube",
    google: "Buscar en Google",
    activityOk: "Todo al día",
    activityPending: "Hay verificaciones pendientes",
    activityError: "Alguna verificación tuvo un error temporal",
    deleteTitle: "¿Eliminar esta playlist?",
    deleteBody: "Dejará de estar protegida y se borrará su historial local.",
    cancel: "Cancelar",
    remove: "Eliminar",
    importOk: "Backup importado correctamente.",
    importBad: "No se pudo importar el backup.",
    onboardingTitle: "Tu memoria para playlists",
    step1: "Añade una playlist que quieras proteger.",
    step2: "Playlist Guard recuerda los videos que contiene.",
    step3: "Si alguno desaparece, conserva su nombre y registra si vuelve.",
    onboardingDone: "Entendido",
    thumbFallback: "Sin portada",
    themeNeon: "Neon Night",
    themeMidnight: "Midnight Blue",
    themeLight: "Light Archive"
  },
  en: {
    tag: "Remember what YouTube forgets.",
    hero: "Protect a playlist",
    sub: "Paste the link. Each playlist is controlled independently.",
    add: "Add",
    lib: "Playlists",
    miss: "Missing",
    search: "Search playlist, song or channel…",
    backup: "Export",
    import: "Import",
    empty: "You haven't protected any playlist yet.",
    missSearch: "Search missing video…",
    emptyMiss: "No videos are currently missing.",
    last: "Last check",
    auto: "Automatic",
    manual: "Manual",
    m15: "15 min", m30: "30 min", h1: "1 hour", h6: "6 hours", h12: "12 hours", d1: "1 day", d3: "3 days", d7: "7 days",
    videos: "videos",
    missing: "missing",
    restored: "restored",
    new: "new",
    checking: "Updating in background…",
    done: "Refresh completed.",
    added: "Playlist protected.",
    bad: "Invalid playlist link.",
    historyEmpty: "No changes recorded.",
    evMissing: "Went missing",
    evRestored: "Returned",
    evAdded: "Added",
    yt: "Search YouTube",
    google: "Search Google",
    activityOk: "Everything is up to date",
    activityPending: "Some checks are pending",
    activityError: "A check had a temporary error",
    deleteTitle: "Remove this playlist?",
    deleteBody: "It will no longer be protected and its local history will be deleted.",
    cancel: "Cancel",
    remove: "Remove",
    importOk: "Backup imported successfully.",
    importBad: "Could not import backup.",
    onboardingTitle: "Your playlist memory",
    step1: "Add a playlist you want to protect.",
    step2: "Playlist Guard remembers the videos inside it.",
    step3: "If one disappears, it keeps its name and records if it returns.",
    onboardingDone: "Got it",
    thumbFallback: "No cover",
    themeNeon: "Neon Night",
    themeMidnight: "Midnight Blue",
    themeLight: "Light Archive"
  }
};
const t = (k) => T[lang][k] || k;

const ICONS = {
  refresh: `<svg viewBox="0 0 24 24"><path d="M20 6v5h-5"/><path d="M19 11a7.5 7.5 0 1 0 1 5"/></svg>`,
  open: `<svg viewBox="0 0 24 24"><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 14v5H5V5h5"/></svg>`,
  view: `<svg viewBox="0 0 24 24"><path d="M8 7h11"/><path d="M8 12h11"/><path d="M8 17h11"/><path d="M5 7h.01"/><path d="M5 12h.01"/><path d="M5 17h.01"/></svg>`,
  history: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>`,
  delete: `<svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V4h6v3"/><path d="M8 10v8"/><path d="M12 10v8"/><path d="M16 10v8"/><path d="M7 7l1 13h8l1-13"/></svg>`
};

function date(s) {
  try {
    return new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
  } catch { return s || "—"; }
}
function parse(raw) {
  try {
    const u = new URL(raw.trim());
    const id = u.searchParams.get("list");
    return id && /^PL[A-Za-z0-9_-]+$/.test(id) ? { id, url: `https://www.youtube.com/playlist?list=${id}` } : null;
  } catch {
    const id = raw.trim();
    return /^PL[A-Za-z0-9_-]+$/.test(id) ? { id, url: `https://www.youtube.com/playlist?list=${id}` } : null;
  }
}
async function lists() {
  const a = await get(null);
  return Object.entries(a)
    .filter(([k, v]) => k.startsWith("playlist:") && v?.playlistId)
    .map(([, v]) => v)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
function migrate(p) {
  const known = { ...(p.knownItems || {}) };
  if (!Object.keys(known).length) for (const x of (p.items || [])) known[ik(x)] = x;
  const playlistThumbnail = p.playlistThumbnail || (p.items || []).find((x) => x.thumbnail)?.thumbnail || null;
  return {
    ...p,
    knownItems: known,
    playlistThumbnail,
    missingNow: p.missingNow || [],
    eventHistory: p.eventHistory || [],
    autoIntervalMinutes: p.autoIntervalMinutes ?? 360,
    nextAutoAt: p.nextAutoAt ?? Date.now() + 360 * 60000
  };
}
function labels() {
  $("tag").textContent = t("tag");
  $("heroTitle").textContent = t("hero");
  $("heroSub").textContent = t("sub");
  $("url").placeholder = "https://youtube.com/playlist?list=PL...";
  $("addBtn").textContent = t("add");
  $("libBtn").textContent = t("lib");
  $("missBtn").textContent = t("miss");
  $("search").placeholder = t("search");
  $("backup").textContent = t("backup");
  $("importBtn").textContent = t("import");
  $("empty").textContent = t("empty");
  $("missSearch").placeholder = t("missSearch");
  $("emptyMiss").textContent = t("emptyMiss");
  $("deleteTitle").textContent = t("deleteTitle");
  $("deleteBody").textContent = t("deleteBody");
  $("deleteCancel").textContent = t("cancel");
  $("deleteConfirm").textContent = t("remove");
  $("onboardingTitle").textContent = t("onboardingTitle");
  $("step1").textContent = t("step1");
  $("step2").textContent = t("step2");
  $("step3").textContent = t("step3");
  $("onboardingDone").textContent = t("onboardingDone");

  $("theme").innerHTML = `
    <option value="neon">${esc(t("themeNeon"))}</option>
    <option value="midnight">${esc(t("themeMidnight"))}</option>
    <option value="light">${esc(t("themeLight"))}</option>
  `;
  $("theme").value = theme;
}
function applyTheme() {
  document.body.dataset.theme = theme;
}
function opts(v) {
  return [[0, t("manual")], [15, t("m15")], [30, t("m30")], [60, t("h1")], [360, t("h6")], [720, t("h12")], [1440, t("d1")], [4320, t("d3")], [10080, t("d7")]]
    .map(([x, l]) => `<option value="${x}" ${Number(v) === x ? "selected" : ""}>${esc(l)}</option>`).join("");
}
function songs(a) {
  return (a || []).map((x, n) => `<div class="song"><div class="num">${esc(x.index || n + 1)}</div><div><a target="_blank" href="${esc(x.url || "#")}">${esc(x.title)}</a><div>${esc(x.channel || "")}</div></div></div>`).join("");
}
function events(a) {
  if (!a?.length) return `<div class="event">${esc(t("historyEmpty"))}</div>`;
  return [...a].reverse().map((e) => {
    const cls = e.type === "missing" ? "missingE" : e.type === "restored" ? "restoredE" : "addedE";
    const lab = e.type === "missing" ? t("evMissing") : e.type === "restored" ? t("evRestored") : t("evAdded");
    return `<div class="event"><b class="${cls}">${esc(lab)}</b> · ${esc(date(e.at))}<br>${esc(e.item?.title || "")} ${e.item?.channel ? `— ${esc(e.item.channel)}` : ""}</div>`;
  }).join("");
}
function thumbMarkup(p) {
  const thumb = p.playlistThumbnail || (p.items || []).find((x) => x.thumbnail)?.thumbnail || "";
  if (thumb) return `<img src="${esc(thumb)}" alt="">`;
  return `<div class="thumbFallback">${esc(t("thumbFallback"))}</div>`;
}
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 1800);
}
async function updateActivity() {
  const arr = (await lists()).map(migrate);
  const strip = $("activityStrip");
  strip.classList.remove("pending", "error");
  if (arr.some((p) => p.lastCheckStatus === "error")) {
    strip.classList.add("error");
    $("activityText").textContent = t("activityError");
    return;
  }
  if (arr.some((p) => p.autoIntervalMinutes > 0 && p.nextAutoAt && p.nextAutoAt <= Date.now())) {
    strip.classList.add("pending");
    $("activityText").textContent = t("activityPending");
    return;
  }
  $("activityText").textContent = t("activityOk");
}
async function updateBadge() {
  const arr = (await lists()).map(migrate);
  const total = arr.reduce((n, p) => n + (p.missingNow?.length || 0), 0);
  chrome.action.setBadgeText({ text: total ? String(Math.min(total, 99)) : "" });
  if (total) chrome.action.setBadgeBackgroundColor({ color: "#ff477e" });
}

async function render() {
  const q = $("search").value.trim().toLowerCase();
  const arr = await lists();
  $("cards").innerHTML = "";
  let shown = 0;

  for (const p0 of arr) {
    const p = migrate(p0);
    const hay = [p.title, ...(p.items || []).flatMap((x) => [x.title, x.channel])].filter(Boolean).join(" ").toLowerCase();
    if (q && !hay.includes(q)) continue;
    shown++;

    const m = p.missingNow?.length || 0;
    const r = p.lastChanges?.restored?.length || 0;
    const n = p.lastChanges?.added?.length || 0;

    const c = document.createElement("article");
    c.className = "card";
    if (flashPlaylistId === p.playlistId) c.classList.add("justChecked");
    if (r > 0 && flashPlaylistId === p.playlistId) c.classList.add("restoredFlash");

    c.innerHTML = `
      <div class="head">
        <div class="thumbBox">${thumbMarkup(p)}</div>
        <div>
          <div class="title">${esc(p.title)}</div>
          <div class="meta">${p.items.length} ${esc(t("videos"))} · ${esc(t("last"))}: ${esc(date(p.lastCheckAt || p.updatedAt))}</div>
          <div class="pills">
            <span class="pill ${m ? "bad" : "good"}">${m} ${esc(t("missing"))}</span>
            ${r ? `<span class="pill good">+${r} ${esc(t("restored"))}</span>` : ""}
            ${n ? `<span class="pill">+${n} ${esc(t("new"))}</span>` : ""}
            ${p.lastCheckStatus === "incomplete" ? `<span class="pill warn">⚠</span>` : ""}
          </div>
          <div class="interval">${esc(t("auto"))}: <select>${opts(p.autoIntervalMinutes)}</select></div>
        </div>
        <div class="actions">
          <button class="icon refresh" title="Refresh">${ICONS.refresh}</button>
          <button class="icon open" title="Open">${ICONS.open}</button>
          <button class="icon view" title="View">${ICONS.view}</button>
          <button class="icon hist" title="History">${ICONS.history}</button>
          <button class="icon del" title="Delete">${ICONS.delete}</button>
        </div>
      </div>
      <div class="detail songBox hidden">${songs(p.items)}</div>
      <div class="detail eventBox hidden">${events(p.eventHistory)}</div>
    `;

    c.querySelector("select").onchange = async (e) => {
      const minutes = Number(e.target.value);
      await set({ [sk(p.playlistId)]: { ...p, autoIntervalMinutes: minutes, nextAutoAt: minutes > 0 ? Date.now() + minutes * 60000 : null } });
      await render();
      await updateActivity();
    };

    c.querySelector(".refresh").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("spin");
      $("msg").textContent = t("checking");
      try {
        const x = await send({ type: "CHECK", id: p.playlistId });
        if (!x?.ok) throw new Error(x?.error || "Error");
        flashPlaylistId = p.playlistId;
        $("msg").textContent = t("done");
        showToast(t("done"));
        await render();
        await renderMissing();
        await updateActivity();
        await updateBadge();
        setTimeout(() => { flashPlaylistId = null; render(); }, 1300);
      } catch (err) {
        $("msg").textContent = err.message;
        await updateActivity();
      } finally {
        btn.disabled = false;
        btn.classList.remove("spin");
      }
    };

    c.querySelector(".open").onclick = () => chrome.tabs.create({ url: p.sourceUrl });
    const sb = c.querySelector(".songBox");
    const eb = c.querySelector(".eventBox");
    c.querySelector(".view").onclick = () => { sb.classList.toggle("hidden"); eb.classList.add("hidden"); };
    c.querySelector(".hist").onclick = () => { eb.classList.toggle("hidden"); sb.classList.add("hidden"); };
    c.querySelector(".del").onclick = () => { pendingDelete = p; $("deleteDialog").showModal(); };

    $("cards").appendChild(c);
  }

  $("empty").classList.toggle("hidden", shown > 0);
}
async function renderMissing() {
  const q = $("missSearch").value.trim().toLowerCase();
  const arr = await lists();
  $("missing").innerHTML = "";
  let shown = 0;

  for (const p0 of arr) {
    const p = migrate(p0);
    for (const x of p.missingNow || []) {
      const hay = [x.title, x.channel, p.title].filter(Boolean).join(" ").toLowerCase();
      if (q && !hay.includes(q)) continue;
      shown++;
      const qq = encodeURIComponent([x.title, x.channel].filter(Boolean).join(" "));
      const c = document.createElement("article");
      c.className = "missingCard";
      c.innerHTML = `
        <b>${esc(x.title)}</b>
        <p>${esc(x.channel || "")} · ${esc(p.title)}</p>
        <a target="_blank" href="https://www.youtube.com/results?search_query=${qq}">${esc(t("yt"))}</a>
        <a target="_blank" href="https://www.google.com/search?q=${qq}">${esc(t("google"))}</a>
      `;
      $("missing").appendChild(c);
    }
  }
  $("emptyMiss").classList.toggle("hidden", shown > 0);
}

$("addBtn").onclick = async () => {
  const p = parse($("url").value);
  if (!p) { $("msg").textContent = t("bad"); return; }
  $("msg").textContent = t("checking");
  try {
    const r = await send({ type: "FETCH", id: p.id, url: p.url });
    if (!r?.ok) throw new Error(r?.error || "Error");
    const cur = r.data;
    const known = {};
    cur.items.forEach((x) => known[ik(x)] = x);
    await set({
      [sk(cur.playlistId)]: {
        playlistId: cur.playlistId,
        title: cur.title,
        sourceUrl: cur.sourceUrl,
        playlistThumbnail: cur.playlistThumbnail || (cur.items || []).find((x) => x.thumbnail)?.thumbnail || null,
        createdAt: cur.capturedAt,
        updatedAt: cur.capturedAt,
        lastCheckAt: cur.capturedAt,
        lastSuccessfulCheckAt: cur.capturedAt,
        lastCheckStatus: "ok",
        items: cur.items,
        knownItems: known,
        missingNow: [],
        lastChanges: { missing: [], restored: [], added: [] },
        history: [],
        eventHistory: [],
        autoIntervalMinutes: 360,
        nextAutoAt: Date.now() + 360 * 60000
      }
    });
    $("url").value = "";
    $("msg").textContent = t("added");
    showToast(t("added"));
    await render();
    await renderMissing();
    await updateActivity();
    await updateBadge();
  } catch (e) {
    $("msg").textContent = e.message;
  }
};

$("deleteConfirm").onclick = async () => {
  if (!pendingDelete) return;
  await remove(sk(pendingDelete.playlistId));
  pendingDelete = null;
  await render();
  await renderMissing();
  await updateActivity();
  await updateBadge();
};

$("search").oninput = render;
$("missSearch").oninput = renderMissing;

$("lang").onchange = async () => {
  lang = $("lang").value;
  await set({ language: lang });
  labels();
  applyTheme();
  await render();
  await renderMissing();
  await updateActivity();
};
$("theme").onchange = async () => {
  theme = $("theme").value;
  await set({ theme });
  applyTheme();
};

$("backup").onclick = async () => {
  const a = await get(null);
  const blob = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(blob);
  const x = document.createElement("a");
  x.href = u;
  x.download = `playlist-guard-${new Date().toISOString().slice(0, 10)}.json`;
  x.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};

$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async () => {
  const f = $("importFile").files?.[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("bad");
    const safe = {};
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith("playlist:") && v?.playlistId && Array.isArray(v.items)) safe[k] = v;
      else if (["language", "theme", "onboardingSeen"].includes(k)) safe[k] = v;
    }
    await set(safe);
    if (safe.language) lang = safe.language;
    if (safe.theme) theme = safe.theme;
    labels();
    applyTheme();
    showToast(t("importOk"));
    $("msg").textContent = t("importOk");
    await render();
    await renderMissing();
    await updateActivity();
    await updateBadge();
  } catch {
    showToast(t("importBad"));
    $("msg").textContent = t("importBad");
  } finally {
    $("importFile").value = "";
  }
};

document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
  $("lib").classList.toggle("hidden", b.dataset.tab !== "lib");
  $("miss").classList.toggle("hidden", b.dataset.tab !== "miss");
});

$("onboardingDone").onclick = async () => {
  await set({ onboardingSeen: true });
  $("onboarding").close();
};

(async () => {
  const s = await get(["language", "theme", "onboardingSeen"]);
  lang = s.language || "es";
  theme = s.theme || "neon";
  $("lang").value = lang;
  labels();
  applyTheme();
  await render();
  await renderMissing();
  await updateActivity();
  await updateBadge();
  if (!s.onboardingSeen) $("onboarding").showModal();
})();
