/* =========================================================
   LINK/PAD — 液タブ型ポートフォリオ
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const screen = $("#screen"), viewport = $("#viewport"), stage = $("#stage"),
        paper = $("#paper"), art = $("#artwork"), video = $("#video"),
        ghostPrev = $("#ghostPrev"), ghostNext = $("#ghostNext"),
        ink = $("#ink"), ctx = ink.getContext("2d"),
        cursor = $("#cursor"), hint = $("#hint");

  const BY_ID = Object.fromEntries(WORKS.map((w) => [w.id, w]));
  const META_OF = (w) => (typeof META !== "undefined" && META[w.id]) || {};
  const ASSET = (w) => `${w.id}.${w.type === "anim" ? "mp4" : "webp"}`;
  const POSTER = (w) => `${w.id}_poster.webp`;
  const THUMB = (w) => `${w.id}_thumb.webp`;
  const TOOL_NAME = { pen: "ペン", eraser: "消しゴム", picker: "スポイト", hand: "手のひら", zoom: "ズーム" };

  /* ---------------- 並び順（ドラッグで入れ替え・保存） ---------------- */
  const defaultOrder = () => {
    return sanitize(typeof ORDER !== "undefined" && ORDER.length ? ORDER : WORKS.map((w) => w.id));
  };
  // 重複・存在しないid・抜けを取り除いて、必ず全作品を1回ずつにする
  const sanitize = (list) => {
    const o = [...new Set((list || []).filter((id) => BY_ID[id]))];
    WORKS.forEach((w) => { if (!o.includes(w.id)) o.push(w.id); });
    return o;
  };
  // works.js の ORDER を書き換えたら、閲覧者のブラウザに保存された古い並び順はリセットする
  const ORDER_KEY = "linkpad-order:" + JSON.stringify(typeof ORDER !== "undefined" ? ORDER : []);
  let order = (() => {
    const saved = store.get("linkpad-order");
    return saved && saved.key === ORDER_KEY && Array.isArray(saved.order) ? sanitize(saved.order) : defaultOrder();
  })();
  const saveOrder = () => store.set("linkpad-order", { key: ORDER_KEY, order });

  const S = {
    id: order[0], s: 1, rot: 0, tx: 0, ty: 0, w: 1, h: 1,
    tool: "pen", space: false,
    size: 8, keep: false, flip: false, mono: false,
    strokes: [], cur: null, pressure: 0, undo: [],
    isAnim: false, fps: 24, frames: 1, onion: false,
    mtool: "view", fitS: 1,
  };
  const idx = () => order.indexOf(S.id);

  /* ---------------- 変換 ---------------- */
  const rad = (d) => (d * Math.PI) / 180;
  function apply(anim = false) {
    stage.classList.toggle("anim", anim);
    stage.style.transform = `translate(${S.tx}px, ${S.ty}px) rotate(${S.rot}deg) scale(${S.s})`;
    $("#stZoom").textContent = `${Math.round(S.s * 100)}%`;
    $("#stRot").textContent = `${((S.rot % 360) + 360) % 360}°`;
    updateNav();
  }
  function vpCenter() { const r = viewport.getBoundingClientRect(); return { r, cx: r.width / 2, cy: r.height / 2 }; }
  function toLocal(px, py) {
    const { cx, cy } = vpCenter();
    const x = (px - cx - S.tx) / S.s, y = (py - cy - S.ty) / S.s;
    const a = -rad(S.rot), c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  const mobileUI = matchMedia("(orientation: portrait), (max-width: 820px), (max-height: 540px)");
  function fit(anim = true) {
    const { r } = vpCenter();
    const a = rad(S.rot), c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const bw = S.w * c + S.h * s, bh = S.w * s + S.h * c;
    if (mobileUI.matches) {
      // スマホ：上はカラーパレット、下はタイムラインの分だけ空けて、作品と重ならないようにする
      const top = 46, bottom = (S.isAnim ? 52 : 0) + 56; // 下：タイムライン + タッチ用ツール
      S.s = Math.min((r.width * 0.94) / bw, ((r.height - top - bottom) * 0.96) / bh);
      S.tx = 0; S.ty = (top - bottom) / 2;
    } else {
      const padX = 0.86, padY = S.isAnim ? 0.74 : padX; // タイムラインの分だけ余白
      S.s = Math.min((r.width * padX) / bw, (r.height * padY) / bh);
      S.tx = 0; S.ty = S.isAnim ? -r.height * 0.05 : 0;
    }
    S.fitS = S.s;
    apply(anim);
  }
  function zoomAt(px, py, factor, anim = false) {
    const { cx, cy } = vpCenter();
    const ns = Math.min(Math.max(S.s * factor, 0.05), 12);
    const k = ns / S.s, ox = px - cx, oy = py - cy;
    S.tx = ox - k * (ox - S.tx); S.ty = oy - k * (oy - S.ty); S.s = ns;
    apply(anim);
  }
  function rotate(d) { S.rot += d; apply(true); }

  /* ---------------- ナビゲーター ---------------- */
  function updateNav() {
    const nav = $("#navImg"), box = $("#navBox");
    if (!nav.naturalWidth || !nav.clientWidth) return;
    const { r } = vpCenter();
    const pts = [[0, 0], [r.width, 0], [0, r.height], [r.width, r.height]].map(([x, y]) => toLocal(x, y));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const k = nav.clientWidth / S.w;
    const L = Math.max(Math.min(...xs) + S.w / 2, 0) * k, T = Math.max(Math.min(...ys) + S.h / 2, 0) * k;
    const R = Math.min(Math.max(...xs) + S.w / 2, S.w) * k, B = Math.min(Math.max(...ys) + S.h / 2, S.h) * k;
    Object.assign(box.style, { left: nav.offsetLeft + L + "px", top: nav.offsetTop + T + "px", width: Math.max(R - L, 0) + "px", height: Math.max(B - T, 0) + "px" });
  }

  /* ---------------- レイヤー一覧 ---------------- */
  const layersEl = $("#layers");
  function renderLayers() {
    layersEl.innerHTML = order.map((id, i) => {
      const w = BY_ID[id];
      return `<li class="layer${id === S.id ? " is-on" : ""}" data-id="${id}" tabindex="0">
        <span class="grip" title="ドラッグで並べ替え">⋮⋮</span>
        <span class="th" style="background-image:url('${THUMB(w)}')"></span>
        <span class="nm"><b>${esc(w.title)}</b><i>${w.type === "anim" ? "ANIM" : "STILL"} · ${esc(w.cat)}</i></span>
        <span class="no">${String(i + 1).padStart(2, "0")}</span>
      </li>`;
    }).join("");
    $("#count").textContent = order.length;
    updateIndexLabel();
  }
  function updateIndexLabel() {
    $("#stIndex").textContent = `${String(idx() + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}`;
  }
  layersEl.addEventListener("click", (e) => {
    if (dragL && dragL.moved) return;
    const li = e.target.closest(".layer"); if (li) show(li.dataset.id);
  });
  layersEl.addEventListener("keydown", (e) => {
    const li = e.target.closest(".layer"); if (!li) return;
    if (e.key === "Enter") show(li.dataset.id);
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); moveLayer(li.dataset.id, e.key === "ArrowUp" ? -1 : 1); }
  });

  // ドラッグで入れ替え（PC・ペン：行をそのままドラッグ / スマホ：長押ししてからドラッグ）
  let dragL = null;
  layersEl.addEventListener("dragstart", (e) => e.preventDefault()); // ブラウザ標準のドラッグ（ゴースト表示）を止める
  layersEl.addEventListener("pointerdown", (e) => {
    const li = e.target.closest(".layer"); if (!li || e.button > 0) return;
    const touch = e.pointerType === "touch";
    if (!touch) e.preventDefault(); // 文字選択を防ぐ
    dragL = { li, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId, armed: false, touch };
    if (touch) dragL.timer = setTimeout(() => { if (dragL && !dragL.cancel) armDrag(); }, 380);
  });
  function armDrag() {
    dragL.armed = true;
    dragL.li.classList.add("dragging");
    layersEl.classList.add("sorting");
    try { dragL.li.setPointerCapture(dragL.pid); } catch (_) {}
    navigator.vibrate?.(15);
  }
  layersEl.addEventListener("touchmove", (e) => { if (dragL?.armed) e.preventDefault(); }, { passive: false });
  window.addEventListener("pointermove", (e) => {
    if (!dragL || e.pointerId !== dragL.pid) return;
    const dist = Math.hypot(e.clientX - dragL.x, e.clientY - dragL.y);
    if (!dragL.armed) {
      if (dragL.touch) { if (dist > 8) { clearTimeout(dragL.timer); dragL = null; } return; } // スクロール扱い
      if (dist < 6) return;
      armDrag();
    }
    dragL.moved = true;
    const cs = getComputedStyle(layersEl), horizontal = cs.display === "flex" && cs.flexDirection === "row";
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".layer");
    if (over && over !== dragL.li && over.parentNode === layersEl) {
      const r = over.getBoundingClientRect();
      const after = horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      const ref = after ? over.nextElementSibling : over;
      if (ref !== dragL.li && dragL.li.nextElementSibling !== ref) layersEl.insertBefore(dragL.li, ref);
    }
    const lr = layersEl.getBoundingClientRect();
    if (horizontal) { if (e.clientX < lr.left + 30) layersEl.scrollLeft -= 10; if (e.clientX > lr.right - 30) layersEl.scrollLeft += 10; }
    else { if (e.clientY < lr.top + 30) layersEl.scrollTop -= 10; if (e.clientY > lr.bottom - 30) layersEl.scrollTop += 10; }
  });
  const endLayerDrag = (e) => {
    if (!dragL || e.pointerId !== dragL.pid) return;
    clearTimeout(dragL.timer);
    const d = dragL;
    d.li.classList.remove("dragging");
    layersEl.classList.remove("sorting");
    if (d.moved) {
      order = sanitize($$(".layer", layersEl).map((li) => li.dataset.id));
      saveOrder(); renderLayers(); toast("並び順を変更しました");
    }
    setTimeout(() => (dragL = null), 0);
  };
  window.addEventListener("pointerup", endLayerDrag);
  window.addEventListener("pointercancel", endLayerDrag);
  function moveLayer(id, dir) {
    const i = order.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    saveOrder(); renderLayers();
    const li = $(`.layer[data-id="${id}"]`); li?.focus({ preventScroll: true }); li?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /* ---------------- 作品を開く ---------------- */
  let loadToken = 0;
  function show(id, first = false) {
    const w = BY_ID[id]; if (!w) return;
    S.id = id;
    const m = META_OF(w), token = ++loadToken;
    S.isAnim = w.type === "anim";
    if (!first) SFX.play("window");

    $$(".layer").forEach((li) => li.classList.toggle("is-on", li.dataset.id === id));
    $(`.layer[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: first ? "auto" : "smooth" });
    updateIndexLabel();
    $("#filename").textContent = `${w.id}.${S.isAnim ? "mp4" : "lnk"}`;
    document.title = `${w.title} — 矢野 乃梨佳 Portfolio`;
    renderInfo(w, m);

    const done = (W, H, navSrc) => {
      if (token !== loadToken) return;
      S.w = W; S.h = H; S.rot = 0;
      $("#navImg").src = navSrc;
      setBackdrop(THUMB(w));
      S.strokes = []; S.undo = [];
      paper.classList.toggle("is-anim", S.isAnim);
      paper.classList.remove("reveal"); void paper.offsetWidth; paper.classList.add("reveal");
      $("#timeline").hidden = !S.isAnim;
      viewport.classList.toggle("has-timeline", S.isAnim);
      fit(!first);
      if (booted) openInfo();
    };

    if (!S.isAnim) {
      stopVideo();
      const img = new Image();
      img.onload = () => {
        if (token !== loadToken) return;
        art.src = img.src; art.width = img.naturalWidth; art.height = img.naturalHeight;
        done(img.naturalWidth, img.naturalHeight, img.src);
      };
      img.src = ASSET(w);
    } else {
      S.fps = m.fps || 24; S.frames = m.frames || 1;
      buildTicks();
      const src = ASSET(w);
      video.poster = POSTER(w);
      video.onloadedmetadata = () => {
        if (token !== loadToken) return;
        video.width = video.videoWidth; video.height = video.videoHeight;
        [ghostPrev, ghostNext].forEach((g) => { g.width = video.videoWidth; g.height = video.videoHeight; });
        video.playbackRate = currentSpeed;
        done(video.videoWidth, video.videoHeight, POSTER(w));
        video.play().catch(() => {});
        updatePlayBtn();
      };
      video.src = src; ghostPrev.src = src; ghostNext.src = src;
    }
  }
  function stopVideo() {
    video.onloadedmetadata = null;
    video.pause(); video.removeAttribute("src"); video.removeAttribute("poster"); video.load();
    [ghostPrev, ghostNext].forEach((g) => { g.removeAttribute("src"); g.load(); });
  }

  /* ---------------- 作品情報（カード + パネル） ---------------- */
  function infoRows(w, m) {
    const res = m.orig ? `${m.orig[0]} × ${m.orig[1]} px` : "";
    const dur = w.type === "anim" && m.frames ? `${m.frames}コマ · ${m.fps}fps · ${(m.frames / m.fps).toFixed(1)}秒` : "";
    return [
      ["制作年", w.year], ["楽曲", w.song], ["担当", w.role], ["ツール", w.tool],
      ["制作期間", w.time], ["サイズ", res], ["尺", dur],
    ].filter(([, v]) => v);
  }
  const paletteHTML = (m) => (m.palette || []).map((c) => `<button class="chip" style="--c:${c}" data-color="${c}" title="${c} をペンの色に"></button>`).join("");
  function renderInfo(w, m) {
    const rows = infoRows(w, m);
    $("#infoKicker").textContent = `OPEN · ${String(idx() + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}`;
    $("#infoTitle").textContent = w.title;
    $("#infoCat").textContent = w.cat;
    $("#infoMeta").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
    $("#infoDesc").innerHTML = w.desc ? esc(w.desc).replace(/\n/g, "<br>") : "";
    $("#infoDesc").hidden = !w.desc;
    $("#infoTags").innerHTML = (w.tags || []).map((t) => `<li>#${esc(t)}</li>`).join("");
    $("#infoPalette").innerHTML = paletteHTML(m);

    $("#props").innerHTML = [`<dt>名前</dt><dd class="title">${esc(w.title)}</dd>`, `<dt>種別</dt><dd>${esc(w.cat)}</dd>`]
      .concat(rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`))
      .concat(w.desc ? [`<dd class="desc">${esc(w.desc).replace(/\n/g, "<br>")}</dd>`] : []).join("");
    $("#palette").innerHTML = paletteHTML(m);
  }
  let infoTimer = 0;
  function openInfo() {
    const card = $("#infoCard");
    card.classList.remove("closed", "in"); void card.offsetWidth; card.classList.add("in");
    $("#infoPill").hidden = true;
    clearTimeout(infoTimer);
    infoTimer = setTimeout(closeInfo, 9000);
  }
  function closeInfo() {
    clearTimeout(infoTimer);
    if (mobileUI.matches) return; // スマホはカラーパレットだけを常に表示
    $("#infoCard").classList.add("closed");
    $("#infoPill").hidden = false;
  }
  const toggleInfo = () => ($("#infoCard").classList.contains("closed") ? openInfo() : closeInfo());
  $("#infoClose").addEventListener("click", closeInfo);
  $("#infoPill").addEventListener("click", openInfo);
  $("#infoCard").addEventListener("pointerenter", () => clearTimeout(infoTimer));

  /* ---------------- 背景：閲覧中の作品をぼかして映す ---------------- */
  let bdFlip = 0;
  function setBackdrop(src) {
    const layers = $$(".backdrop i");
    bdFlip ^= 1;
    layers[bdFlip].style.backgroundImage = `url('${src}')`;
    layers[bdFlip].classList.add("on"); layers[bdFlip ^ 1].classList.remove("on");
  }

  /* ---------------- タイムライン（アニメ） ---------------- */
  let currentSpeed = 1;
  const frameOf = (t) => Math.min(Math.floor(t * S.fps + 1e-3), S.frames - 1);
  const timeOf = (f) => ((((f % S.frames) + S.frames) % S.frames) + 0.5) / S.fps;
  function buildTicks() {
    const n = S.frames, step = n > 60 ? 5 : 1;
    let html = "";
    for (let i = 0; i < n; i += step) html += `<i style="left:${(i / n) * 100}%" class="${i % (step * 5) === 0 ? "major" : ""}"></i>`;
    $("#tlTicks").innerHTML = html;
  }
  function updateTimeline() {
    if (!S.isAnim || !video.duration) return;
    const f = frameOf(video.currentTime);
    $("#tlHead").style.left = `${((f + 0.5) / S.frames) * 100}%`;
    $("#tlFrame").textContent = `${f + 1} / ${S.frames}`;
  }
  function updatePlayBtn() { $("#tlPlay").textContent = video.paused ? "▶" : "❚❚"; updateOnion(); }
  function togglePlay() { if (!S.isAnim) return; video.paused ? video.play() : video.pause(); }
  function stepFrame(d) { if (!S.isAnim) return; video.pause(); video.currentTime = timeOf(frameOf(video.currentTime) + d); }
  function updateOnion() {
    const on = S.isAnim && S.onion && video.paused;
    paper.classList.toggle("onion", on);
    $("#tlOnion").classList.toggle("is-on", S.onion);
    if (on) {
      const f = frameOf(video.currentTime);
      ghostPrev.currentTime = timeOf(f - 1);
      ghostNext.currentTime = timeOf(f + 1);
    }
  }
  video.addEventListener("play", updatePlayBtn);
  video.addEventListener("pause", updatePlayBtn);
  video.addEventListener("seeked", () => { updateTimeline(); updateOnion(); });
  const track = $("#tlTrack");
  let scrub = false;
  const scrubTo = (e) => { const r = track.getBoundingClientRect(); const f = Math.floor(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.9999) * S.frames); video.currentTime = timeOf(f); };
  track.addEventListener("pointerdown", (e) => { scrub = true; track.setPointerCapture(e.pointerId); video.pause(); scrubTo(e); });
  track.addEventListener("pointermove", (e) => scrub && scrubTo(e));
  track.addEventListener("pointerup", () => (scrub = false));
  function toggleOnion() {
    S.onion = !S.onion;
    if (S.onion && !video.paused) video.pause();
    updateOnion();
    toast(S.onion ? "オニオンスキン：前のコマ＝水色／次のコマ＝赤" : "オニオンスキン オフ");
  }
  $("#timeline").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tl === "play") togglePlay();
    if (b.dataset.tl === "back") stepFrame(-1);
    if (b.dataset.tl === "fwd") stepFrame(1);
    if (b.dataset.tl === "onion") toggleOnion();
    if (b.dataset.speed) {
      currentSpeed = +b.dataset.speed; video.playbackRate = currentSpeed;
      $$("[data-speed]").forEach((x) => x.classList.toggle("is-on", x === b));
    }
  });

  /* ---------------- ペン・消しゴム ---------------- */
  const LIFE = 4200, FADE = 1600;
  function resizeInk() { const { r } = vpCenter(), d = window.devicePixelRatio || 1; ink.width = r.width * d; ink.height = r.height * d; }
  const snapshot = () => S.strokes.map((st) => ({ ...st, pts: st.pts.slice() }));
  function pushUndo() { S.undo.push(snapshot()); if (S.undo.length > 60) S.undo.shift(); }
  function undo() {
    if (!S.undo.length) { toast("これ以上戻れません"); return; }
    const now = performance.now();
    S.strokes = S.undo.pop().map((st) => ({ ...st, end: now }));
  }
  function clearInk() { if (S.strokes.length) { pushUndo(); S.strokes = []; toast("線をすべて消しました（Ctrl+Zで戻せます）"); } }

  function eraseAt(l) {
    const r = Math.max(S.size * 1.4, 10) / S.s, r2 = r * r;
    const out = [];
    let changed = false;
    for (const st of S.strokes) {
      let seg = [];
      for (const p of st.pts) {
        if ((p.x - l.x) ** 2 + (p.y - l.y) ** 2 < r2) { changed = true; if (seg.length > 1) out.push({ ...st, pts: seg }); seg = []; }
        else seg.push(p);
      }
      if (seg.length > 1 || (seg.length === 1 && st.pts.length === 1)) out.push(seg.length === st.pts.length ? st : { ...st, pts: seg });
    }
    if (changed) S.strokes = out;
  }

  function draw() {
    const now = performance.now();
    const { cx, cy } = vpCenter(), d = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ink.width, ink.height);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.translate(cx + S.tx, cy + S.ty); ctx.rotate(rad(S.rot)); ctx.scale(S.s, S.s);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (!S.keep) S.strokes = S.strokes.filter((st) => st === S.cur || now - st.end < LIFE + FADE);
    for (const st of S.strokes) {
      const age = st === S.cur || S.keep ? 0 : now - st.end;
      ctx.globalAlpha = Math.max(age < LIFE ? 1 : 1 - (age - LIFE) / FADE, 0);
      ctx.strokeStyle = st.color; ctx.fillStyle = st.color;
      const p = st.pts;
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, p[0].w / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      for (let i = 1; i < p.length; i++) {
        ctx.lineWidth = (p[i - 1].w + p[i].w) / 2;
        ctx.beginPath(); ctx.moveTo(p[i - 1].x, p[i - 1].y); ctx.lineTo(p[i].x, p[i].y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (!S.cur) S.pressure *= 0.9;
    $("#stPress").style.width = `${Math.min(S.pressure, 1) * 100}%`;
    updateTimeline();
    requestAnimationFrame(draw);
  }
  function pressureOf(e, last) {
    if (e.pointerType === "pen" && e.pressure > 0) return e.pressure;
    if (!last) return 0.5;
    const v = Math.hypot(e.clientX - last.cx, e.clientY - last.cy) / Math.max(e.timeStamp - last.t, 1);
    return Math.min(Math.max(1 - v / 2.2, 0.15), 1);
  }
  const widthOf = (pr) => (S.size * (0.25 + pr * 0.75)) / S.s; // 画面上の太さをキャンバス座標に換算

  /* ---------------- スポイト ---------------- */
  const pickCanvas = document.createElement("canvas"); pickCanvas.width = pickCanvas.height = 1;
  const pctx = pickCanvas.getContext("2d", { willReadFrequently: true });
  function pickAt(p) {
    const l = toLocal(p.x, p.y);
    let x = l.x + S.w / 2; const y = l.y + S.h / 2;
    if (S.flip) x = S.w - x;
    if (x < 0 || y < 0 || x >= S.w || y >= S.h) return;
    try {
      pctx.clearRect(0, 0, 1, 1);
      pctx.drawImage(S.isAnim ? video : art, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
      const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
      setColor("#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join(""), true);
    } catch (_) {
      toast("スポイトは Live Server などで開くと使えます");
    }
  }
  function setColor(c, quiet) {
    $("#penColor").value = c;
    syncMobileColor();
    if (mobileUI.matches && S.mtool !== "pen") setMTool("pen"); // スマホ：色をタップしたら描くモードに
    $$(".chip").forEach((ch) => ch.classList.toggle("is-on", ch.dataset.color === c));
    updateSizeDot();
    if (!quiet) toast(`ペンの色：${c}`);
  }

  /* ---------------- ポインタ操作 ---------------- */
  const pointers = new Map();
  let drag = null, pinch = null, erasing = false;
  function vpPoint(e) { const r = viewport.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function effectiveTool(e) {
    if (S.space || e.button === 1) return "hand";
    if (e.pointerType === "touch") return S.mtool === "view" ? "hand" : S.mtool;
    if (e.altKey && S.tool === "pen") return "picker";
    return S.tool;
  }

  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".info-card, .info-pill, .timeline, .toast")) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, vpPoint(e));
    dismissHint();
    if (!$("#infoCard").classList.contains("closed")) closeInfo();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      // 1本目の指で描き始めた線・消した線はなかったことにする（2本指は移動・拡大）
      if (S.cur || erasing) { const prev = S.undo.pop(); if (prev) S.strokes = prev; }
      drag = null; S.cur = null; erasing = false; tapInfo = null; return;
    }
    const p = vpPoint(e), tool = effectiveTool(e);
    if (tool === "zoom") { zoomAt(p.x, p.y, e.altKey ? 1 / 1.6 : 1.6, true); return; }
    if (tool === "picker") { pickAt(p); drag = { picking: true, back: S.tool === "picker" }; return; }
    if (tool === "hand") {
      drag = { x: p.x, y: p.y, tx: S.tx, ty: S.ty, touch: e.pointerType === "touch", t: performance.now(), atFit: S.s <= S.fitS * 1.06 };
      cursor.classList.add("down"); return;
    }
    if (tool === "eraser") { pushUndo(); erasing = true; eraseAt(toLocal(p.x, p.y)); cursor.classList.add("down"); return; }
    if (tool === "pen") {
      pushUndo();
      const l = toLocal(p.x, p.y), pr = pressureOf(e, null);
      S.cur = { color: $("#penColor").value, pts: [{ ...l, w: widthOf(pr) }], end: 0, last: { cx: e.clientX, cy: e.clientY, t: e.timeStamp, pr } };
      S.strokes.push(S.cur); S.pressure = pr;
      cursor.classList.add("down");
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    const p = vpPoint(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    const l = toLocal(p.x, p.y);
    $("#stPos").textContent = `x ${Math.round(l.x + S.w / 2)}  y ${Math.round(l.y + S.h / 2)}`;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      S.tx += mx - pinch.mx; S.ty += my - pinch.my;
      zoomAt(mx, my, d / pinch.d);
      pinch = { d, mx, my }; return;
    }
    if (drag?.picking) { if (pointers.size) pickAt(p); return; }
    if (drag) { S.tx = drag.tx + p.x - drag.x; S.ty = drag.ty + p.y - drag.y; apply(); return; }
    const evs = e.getCoalescedEvents?.() || [e];
    if (erasing) { for (const ev of evs) { const q = vpPoint(ev); eraseAt(toLocal(q.x, q.y)); } S.pressure = 0.6; return; }
    if (S.cur) {
      for (const ev of evs) {
        const q = vpPoint(ev), ll = toLocal(q.x, q.y);
        const pr = S.cur.last.pr * 0.7 + pressureOf(ev, S.cur.last) * 0.3;
        S.cur.pts.push({ ...ll, w: widthOf(pr) });
        S.cur.last = { cx: ev.clientX, cy: ev.clientY, t: ev.timeStamp, pr };
        S.pressure = pr;
      }
    }
  });
  let tapInfo = null;
  function endPointer(e) {
    if (drag && drag.touch && !pinch && e.type === "pointerup") {
      const p = vpPoint(e), dx = p.x - drag.x, dy = p.y - drag.y, dt = performance.now() - drag.t;
      const swipe = drag.atFit && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 700;
      if (swipe) { drag = null; dx < 0 ? ACTS.next() : ACTS.prev(); }
      else if (Math.hypot(dx, dy) < 10 && dt < 280) {
        // ダブルタップ：ズーム / 元に戻す
        const now = performance.now();
        if (tapInfo && now - tapInfo.t < 320 && Math.hypot(p.x - tapInfo.x, p.y - tapInfo.y) < 30) {
          tapInfo = null;
          if (S.s > S.fitS * 1.1) { S.rot = 0; fit(true); } else zoomAt(p.x, p.y, 2.4, true);
        } else tapInfo = { t: now, x: p.x, y: p.y };
      } else if (drag.atFit && Math.abs(dx) > 10) { fit(true); } // 拡大していない時は元の位置に戻す
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (S.cur) { S.cur.end = performance.now(); delete S.cur.last; S.cur = null; }
    if (drag?.picking && drag.back) { setTool("pen"); toast(`ペンの色：${$("#penColor").value}`); }
    drag = null; erasing = false; cursor.classList.remove("down");
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  viewport.addEventListener("wheel", (e) => {
    if (e.target.closest(".info-card, .timeline")) return;
    e.preventDefault(); dismissHint();
    const p = vpPoint(e);
    if (e.shiftKey && !e.ctrlKey) { rotate(e.deltaY > 0 ? 15 : -15); return; }
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  /* ---------------- タッチリング ---------------- */
  const ring = $("#ring"), ringDot = $("#ringDot");
  let ringAng = 0, ringDrag = null;
  const angleOf = (e) => { const r = ring.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  const turnRing = (d) => { ringAng += d; ringDot.style.transform = `rotate(${ringAng}rad)`; const { cx, cy } = vpCenter(); zoomAt(cx, cy, Math.exp(d * 0.6)); };
  ring.addEventListener("pointerdown", (e) => { if (e.target.closest(".ring-center")) return; ring.setPointerCapture(e.pointerId); ringDrag = angleOf(e); });
  ring.addEventListener("pointermove", (e) => {
    if (ringDrag == null) return;
    const a = angleOf(e); let d = a - ringDrag;
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    ringDrag = a; turnRing(d);
  });
  ring.addEventListener("pointerup", () => (ringDrag = null));
  ring.addEventListener("wheel", (e) => { e.preventDefault(); turnRing(-e.deltaY * 0.004); }, { passive: false });

  /* ---------------- ボタン類 ---------------- */
  const ACTS = {
    prev: () => show(order[(idx() - 1 + order.length) % order.length]),
    next: () => show(order[(idx() + 1) % order.length]),
    fit: () => { S.rot = 0; fit(true); },
    rotL: () => rotate(-15), rotR: () => rotate(15),
    clear: clearInk, undo,
    help: () => openSheet("help"),
    layerUp: () => moveLayer(S.id, -1), layerDown: () => moveLayer(S.id, 1),
    orderMenu: () => ($("#orderMenu").hidden = !$("#orderMenu").hidden),
    copyOrder: () => {
      const text = `const ORDER = ${JSON.stringify(order)};`;
      const fallback = () => prompt("この1行を works.js の ORDER の行と置き換えてください", text);
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("コピーしました → works.js の ORDER の行と置き換え"), fallback);
      else fallback();
      $("#orderMenu").hidden = true;
    },
    resetOrder: () => { store.del("linkpad-order"); order = defaultOrder(); renderLayers(); $("#orderMenu").hidden = true; toast("初期の並び順に戻しました"); },
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]"); if (a) { ACTS[a.dataset.act]?.(); flashKey(a); }
    const t = e.target.closest("[data-tool]"); if (t) setTool(t.dataset.tool);
    const tg = e.target.closest("[data-toggle]"); if (tg) toggle(tg.dataset.toggle);
    const ch = e.target.closest(".chip"); if (ch) setColor(ch.dataset.color);
    const pnl = e.target.closest("[data-panel]"); if (pnl) pnl.dataset.panel === "works" ? closeSheets() : openSheet(pnl.dataset.panel);
    if (e.target.closest("[data-close]") || e.target.classList.contains("sheet")) closeSheets();
    if (!e.target.closest("#orderMenu, [data-act=orderMenu]")) $("#orderMenu").hidden = true;
  });
  function flashKey(el) { if (!el.classList.contains("xkey")) return; el.classList.add("is-pressed"); setTimeout(() => el.classList.remove("is-pressed"), 120); }
  function setTool(t) {
    S.tool = t;
    $$("[data-tool]").forEach((b) => b.classList.toggle("is-on", b.dataset.tool === t));
    cursor.dataset.tool = t;
    $("#stTool").textContent = TOOL_NAME[t];
    updateSizeDot();
  }
  function toggle(name) {
    S[name] = !S[name];
    $$(`[data-toggle="${name}"]`).forEach((b) => b.classList.toggle("is-on", S[name]));
    if (name === "flip") paper.classList.toggle("flip", S.flip);
    if (name === "mono") paper.classList.toggle("mono", S.mono);
    if (name === "keep" && !S.keep) { const now = performance.now(); S.strokes.forEach((st) => (st.end = now)); }
    toast({ keep: S.keep ? "線を残す：オン" : "線を残す：オフ（ゆっくり消えます）", flip: S.flip ? "左右反転（デッサンチェック）" : "反転を解除", mono: S.mono ? "モノクロ表示（明暗チェック）" : "カラー表示" }[name]);
  }
  function openSheet(id) {
    closeSheets(); $("#" + id).hidden = false;
    $$(".menus button").forEach((b) => b.classList.toggle("is-on", b.dataset.panel === id));
  }
  function closeSheets() {
    $$(".sheet").forEach((s) => (s.hidden = true));
    $$(".menus button").forEach((b) => b.classList.toggle("is-on", b.dataset.panel === "works"));
  }

  /* ---------------- ブラシサイズ ---------------- */
  const sizeInput = $("#penSize");
  function setSize(v) { S.size = Math.min(Math.max(Math.round(v), 1), 40); sizeInput.value = S.size; updateSizeDot(); }
  function updateSizeDot() {
    $("#sizeNum").textContent = S.size;
    const px = Math.max(Math.min(S.size, 22), 3);
    Object.assign($("#sizeDot").style, { width: px + "px", height: px + "px", background: $("#penColor").value });
    const tipPx = S.tool === "eraser" ? Math.max(S.size * 2.8, 20) : Math.max(S.size + 6, 12);
    cursor.style.setProperty("--tip", tipPx + "px");
  }
  sizeInput.addEventListener("input", () => setSize(+sizeInput.value));
  $("#penColor").addEventListener("input", () => { updateSizeDot(); $$(".chip").forEach((ch) => ch.classList.remove("is-on")); });

  /* ---------------- キーボード ---------------- */
  const keyFor = (act) => $(`.xkey[data-act="${act}"]`);
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input")) return;
    if (!booted) return;
    const k = e.key, lk = k.toLowerCase();
    const run = (act) => { ACTS[act](); const el = keyFor(act); el && flashKey(el); };
    if ((e.ctrlKey || e.metaKey) && lk === "z") { e.preventDefault(); run("undo"); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (k === "ArrowRight") run("next");
    else if (k === "ArrowLeft") run("prev");
    else if (k === "+" || k === "=" || k === ";") { const { cx, cy } = vpCenter(); zoomAt(cx, cy, 1.25, true); }
    else if (k === "-") { const { cx, cy } = vpCenter(); zoomAt(cx, cy, 0.8, true); }
    else if (k === "0") run("fit");
    else if (lk === "r") e.shiftKey ? ACTS.rotL() : run("rotR");
    else if (k === "Delete" || k === "Backspace") run("clear");
    else if (lk === "b") setTool("pen");
    else if (lk === "e") setTool("eraser");
    else if (lk === "i") setTool("picker");
    else if (lk === "h") setTool("hand");
    else if (lk === "z") setTool("zoom");
    else if (k === "[") setSize(S.size - (S.size > 10 ? 2 : 1));
    else if (k === "]") setSize(S.size + (S.size >= 10 ? 2 : 1));
    else if (lk === "k") toggle("keep");
    else if (lk === "m") toggle("flip");
    else if (lk === "g") toggle("mono");
    else if (lk === "n") toggleInfo();
    else if (lk === "p") togglePlay();
    else if (k === ",") stepFrame(-1);
    else if (k === ".") stepFrame(1);
    else if (lk === "o") { if (S.isAnim) toggleOnion(); }
    else if (lk === "f") { screen.classList.toggle("full"); setTimeout(() => { resizeInk(); fit(true); }, 30); }
    else if (k === "Escape") { closeSheets(); closeInfo(); }
    else if (k === " ") { e.preventDefault(); if (!S.space) { S.space = true; cursor.dataset.tool = "hand"; } }
    else if (k === "Alt") { e.preventDefault(); if (S.tool === "pen") cursor.dataset.tool = "picker"; }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Alt") cursor.dataset.tool = S.tool;
    if (e.key === " ") S.space = false;
  });
  window.addEventListener("blur", () => { S.space = false; cursor.dataset.tool = S.tool; });

  /* ---------------- ペンカーソル ---------------- */
  if (matchMedia("(pointer: fine)").matches) {
    document.body.classList.add("custom-cursor");
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      cursor.classList.add("show");
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      const overUI = !!e.target.closest("button, .layer, a, label, input, .tl-track, .info-card");
      cursor.classList.toggle("hover", overUI);
      cursor.classList.toggle("on-canvas", !!e.target.closest("#viewport") && !overUI);
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("show"));
    window.addEventListener("pointerdown", (e) => { if (!e.target.closest("#viewport")) cursor.classList.add("down"); });
    window.addEventListener("pointerup", () => { if (!S.cur && !drag) cursor.classList.remove("down"); });
  }

  /* ---------------- 効果音 ---------------- */
  const SFX = (() => {
    const make = (src, n = 4) => Array.from({ length: n }, () => { const a = new Audio(src); a.preload = "auto"; return a; });
    const bank = {
      clic: [make("clic.mp3"), make("clic2.mp3")],
      window: [make("window.mp3", 3)],
      boot: [make("kdouonn.mp3", 1)],
    };
    const VOL = { clic: 0.55, window: 0.28, boot: 0.85 }; // windowは小さめでなじませる
    let muted = store.get("linkpad-muted") === true;
    const btn = $("#soundBtn");
    const paint = () => { btn.classList.toggle("off", muted); btn.title = muted ? "効果音：オフ" : "効果音：オン"; };
    paint();
    btn.addEventListener("click", () => { muted = !muted; store.set("linkpad-muted", muted); paint(); toast(muted ? "効果音オフ" : "効果音オン"); });
    let unlocked = false;
    return {
      // スマホ（特にiPhone）向け：タッチした瞬間に全部の音を無音で一度再生して許可をもらう
      unlock() {
        if (unlocked) return; unlocked = true;
        Object.values(bank).flat(2).forEach((a) => {
          a.muted = true;
          const p = a.play();
          const reset = () => { a.pause(); a.currentTime = 0; a.muted = false; };
          p && p.then ? p.then(reset, () => { a.muted = false; unlocked = false; }) : reset();
        });
      },
      play(name) {
        if (muted) return;
        const variants = bank[name]; if (!variants) return;
        const pool = variants[Math.floor(Math.random() * variants.length)];
        const a = pool.find((x) => x.paused || x.ended) || pool[0];
        try { a.currentTime = 0; a.volume = VOL[name]; a.play().catch(() => {}); } catch (_) {}
      },
    };
  })();
  // マウス・ペンでクリックしたとき（キャンバスに線を描く操作は除く）
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button > 0) return;
    const onCanvas = e.target.closest("#viewport") && !e.target.closest(".info-card, .info-pill, .timeline");
    if (onCanvas && booted && !S.space && (S.tool === "pen" || S.tool === "eraser") && !e.altKey) return;
    if (e.target.closest("#boot")) return; // 起動画面は起動音のみ
    SFX.play("clic");
  }, true);

  /* ---------------- スマホ用ツール（見る / 描く / 消す） ---------------- */
  const M_NAME = { view: "見る", pen: "描く", eraser: "消す" };
  function setMTool(t) {
    S.mtool = t;
    $$("[data-mtool]").forEach((b) => b.classList.toggle("is-on", b.dataset.mtool === t));
    viewport.classList.toggle("touch-draw", t !== "view");
    if (t !== "view") setTool(t); // ペン・消しゴムの状態もそろえる
    if (mobileUI.matches) $("#stTool").textContent = M_NAME[t];
  }
  function syncMobileColor() {
    const c = $("#penColor").value;
    $("#mPenColor").value = c; $("#mColorDot").style.background = c;
  }
  $("#mTools").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mtool]"); if (!b) return;
    setMTool(b.dataset.mtool);
    toast({ view: "見る：スワイプで作品切替・ピンチで拡大", pen: "描く：1本指で描く・2本指で移動", eraser: "消す：なぞった線を消す" }[b.dataset.mtool]);
  });
  $("#mPenColor").addEventListener("input", (e) => { $("#penColor").value = e.target.value; syncMobileColor(); updateSizeDot(); if (S.mtool !== "pen") setMTool("pen"); });
  syncMobileColor();
  mobileUI.addEventListener?.("change", () => { resizeInk(); fit(false); if (!mobileUI.matches) setMTool("view"); });

  /* ---------------- トースト / ヒント ---------------- */
  let toastTimer = 0;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  if (!matchMedia("(pointer: fine)").matches) hint.textContent = "スワイプで作品切替 ・ ピンチで拡大 ・ ダブルタップでズーム";
  let hintTimer = setTimeout(dismissHint, 9000);
  function dismissHint() { hint.classList.add("gone"); clearTimeout(hintTimer); }

  /* ---------------- 起動 ---------------- */
  let booted = false;
  const boot = $("#boot"), touch = $("#touch"), fill = $("#touchFill");
  const CIRC = 276.5, HOLD = 900;
  let holdStart = 0, holdRaf = 0;
  function holdLoop() {
    const t = Math.min((performance.now() - holdStart) / HOLD, 1);
    fill.style.strokeDashoffset = CIRC * (1 - t);
    if (t >= 1) return powerOn();
    holdRaf = requestAnimationFrame(holdLoop);
  }
  let holding = false;
  function holdDown(e) {
    if (booted || holding) return;
    if (e.cancelable) e.preventDefault();
    holding = true;
    SFX.unlock();
    boot.classList.add("holding");
    holdStart = performance.now(); cancelAnimationFrame(holdRaf); holdLoop();
  }
  function holdUp() {
    if (booted || !holding) return;
    holding = false;
    boot.classList.remove("holding");
    cancelAnimationFrame(holdRaf);
    fill.style.transition = "stroke-dashoffset .3s"; fill.style.strokeDashoffset = CIRC;
    setTimeout(() => (fill.style.transition = ""), 300);
  }
  const isSkip = (e) => !!e.target.closest("#skip");
  // タッチ（スマホ・タブレット）：touchstart で preventDefault すると、長押しメニューや文字選択に邪魔されない
  boot.addEventListener("touchstart", (e) => { if (!isSkip(e)) holdDown(e); }, { passive: false });
  boot.addEventListener("touchend", (e) => { if (isSkip(e)) { e.preventDefault(); powerOn(); return; } holdUp(); }, { passive: false });
  boot.addEventListener("touchcancel", holdUp);
  boot.addEventListener("contextmenu", (e) => e.preventDefault());
  // マウス・ペン
  boot.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch" && !isSkip(e)) holdDown(e); });
  window.addEventListener("pointerup", (e) => { if (e.pointerType !== "touch") holdUp(); });
  window.addEventListener("blur", holdUp);
  touch.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) holdDown(e); });
  touch.addEventListener("keyup", holdUp);
  $("#skip").addEventListener("click", () => { SFX.unlock(); powerOn(); });
  function powerOn() {
    if (booted) return; booted = true; holding = false;
    cancelAnimationFrame(holdRaf);
    navigator.vibrate?.(30);
    SFX.play("boot");
    try { sessionStorage.setItem("linkpad-booted", "1"); } catch (_) {}
    boot.classList.add("flash");
    $("#led").classList.add("on");
    setTimeout(() => { boot.classList.add("off"); paper.classList.remove("reveal"); void paper.offsetWidth; paper.classList.add("reveal"); openInfo(); }, 250);
    setTimeout(() => boot.remove(), 1200);
  }

  /* ---------------- プロフィール ---------------- */
  $("#pfName").textContent = PROFILE.name;
  $("#pfKana").textContent = [PROFILE.kana, PROFILE.handle && `@${PROFILE.handle}`].filter(Boolean).join("  ·  ");
  $("#pfAff").textContent = PROFILE.affiliation;
  $("#pfStatement").textContent = PROFILE.statement;
  $("#pfLinks").innerHTML = (PROFILE.links || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join("");
  $("#pfContact").innerHTML = PROFILE.email ? `<dt>Contact</dt><dd><a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a><button class="copy-mail" data-mail="${esc(PROFILE.email)}" title="コピー">⧉</button></dd>` : "";
  if (PROFILE.icon) { $("#pfIcon").src = PROFILE.icon; $("#meIcon").src = PROFILE.icon; }
  else { $("#pfIcon").remove(); $(".me").remove(); }
  $("#pfContact").addEventListener("click", (e) => {
    const b = e.target.closest(".copy-mail"); if (!b) return;
    navigator.clipboard?.writeText(b.dataset.mail).then(() => toast("メールアドレスをコピーしました"), () => {});
  });

  /* ---------------- 初期化 ---------------- */
  let seen = false; try { seen = sessionStorage.getItem("linkpad-booted") === "1"; } catch (_) {}
  if (seen) { booted = true; boot.remove(); $("#led").classList.add("on"); }
  renderLayers();
  resizeInk();
  setTool("pen");
  setSize(8);
  setMTool("view");
  show(S.id, true);
  requestAnimationFrame(draw);
  new ResizeObserver(() => { resizeInk(); fit(false); }).observe(viewport);
})();
