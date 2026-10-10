/* A browser-local editor. It exports repository files and never writes to Supabase. */
(() => {
  "use strict";
  const root = document.querySelector("[data-studio]");
  if (!root) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const api = window.HanshuiAppearance;
  const scope = root.querySelector("[data-scope]");
  const slot = root.querySelector("[data-slot]");
  const previewPage = root.querySelector("[data-preview-page]");
  const iframe = root.querySelector("[data-preview]");
  const status = root.querySelector("[data-studio-status]");
  const assets = new Map();
  let baseline, draft;
  const report = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", error);
  };
  function effective(path) {
    const override = draft.pages[path] || {};
    const settings = { ...draft.global, ...override };
    for (const key of ["surface", "background", "hero", "cover", "masthead"]) {
      settings[key] = { ...draft.global[key], ...(override[key] || {}) };
    }
    return settings;
  }
  function target() {
    if (scope.value === "global") return draft.global;
    if (!draft.pages[scope.value]) draft.pages[scope.value] = clone(effective(scope.value));
    return draft.pages[scope.value];
  }
  function showControls() {
    const settings = scope.value === "global" ? draft.global : effective(scope.value);
    const image = settings[slot.value];
    root.querySelectorAll("[data-field]").forEach(input => {
      input.value = image[input.dataset.field] ?? "";
      const output = root.querySelector('[data-output="' + input.dataset.field + '"]');
      if (output) output.value = input.dataset.field === "blur" ? input.value + " px" : Math.round(Number(input.value) * (input.dataset.field === "opacity" ? 100 : 1)) + "%";
    });
    root.querySelectorAll("[data-surface-field]").forEach(input => {
      input.value = settings.surface[input.dataset.surfaceField];
      root.querySelector('[data-output="surface-' + input.dataset.surfaceField + '"]').value =
        input.dataset.surfaceField === "opacity" ? Math.round(Number(input.value) * 100) + "%" : input.value + " px";
    });
    root.querySelector("[data-accent]").value = settings.accent;
    root.querySelector("[data-motion]").checked = settings.motion;
  }
  function refreshPreview() {
    if (!draft) return;
    const settings = clone(effective(previewPage.value));
    for (const key of ["background", "hero", "cover", "masthead"]) {
      const asset = assets.get(settings[key].src);
      if (asset) settings[key].src = asset.url;
    }
    iframe.contentWindow?.postMessage({ type: "hanshui:appearance", settings }, location.origin);
  }
  iframe.addEventListener("load", refreshPreview);
  scope.addEventListener("change", () => {
    if (!draft) return;
    if (scope.value !== "global") {
      previewPage.value = scope.value;
      navigatePreview();
    }
    showControls(); refreshPreview();
  });
  slot.addEventListener("change", () => {
    showControls();
    if (slot.value === "hero") {
      previewPage.value = "/"; navigatePreview();
    } else if (slot.value === "cover" && previewPage.value === "/") {
      const article = [...previewPage.options].find(option => option.value !== "/");
      if (article) { previewPage.value = article.value; navigatePreview(); }
    }
    refreshPreview();
    if (scope.value !== "global" && scope.value !== previewPage.value) report("当前仅修改所选配置范围；切换到相同页面才能看到该范围的效果。");
  });
  function navigatePreview() {
    iframe.src = previewPage.value + "?preview=1";
  }
  previewPage.addEventListener("change", navigatePreview);
  root.querySelectorAll("[data-field]").forEach(input => {
    input.addEventListener("input", () => {
      if (!draft) return;
      if (input.dataset.field === "src" && input.value && !api.normalize({ [slot.value]: { src: input.value } })[slot.value].src) {
        report("请使用以 / 开头的站内路径，或 https:// 图片地址。", true); return;
      }
      const value = input.type === "range" ? Number(input.value) : input.value;
      target()[slot.value][input.dataset.field] = value;
      showControls(); refreshPreview();
      report("预览已更新。导出后才能发布到网站。");
    });
  });
  root.querySelectorAll("[data-surface-field]").forEach(input => {
    input.addEventListener("input", () => {
      target().surface[input.dataset.surfaceField] = Number(input.value);
      showControls(); refreshPreview();
    });
  });
  root.querySelector("[data-accent]").addEventListener("input", event => {
    target().accent = event.target.value; refreshPreview();
  });
  root.querySelector("[data-motion]").addEventListener("change", event => {
    target().motion = event.target.checked; refreshPreview();
  });
  root.querySelector("[data-clear-image]").addEventListener("click", () => {
    target()[slot.value].src = ""; showControls(); refreshPreview();
  });
  root.querySelector("[data-upload]").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };
    if (!extensions[file.type] || file.size > 8 * 1024 * 1024) {
      report("请选择不超过 8 MB 的 PNG、JPEG、WebP 或 AVIF 图片。", true); event.target.value = ""; return;
    }
    if ([...assets.values()].reduce((total, asset) => total + asset.file.size, file.size) > 32 * 1024 * 1024) {
      report("当前草稿图片合计超过 32 MB。请先导出，再刷新工作台。", true); return;
    }
    const path = "/images/uploads/" + crypto.randomUUID() + "." + extensions[file.type];
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.src = url;
    try { await probe.decode(); } catch {
      URL.revokeObjectURL(url); report("图片无法读取，请选择有效图片。", true); return;
    }
    assets.set(path, { file, url });
    target()[slot.value].src = path;
    showControls(); refreshPreview();
    report("图片已载入本地预览，尚未上传或发布。");
    event.target.value = "";
  });
  root.querySelector("[data-reset]").addEventListener("click", () => {
    if (!baseline) return;
    draft = clone(baseline);
    for (const asset of assets.values()) URL.revokeObjectURL(asset.url);
    assets.clear(); showControls(); refreshPreview();
    report("已恢复工作台打开时的已发布设置。");
  });
  root.querySelectorAll("[data-viewport]").forEach(button => button.addEventListener("click", () => {
    root.querySelector(".studio-preview").classList.toggle("is-mobile", button.dataset.viewport === "mobile");
    root.querySelectorAll("[data-viewport]").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
  }));
  function validateConfig(value) {
    if (value?.version !== 1 || !value.global || typeof value.global !== "object") throw Error("不是受支持的版本 1 配置。");
    const result = { version: 1, global: api.normalize(value.global), pages: Object.create(null) };
    for (const [path, override] of Object.entries(value.pages || {})) {
      if (!/^\/(?!\/).*/.test(path) || typeof override !== "object" || !override) throw Error("页面配置路径无效。");
      const combined = { ...result.global, ...override };
      for (const key of ["surface", "background", "hero", "cover", "masthead"]) combined[key] = { ...result.global[key], ...(override[key] || {}) };
      result.pages[path] = api.normalize(combined);
    }
    return result;
  }
  root.querySelector("[data-import]").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error("配置文件不能超过 1 MB。");
      draft = validateConfig(JSON.parse(await file.text()));
      showControls(); refreshPreview(); report("配置已导入预览。图片路径需在网站中存在，或重新选取对应图片。");
    } catch (error) { report("导入失败：" + error.message, true); }
    event.target.value = "";
  });
  // Uncompressed ZIP: avoids a third-party dependency and keeps selected files local.
  function zip(entries) {
    const encoder = new TextEncoder(), chunks = [], central = [];
    let offset = 0, centralSize = 0;
    const crc = bytes => {
      let value = 0xffffffff;
      for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
      return (value ^ 0xffffffff) >>> 0;
    };
    for (const entry of entries) {
      const name = encoder.encode(entry.name), data = entry.data, checksum = crc(data);
      const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
      view.setUint16(12, 33, true); view.setUint32(14, checksum, true); view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); local.set(name, 30);
      const header = new Uint8Array(46 + name.length), info = new DataView(header.buffer);
      info.setUint32(0, 0x02014b50, true); info.setUint16(4, 20, true); info.setUint16(6, 20, true);
      info.setUint16(8, 0x800, true); info.setUint16(14, 33, true); info.setUint32(16, checksum, true);
      info.setUint32(20, data.length, true); info.setUint32(24, data.length, true); info.setUint16(28, name.length, true);
      info.setUint32(42, offset, true); header.set(name, 46);
      chunks.push(local, data); central.push(header); offset += local.length + data.length; centralSize += header.length;
    }
    const end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: "application/zip" });
  }
  root.querySelector("[data-export]").addEventListener("click", async () => {
    if (!draft) return;
    const button = root.querySelector("[data-export]");
    button.disabled = true;
    try {
      const encoder = new TextEncoder();
      const entries = [{ name: "static/appearance.json", data: encoder.encode(JSON.stringify(draft, null, 2) + "\n") }];
      const references = new Set();
      for (const settings of [draft.global, ...Object.values(draft.pages)]) {
        for (const key of ["background", "hero", "cover", "masthead"]) if (settings[key]?.src) references.add(settings[key].src);
      }
      for (const [path, asset] of assets) {
        if (references.has(path)) entries.push({ name: "static" + path, data: new Uint8Array(await asset.file.arrayBuffer()) });
      }
      entries.push({ name: "使用说明.txt", data: encoder.encode("将压缩包里的 static 文件夹合并到博客仓库根目录，然后提交 GitHub。不要替换或删除仓库中的其他文件。部署完成后，新图片和效果会对所有访客生效。仅下载本文件不会发布网站。\n") });
      const url = URL.createObjectURL(zip(entries));
      const link = document.createElement("a"); link.href = url; link.download = "hanshui-appearance.zip";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      report("已导出。解压后将 static 文件夹合并到仓库根目录并提交，部署后生效。");
    } catch (error) { report("导出失败：" + error.message, true); }
    finally { button.disabled = false; }
  });
  async function start() {
    root.querySelectorAll("input,select,button").forEach(control => control.disabled = true);
    try {
      const response = await fetch("/appearance.json", { cache: "no-store" });
      if (!response.ok) throw Error("无法读取已发布配置。");
      baseline = validateConfig(await response.json()); draft = clone(baseline);
      root.querySelectorAll("input,select,button").forEach(control => control.disabled = false);
      showControls(); refreshPreview();
      report("已载入已发布设置。调整效果后，可随时导出。");
    } catch (error) { report("工作台未能启动：" + error.message, true); }
  }
  start();
})();
