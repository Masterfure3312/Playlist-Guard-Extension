const ALARM = "pg-auto";
const get = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const set = (o) => new Promise((r) => chrome.storage.local.set(o, r));
const sk = (id) => `playlist:${id}`;
const ik = (i) => i.videoId || `missing:${i.index || ""}:${i.title}`;
const ms = (m) => Number(m) * 60000;

function text(v) {
  if (!v) return "";
  if (typeof v.simpleText === "string") return v.simpleText;
  return Array.isArray(v.runs) ? v.runs.map((x) => x.text || "").join("") : "";
}
function thumbList(obj) {
  return obj?.thumbnail?.thumbnails || [];
}
function biggestThumb(obj) {
  const arr = thumbList(obj);
  return arr.length ? arr[arr.length - 1].url : null;
}
function balanced(src, pos) {
  const s = src.indexOf("{", pos);
  if (s < 0) return null;
  let d = 0, str = false, esc = false;
  for (let i = s; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') str = false;
    } else {
      if (c === '"') str = true;
      else if (c === "{") d++;
      else if (c === "}" && !--d) return src.slice(s, i + 1);
    }
  }
  return null;
}
function initialData(html) {
  const m = /\bytInitialData\s*=/.exec(html);
  if (!m) return null;
  const raw = balanced(html, m.index);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function cfg(html) {
  return {
    apiKey: html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1],
    clientVersion: html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]
  };
}
function item(r) {
  if (!r) return null;
  const videoId = r.videoId || null;
  const title = text(r.title) || "(sin título)";
  return {
    videoId,
    title,
    channel: text(r.shortBylineText) || text(r.longBylineText) || null,
    index: text(r.index) || null,
    unavailable: r.isPlayable === false || /private|deleted|unavailable|privado|eliminado|no disponible/i.test(title),
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    thumbnail: biggestThumb(r)
  };
}
function branches(data) {
  const out = [];
  function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o.playlistVideoListRenderer?.contents)) out.push(o.playlistVideoListRenderer.contents);
    const c = o.appendContinuationItemsAction?.continuationItems || o.reloadContinuationItemsCommand?.continuationItems;
    if (Array.isArray(c)) out.push(c);
    if (Array.isArray(o)) for (const x of o) walk(x);
    else for (const v of Object.values(o)) walk(v);
  }
  walk(data);
  return out;
}
function collect(data) {
  const items = [], tokens = [];
  for (const b of branches(data)) {
    for (const e of b) {
      if (e?.playlistVideoRenderer) {
        const x = item(e.playlistVideoRenderer);
        if (x) items.push(x);
      }
      const t = e?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (t) tokens.push(t);
    }
  }
  return { items, tokens };
}
function playlistTitle(data) {
  let out = "";
  function walk(o) {
    if (out || !o || typeof o !== "object") return;
    if (o.playlistMetadataRenderer?.title) out = o.playlistMetadataRenderer.title;
    if (Array.isArray(o)) for (const x of o) walk(x);
    else for (const v of Object.values(o)) walk(v);
  }
  walk(data);
  return out || "Playlist";
}
function playlistThumb(data, items) {
  let found = null;
  function walk(o) {
    if (found || !o || typeof o !== "object") return;
    if (o.heroPlaylistThumbnailRenderer?.thumbnail) found = biggestThumb(o.heroPlaylistThumbnailRenderer);
    else if (o.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail) found = biggestThumb(o.playlistHeaderBanner.heroPlaylistThumbnailRenderer);
    else if (o.playlistSidebarPrimaryInfoRenderer?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail) {
      found = biggestThumb(o.playlistSidebarPrimaryInfoRenderer.thumbnailRenderer.playlistVideoThumbnailRenderer);
    }
    if (Array.isArray(o)) for (const x of o) walk(x);
    else for (const v of Object.values(o)) walk(v);
  }
  walk(data);
  if (found) return found;
  return (items || []).find((x) => x.thumbnail)?.thumbnail || null;
}
async function continuation(token, c) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(c.apiKey)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: c.clientVersion, hl: "en", gl: "US" } }, continuation: token })
  });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  return r.json();
}
async function snapshot(id, url) {
  const target = `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;
  const r = await fetch(target, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  const html = await r.text();
  const data = initialData(html);
  const c = cfg(html);
  if (!data || !c.apiKey || !c.clientVersion) throw new Error("No se pudieron leer los datos de la playlist.");

  const all = [];
  const first = collect(data);
  all.push(...first.items);

  let token = first.tokens[0] || null;
  const seen = new Set();
  while (token && !seen.has(token) && seen.size < 120) {
    seen.add(token);
    const d = await continuation(token, c);
    const part = collect(d);
    all.push(...part.items);
    token = part.tokens.find((x) => !seen.has(x)) || null;
  }

  const dedup = new Map();
  for (const x of all) {
    const k = ik(x);
    if (!dedup.has(k)) dedup.set(k, x);
  }
  const items = [...dedup.values()];
  if (!items.length) throw new Error("La playlist no devolvió videos.");

  return {
    playlistId: id,
    title: playlistTitle(data),
    sourceUrl: url || target,
    playlistThumbnail: playlistThumb(data, items),
    capturedAt: new Date().toISOString(),
    items
  };
}
function migrate(p) {
  const known = { ...(p.knownItems || {}) };
  if (!Object.keys(known).length) for (const x of (p.items || [])) known[ik(x)] = x;
  return {
    ...p,
    knownItems: known,
    playlistThumbnail: p.playlistThumbnail || (p.items || []).find((x) => x.thumbnail)?.thumbnail || null,
    missingNow: p.missingNow || [],
    eventHistory: p.eventHistory || [],
    autoIntervalMinutes: p.autoIntervalMinutes ?? 360,
    nextAutoAt: p.nextAutoAt ?? Date.now() + ms(p.autoIntervalMinutes ?? 360)
  };
}
async function apply(old0, cur, mode) {
  const old = migrate(old0), prev = old.items || [];
  if (prev.length >= 20 && cur.items.length < Math.floor(prev.length * .85)) {
    const u = {
      ...old,
      lastCheckAt: cur.capturedAt,
      lastCheckStatus: "incomplete",
      history: [...(old.history || []), { checkedAt: cur.capturedAt, mode, status: "incomplete", received: cur.items.length }].slice(-120)
    };
    if (mode === "auto" && u.autoIntervalMinutes > 0) u.nextAutoAt = Date.now() + ms(u.autoIntervalMinutes);
    await set({ [sk(old.playlistId)]: u });
    return { incomplete: true };
  }

  const prevMap = new Map(prev.map((x) => [ik(x), x]));
  const newMap = new Map(cur.items.map((x) => [ik(x), x]));
  const missingPrev = new Map((old.missingNow || []).map((x) => [ik(x), x]));
  const known = { ...old.knownItems };
  const added = [], missing = [], restored = [];

  for (const [k, x] of newMap) { if (!known[k]) added.push(x); known[k] = x; }
  for (const [k, x] of prevMap) if (!newMap.has(k) && !missingPrev.has(k)) missing.push(x);
  for (const [k, x] of missingPrev) if (newMap.has(k)) restored.push(newMap.get(k));

  const missingNow = new Map(missingPrev);
  missing.forEach((x) => missingNow.set(ik(x), x));
  restored.forEach((x) => missingNow.delete(ik(x)));

  const at = cur.capturedAt;
  const events = [];
  missing.forEach((x) => events.push({ type: "missing", at, item: x }));
  restored.forEach((x) => events.push({ type: "restored", at, item: x }));
  added.forEach((x) => events.push({ type: "added", at, item: x }));

  const u = {
    ...old,
    title: cur.title,
    sourceUrl: cur.sourceUrl,
    playlistThumbnail: cur.playlistThumbnail || old.playlistThumbnail || (cur.items || []).find((x) => x.thumbnail)?.thumbnail || null,
    items: cur.items,
    knownItems: known,
    missingNow: [...missingNow.values()],
    updatedAt: at,
    lastCheckAt: at,
    lastSuccessfulCheckAt: at,
    lastCheckStatus: "ok",
    lastChanges: { missing, restored, added },
    history: [...(old.history || []), {
      checkedAt: at, mode, status: "ok", count: cur.items.length,
      missing: missing.map((x) => ({ videoId: x.videoId, title: x.title, channel: x.channel })),
      restored: restored.map((x) => ({ videoId: x.videoId, title: x.title, channel: x.channel })),
      added: added.map((x) => ({ videoId: x.videoId, title: x.title, channel: x.channel }))
    }].slice(-120),
    eventHistory: [...(old.eventHistory || []), ...events].slice(-300)
  };
  if (mode === "auto" && u.autoIntervalMinutes > 0) u.nextAutoAt = Date.now() + ms(u.autoIntervalMinutes);
  await set({ [sk(old.playlistId)]: u });
  return { missing, restored, added };
}
async function check(id, mode = "manual") {
  const d = await get([sk(id)]);
  const p = d[sk(id)];
  if (!p) throw new Error("Playlist no protegida.");
  return apply(p, await snapshot(id, p.sourceUrl), mode);
}
async function due() {
  const all = await get(null), now = Date.now();
  for (const [k, p0] of Object.entries(all)) {
    if (!k.startsWith("playlist:") || !p0?.playlistId) continue;
    const p = migrate(p0);
    if (p.autoIntervalMinutes <= 0 || !p.nextAutoAt || p.nextAutoAt > now) continue;
    try { await check(p.playlistId, "auto"); }
    catch { await set({ [k]: { ...p, lastCheckStatus: "error", nextAutoAt: now + 900000 } }); }
  }
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(ALARM, { periodInMinutes: 15 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(ALARM, { periodInMinutes: 15 }));
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) due(); });

chrome.runtime.onMessage.addListener((m, s, reply) => {
  if (m?.type === "CHECK") { check(m.id, "manual").then((x) => reply({ ok: true, data: x })).catch((e) => reply({ ok: false, error: e.message })); return true; }
  if (m?.type === "FETCH") { snapshot(m.id, m.url).then((x) => reply({ ok: true, data: x })).catch((e) => reply({ ok: false, error: e.message })); return true; }
});

async function updateActionBadge() {
  try {
    const all = await get(null);
    let total = 0;
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("playlist:") && v?.playlistId) total += (v.missingNow || []).length;
    }
    chrome.action.setBadgeText({ text: total ? String(Math.min(total, 99)) : "" });
    if (total) chrome.action.setBadgeBackgroundColor({ color: "#ff477e" });
  } catch {}
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && Object.keys(changes).some((k) => k.startsWith("playlist:"))) updateActionBadge();
});
chrome.runtime.onInstalled.addListener(updateActionBadge);
chrome.runtime.onStartup.addListener(updateActionBadge);
