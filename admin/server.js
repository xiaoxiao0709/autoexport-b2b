(function () {
  "use strict";

  var cfg = window.AUTOEXPORT_SUPABASE;
  var db = window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: false } });
  var state = {
    vehicles: [], content: { en: {}, zh: {}, ar: {}, ru: {} }, settings: {}, inquiries: [],
    editingId: null, gallery: [], colors: [], copyLang: "zh", contentLang: "en",
    contentGroup: "hero", logs: JSON.parse(localStorage.getItem("aex_admin_logs") || "[]"), channel: null
  };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var slug = function (value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
  var lines = function (value) { return String(value || "").split(/\r?\n|,/).map(function (x) { return x.trim(); }).filter(Boolean); };
  var titles = { dashboard: "业务概览", vehicles: "车辆资源", content: "页面内容", inquiries: "客户询盘", chat: "在线客服", analytics: "数据统计", settings: "站点设置", system: "数据与系统" };
  var inquiryStages = [
    { id: "new", name: "待跟进" }, { id: "contacted", name: "已联系" }, { id: "quoted", name: "已报价" },
    { id: "won", name: "已成交" }, { id: "closed", name: "已关闭" }
  ];

  function toast(message, error) {
    var el = $("toast"); el.textContent = message; el.className = "toast " + (error ? "error" : "success");
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { el.className = "toast hidden"; }, 3200);
  }
  function log(message) {
    state.logs.unshift({ message: message, at: new Date().toISOString() }); state.logs = state.logs.slice(0, 30);
    localStorage.setItem("aex_admin_logs", JSON.stringify(state.logs)); renderLogs();
  }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type || "application/json;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function value(id) { return $(id).value.trim(); }
  function setValue(id, v) { $(id).value = v == null ? "" : v; }

  async function loadAll(silent) {
    if (!silent) toast("正在同步云端数据");
    var results = await Promise.all([
      db.from("vehicles").select("id,data,published,sort_order,updated_at").order("sort_order"),
      db.from("site_content").select("content,updated_at").eq("id", "main").maybeSingle(),
      db.from("site_settings").select("*").eq("id", "main").maybeSingle(),
      db.from("inquiries").select("*").order("created_at", { ascending: false })
    ]);
    if (results[0].error) throw results[0].error;
    state.vehicles = (results[0].data || []).map(function (row) { return Object.assign({}, row.data || {}, { id: row.id, published: row.published, sort_order: row.sort_order, updated_at: row.updated_at }); });
    if (!results[1].error && results[1].data) state.content = results[1].data.content || state.content;
    if (!results[2].error && results[2].data) state.settings = results[2].data;
    state.inquiries = results[3].error ? [] : (results[3].data || []);
    renderAll(); checkWritePermission();
    if (!silent) toast("云端数据已更新");
  }

  function renderAll() {
    renderStats(); renderVehicles(); renderContentGroups(); renderContent(); renderSettings(); renderInquiries(); renderAnalytics(); renderLogs(); renderReplies();
    if (window.lucide) window.lucide.createIcons();
  }
  function renderStats() {
    var stock = state.vehicles.reduce(function (sum, v) { return sum + (+v.stock || 0); }, 0);
    var low = state.vehicles.filter(function (v) { return (+v.stock || 0) < 20; });
    $("statVehicles").textContent = state.vehicles.length;
    $("statPublished").textContent = state.vehicles.filter(function (v) { return v.published !== false; }).length;
    $("statStock").textContent = stock;
    $("statInquiries").textContent = state.inquiries.filter(function (v) { return !v.status || v.status === "new"; }).length;
    $("stockWarning").textContent = low.length ? low.length + " 款库存偏低" : "库存正常";
    $("statLowStock").textContent = low.length;
    $("statAvgStock").textContent = state.vehicles.length ? Math.round(stock / state.vehicles.length) : 0;
    $("statMonthInquiries").textContent = state.inquiries.filter(function (q) { var d = new Date(q.created_at); var n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }).length;
    $("statWon").textContent = state.inquiries.filter(function (q) { return q.status === "won"; }).length;
    $("lowStockList").innerHTML = low.length ? low.sort(function (a, b) { return (+a.stock || 0) - (+b.stock || 0); }).slice(0, 6).map(function (v) { return '<div class="low-item"><div><b>' + esc(v.brand + " " + v.name) + '</b><div class="muted">' + esc(v.type || "-") + '</div></div><span class="' + ((+v.stock || 0) < 10 ? "stock-critical" : "stock-low") + '">' + (+v.stock || 0) + ' 台</span></div>'; }).join("") : '<div class="empty">暂无低库存车辆</div>';
    $("recentInquiryList").innerHTML = state.inquiries.length ? state.inquiries.slice(0, 5).map(function (q) { return '<div class="activity-item"><div><b>' + esc(q.name || "匿名客户") + '</b><div class="muted">' + esc(q.company || q.message || "采购询盘") + '</div></div><small>' + new Date(q.created_at).toLocaleDateString("zh-CN") + '</small></div>'; }).join("") : '<div class="empty">暂无询盘</div>';
  }

  function filteredVehicles() {
    var term = value("vehicleSearch").toLowerCase(), type = $("vehicleTypeFilter").value, status = $("vehicleStatusFilter").value;
    return state.vehicles.filter(function (v) {
      var text = [v.brand, v.name, v.marketZh, v.marketEn].join(" ").toLowerCase();
      return (!term || text.indexOf(term) >= 0) && (type === "all" || v.type === type) && (status === "all" || (status === "published" && v.published !== false) || (status === "draft" && v.published === false) || (status === "low" && (+v.stock || 0) < 20));
    });
  }
  function renderVehicles() {
    var list = filteredVehicles(), rows = $("vehicleRows");
    $("vehicleEmpty").classList.toggle("hidden", list.length > 0);
    rows.innerHTML = list.map(function (v) {
      var stockClass = (+v.stock || 0) < 10 ? "stock-critical" : ((+v.stock || 0) < 20 ? "stock-low" : "");
      return '<tr><td><span class="drag">⋮⋮</span></td><td><div style="display:flex;align-items:center;gap:12px"><img class="vehicle-thumb" src="' + esc(v.image || (v.gallery || [])[0] || "") + '" alt=""><div class="vehicle-title"><b>' + esc(v.brand + " " + v.name) + '</b><small>' + esc(v.bodyType || v.categoryEn || "-") + '</small></div></div></td><td>' + esc((v.type || "-").toUpperCase()) + '</td><td>' + esc(v.year || "-") + '</td><td>' + esc(v.exportPrice || "待询价") + '</td><td class="' + stockClass + '">' + (+v.stock || 0) + '</td><td>' + esc(v.marketZh || v.marketEn || "全球") + '</td><td><button class="btn" data-toggle="' + esc(v.id) + '"><span class="status ' + (v.published === false ? "off" : "") + '">' + (v.published === false ? "已下架" : "已上架") + '</span></button></td><td><div class="row-actions"><button class="icon-btn" data-edit="' + esc(v.id) + '" title="编辑"><i data-lucide="pencil"></i></button><a class="icon-btn" href="../vehicle.html?id=' + encodeURIComponent(v.id) + '" target="_blank" title="预览"><i data-lucide="external-link"></i></a></div></td></tr>';
    }).join("");
    rows.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openVehicle(b.dataset.edit); }; });
    rows.querySelectorAll("[data-toggle]").forEach(function (b) { b.onclick = function () { toggleVehicle(b.dataset.toggle); }; });
    if (window.lucide) window.lucide.createIcons();
  }

  function blankVehicle() { return { brand: "", name: "", type: "ev", year: 2025, bodyType: "SUV", stock: 0, status: "Export Ready", published: true, gallery: [], image: "", colors: [], features: [], highlights: { zh: [], en: [], ar: [], ru: [] } }; }
  function openVehicle(id) {
    var v = id ? state.vehicles.find(function (x) { return x.id === id; }) : blankVehicle();
    state.editingId = id || null; state.gallery = (v.gallery || [v.image]).filter(Boolean); state.colors = (v.colors || []).slice(); state.copyLang = "zh";
    $("vehicleDrawerTitle").textContent = id ? "编辑车辆" : "新增车辆"; $("deleteVehicleBtn").classList.toggle("hidden", !id);
    [["vBrand","brand"],["vName","name"],["vType","type"],["vYear","year"],["vBody","bodyType"],["vStock","stock"],["vStatus","status"],["vRange","range"],["vPower","power"],["vDrivetrain","drivetrain"],["vDimensions","dimensions"],["vWheelbase","wheelbase"],["vSeats","seats"],["vBattery","battery"],["vEngine","engine"],["vTransmission","transmission"],["vWarranty","warranty"],["vTires","tires"],["vImage","image"],["vExportPrice","exportPrice"],["vMarketZh","marketZh"],["vMarketEn","marketEn"],["vExportNotes","exportNotes"]].forEach(function (p) { setValue(p[0], v[p[1]]); });
    $("vPublished").value = v.published === false ? "false" : "true"; $("vFiles").value = ""; $("vFeatures").value = (v.features || []).join("\n");
    state.draftCopy = { zh: v.detailZh || v.descZh || "", en: v.detailEn || v.descEn || "", ar: v.detailAr || "", ru: v.detailRu || "" };
    state.draftHighlights = { zh: normalizeHighlight(v.highlights && v.highlights.zh), en: normalizeHighlight(v.highlights && v.highlights.en), ar: normalizeHighlight(v.highlights && v.highlights.ar), ru: normalizeHighlight(v.highlights && v.highlights.ru) };
    renderGallery(); renderColors(); loadCopyFields(); switchVehicleTab("basic"); $("vehicleDrawer").classList.add("open");
  }
  function normalizeHighlight(v) { return Array.isArray(v) ? v : lines(v); }
  function closeVehicle() { $("vehicleDrawer").classList.remove("open"); state.editingId = null; }
  function switchVehicleTab(name) {
    document.querySelectorAll("#vehicleEditorTabs [data-tab]").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === name); });
    document.querySelectorAll(".editor-panel").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== name); });
  }
  function storeCopyFields() { state.draftCopy[state.copyLang] = $("vDescription").value; state.draftHighlights[state.copyLang] = lines($("vHighlights").value); }
  function loadCopyFields() { $("vDescription").value = state.draftCopy[state.copyLang] || ""; $("vHighlights").value = (state.draftHighlights[state.copyLang] || []).join("\n"); document.querySelectorAll("#vehicleLangTabs [data-lang]").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === state.copyLang); }); }
  function renderGallery() {
    $("vGallery").innerHTML = state.gallery.map(function (url, i) { return '<div class="media-item"><img src="' + esc(url) + '" alt=""><button type="button" data-remove-image="' + i + '" title="移除">×</button><button type="button" data-main-image="' + i + '" title="设为主图" style="left:5px;right:auto;width:auto;padding:0 7px">' + (i === 0 ? "主图" : "设为主图") + '</button></div>'; }).join("");
    $("vGallery").querySelectorAll("[data-remove-image]").forEach(function (b) { b.onclick = function () { state.gallery.splice(+b.dataset.removeImage, 1); renderGallery(); }; });
    $("vGallery").querySelectorAll("[data-main-image]").forEach(function (b) { b.onclick = function () { var item = state.gallery.splice(+b.dataset.mainImage, 1)[0]; state.gallery.unshift(item); setValue("vImage", item); renderGallery(); }; });
  }
  function renderColors() {
    $("vColorTags").innerHTML = state.colors.map(function (c, i) { var name = typeof c === "string" ? c : c.name; var hex = typeof c === "object" ? c.hex : "#d7dade"; return '<button class="tag" type="button" data-remove-color="' + i + '"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + esc(hex) + ';border:1px solid #aaa;margin-right:5px"></i>' + esc(name) + ' ×</button>'; }).join("");
    $("vColorTags").querySelectorAll("[data-remove-color]").forEach(function (b) { b.onclick = function () { state.colors.splice(+b.dataset.removeColor, 1); renderColors(); }; });
  }
  async function uploadImages(id) {
    var files = Array.from($("vFiles").files || []), urls = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i]; if (file.size > 10485760) throw new Error(file.name + " 超过 10MB");
      var ext = (file.name.split(".").pop() || "jpg").toLowerCase(), path = "vehicles/" + id + "-" + Date.now() + "-" + i + "." + ext;
      var result = await db.storage.from("vehicle-images").upload(path, file, { cacheControl: "31536000", upsert: false }); if (result.error) throw result.error;
      urls.push(db.storage.from("vehicle-images").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }
  async function saveVehicle(event) {
    event.preventDefault(); storeCopyFields(); var button = $("saveVehicleBtn"); button.disabled = true;
    try {
      var old = state.editingId ? state.vehicles.find(function (v) { return v.id === state.editingId; }) : {};
      var id = state.editingId || slug(value("vBrand") + "-" + value("vName")) || String(Date.now());
      var uploaded = await uploadImages(id), directImage = value("vImage"); state.gallery = state.gallery.filter(function (url) { return !/^blob:/i.test(url); }).concat(uploaded);
      if (directImage && state.gallery.indexOf(directImage) < 0) state.gallery.unshift(directImage);
      var data = Object.assign({}, old, { id: id, brand: value("vBrand"), name: value("vName"), type: $("vType").value, year: +value("vYear") || 2025, bodyType: value("vBody"), stock: +value("vStock") || 0, status: value("vStatus"), range: value("vRange"), power: value("vPower"), drivetrain: value("vDrivetrain"), dimensions: value("vDimensions"), wheelbase: value("vWheelbase"), seats: value("vSeats"), battery: value("vBattery"), engine: value("vEngine"), transmission: value("vTransmission"), warranty: value("vWarranty"), tires: value("vTires"), image: state.gallery[0] || directImage, gallery: state.gallery, colors: state.colors, features: lines($("vFeatures").value), descZh: state.draftCopy.zh, descEn: state.draftCopy.en, detailZh: state.draftCopy.zh, detailEn: state.draftCopy.en, detailAr: state.draftCopy.ar, detailRu: state.draftCopy.ru, highlights: state.draftHighlights, exportPrice: value("vExportPrice"), marketZh: value("vMarketZh"), marketEn: value("vMarketEn"), exportNotes: value("vExportNotes"), published: $("vPublished").value === "true" });
      delete data.sort_order; delete data.updated_at;
      var result = await db.from("vehicles").upsert({ id: id, data: data, published: data.published, sort_order: old.sort_order == null ? state.vehicles.length : old.sort_order, updated_at: new Date().toISOString() }); if (result.error) throw result.error;
      log("保存车辆：" + data.brand + " " + data.name); closeVehicle(); toast("车辆已保存并同步到前台"); await loadAll(true);
    } catch (e) { toast(formatError(e), true); } finally { button.disabled = false; }
  }
  async function toggleVehicle(id) {
    var v = state.vehicles.find(function (x) { return x.id === id; }), published = v.published === false, data = Object.assign({}, v, { published: published }); delete data.sort_order; delete data.updated_at;
    var result = await db.from("vehicles").update({ published: published, data: data, updated_at: new Date().toISOString() }).eq("id", id); if (result.error) return toast(formatError(result.error), true);
    log((published ? "上架车辆：" : "下架车辆：") + v.brand + " " + v.name); await loadAll(true); toast("状态已同步");
  }
  async function deleteVehicle() {
    if (!state.editingId || !confirm("确认永久删除这辆车？")) return;
    var v = state.vehicles.find(function (x) { return x.id === state.editingId; }), result = await db.from("vehicles").delete().eq("id", state.editingId);
    if (result.error) return toast(formatError(result.error), true); log("删除车辆：" + v.brand + " " + v.name); closeVehicle(); await loadAll(true); toast("车辆已删除");
  }

  function contentGroups() {
    var names = { nav: "导航", hero: "首页 Banner", about: "关于我们", inv: "车辆模块", car: "车型通用", why: "供应链优势", proc: "出口流程", mkt: "全球市场", part: "合作伙伴", foot: "页脚", modal: "询盘弹窗", form: "询盘表单", ph: "输入提示", brand: "品牌信息", seo: "SEO", vehicle: "详情页模板" }, groups = {};
    ["en","zh","ar","ru"].forEach(function (lang) { Object.keys(state.content[lang] || {}).forEach(function (key) { var g = key.split(".")[0]; groups[g] = names[g] || g; }); }); return groups;
  }
  function renderContentGroups() {
    var groups = contentGroups(); if (!groups[state.contentGroup]) state.contentGroup = Object.keys(groups)[0] || "hero";
    $("contentGroups").innerHTML = Object.keys(groups).map(function (g) { return '<button class="' + (g === state.contentGroup ? "active" : "") + '" data-content-group="' + esc(g) + '">' + esc(groups[g]) + '</button>'; }).join("");
    $("contentGroups").querySelectorAll("[data-content-group]").forEach(function (b) { b.onclick = function () { state.contentGroup = b.dataset.contentGroup; renderContentGroups(); renderContent(); }; });
  }
  function renderContent() {
    var term = value("contentSearch").toLowerCase(), all = {};
    ["en","zh","ar","ru"].forEach(function (lang) { Object.keys(state.content[lang] || {}).forEach(function (key) { if (key.split(".")[0] === state.contentGroup) all[key] = true; }); });
    var keys = Object.keys(all).filter(function (key) { var text = (state.content[state.contentLang] || {})[key] || ""; return !term || (key + " " + text).toLowerCase().indexOf(term) >= 0; }).sort();
    $("contentFields").innerHTML = keys.length ? keys.map(function (key) { return '<div class="content-row"><label>' + esc(key) + '</label><textarea data-content-key="' + esc(key) + '">' + esc((state.content[state.contentLang] || {})[key] || "") + '</textarea></div>'; }).join("") : '<div class="empty">当前分组暂无内容</div>';
    $("contentFields").querySelectorAll("[data-content-key]").forEach(function (field) { field.oninput = function () { state.content[state.contentLang] = state.content[state.contentLang] || {}; state.content[state.contentLang][field.dataset.contentKey] = field.value; }; });
    document.querySelectorAll("#contentLangTabs [data-lang]").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === state.contentLang); });
  }
  async function saveContent() {
    var result = await db.from("site_content").upsert({ id: "main", content: state.content, updated_at: new Date().toISOString() });
    if (result.error) return toast(formatError(result.error), true); log("更新页面内容：" + state.contentGroup + " / " + state.contentLang); toast("页面内容已同步到前台");
  }

  function renderSettings() {
    var s = state.settings || {}, extra = s.extra || {};
    [["settingBusiness",s.business_name],["settingWhatsapp",s.whatsapp],["settingEmail",s.email],["settingAddress",extra.address],["settingLicense",extra.license],["settingLogo",extra.logo || "assets/logo-transparent.png"],["settingPhone",extra.phone],["settingCurrency",extra.currency || "USD"],["settingFacebook",extra.facebook],["settingLinkedin",extra.linkedin],["settingInstagram",extra.instagram],["settingMarkets",extra.markets],["settingGa",extra.ga]].forEach(function (p) { setValue(p[0], p[1]); });
  }
  async function saveSettings() {
    var extra = { address: value("settingAddress"), license: value("settingLicense"), logo: value("settingLogo"), phone: value("settingPhone"), currency: $("settingCurrency").value, facebook: value("settingFacebook"), linkedin: value("settingLinkedin"), instagram: value("settingInstagram"), markets: value("settingMarkets"), ga: value("settingGa") };
    var row = { id: "main", business_name: value("settingBusiness"), whatsapp: value("settingWhatsapp"), email: value("settingEmail"), extra: extra, updated_at: new Date().toISOString() };
    var result = await db.from("site_settings").upsert(row); if (result.error) return toast(formatError(result.error), true);
    state.settings = row; log("更新站点设置"); toast("站点设置已同步");
  }

  function renderInquiries() {
    $("inquiryBoard").innerHTML = inquiryStages.map(function (stage) {
      var list = state.inquiries.filter(function (q) { return (q.status || "new") === stage.id; });
      return '<section class="inquiry-col"><h3>' + stage.name + '<span>' + list.length + '</span></h3>' + (list.length ? list.map(function (q) { return '<article class="inquiry-card"><b>' + esc(q.name || "匿名客户") + '</b><small>' + esc(q.company || q.whatsapp || q.email || "") + '</small><p>' + esc(q.message || "") + '</p><select data-inquiry-status="' + esc(q.id) + '">' + inquiryStages.map(function (s) { return '<option value="' + s.id + '"' + (s.id === stage.id ? " selected" : "") + '>' + s.name + '</option>'; }).join("") + '</select><footer><span>' + new Date(q.created_at).toLocaleDateString("zh-CN") + '</span><a href="https://wa.me/' + esc(String(q.whatsapp || "").replace(/\D/g, "")) + '" target="_blank">WhatsApp</a></footer></article>'; }).join("") : '<div class="muted">暂无记录</div>') + '</section>';
    }).join("");
    $("inquiryBoard").querySelectorAll("[data-inquiry-status]").forEach(function (s) { s.onchange = async function () { var r = await db.from("inquiries").update({ status: s.value, updated_at: new Date().toISOString() }).eq("id", s.dataset.inquiryStatus); if (r.error) return toast(formatError(r.error), true); log("更新询盘状态为：" + s.options[s.selectedIndex].text); await loadAll(true); }; });
  }
  function renderAnalytics() {
    var brands = {}; state.vehicles.forEach(function (v) { brands[v.brand || "其他"] = (brands[v.brand || "其他"] || 0) + (+v.stock || 0); }); var max = Math.max.apply(Math, Object.keys(brands).map(function (k) { return brands[k]; }).concat([1]));
    $("brandChart").innerHTML = Object.keys(brands).map(function (brand) { return '<div class="bar" style="height:' + Math.max(8, Math.round(brands[brand] / max * 100)) + '%"><b>' + brands[brand] + '</b><span>' + esc(brand) + '</span></div>'; }).join("");
    var counts = {}; state.inquiries.forEach(function (q) { var key = q.vehicle || q.vehicle_id || "通用询盘"; counts[key] = (counts[key] || 0) + 1; });
    $("popularVehicles").innerHTML = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8).map(function (key) { return '<div class="low-item"><b>' + esc(key) + '</b><span>' + counts[key] + ' 条</span></div>'; }).join("") || '<div class="empty">暂无统计数据</div>';
  }
  function renderLogs() { $("operationLogs").innerHTML = state.logs.length ? state.logs.slice(0, 8).map(function (x) { return '<div class="activity-item"><span>' + esc(x.message) + '</span><small>' + new Date(x.at).toLocaleString("zh-CN") + '</small></div>'; }).join("") : '<div class="muted">暂无本地操作记录</div>'; }
  function renderReplies() { var replies = JSON.parse(localStorage.getItem("aex_quick_replies") || '["您好，请告诉我您需要的车型、数量和目的港。","我们将在确认库存和船期后提供 FOB/CIF 报价。"]'); $("quickReplies").innerHTML = replies.map(function (x) { return '<div class="activity-item"><span>' + esc(x) + '</span><button class="icon-btn" data-copy-reply="' + esc(x) + '"><i data-lucide="copy"></i></button></div>'; }).join(""); $("quickReplies").querySelectorAll("[data-copy-reply]").forEach(function (b) { b.onclick = function () { navigator.clipboard.writeText(b.dataset.copyReply); toast("快捷回复已复制"); }; }); }
  async function checkWritePermission() {
    var hint = $("writePermissionHint"), toggle = $("writePermissionToggle");
    var probe = await db.from("site_settings").update({ updated_at: state.settings.updated_at || new Date().toISOString() }).eq("id", "main").select("id");
    var allowed = !probe.error && probe.data && probe.data.length === 1; toggle.classList.toggle("on", allowed); hint.textContent = allowed ? "匿名云端写入已启用" : "匿名写入未启用，请执行开发策略 SQL";
  }
  function formatError(e) { var message = e && e.message ? e.message : String(e); if (/row-level security|permission denied/i.test(message)) return "Supabase 尚未开启开发阶段匿名写入权限"; return message; }
  function backup() { download("autoexport-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ exportedAt: new Date().toISOString(), vehicles: state.vehicles, content: state.content, settings: state.settings, inquiries: state.inquiries }, null, 2)); }
  function exportVehicles() { download("vehicles.json", JSON.stringify(state.vehicles, null, 2)); }
  function exportInquiries() { var csv = ["时间,客户,公司,邮箱,WhatsApp,状态,内容"].concat(state.inquiries.map(function (q) { return [q.created_at,q.name,q.company,q.email,q.whatsapp,q.status,q.message].map(function (x) { return '"' + String(x || "").replace(/"/g, '""') + '"'; }).join(","); })).join("\r\n"); download("inquiries.csv", "\ufeff" + csv, "text/csv;charset=utf-8"); }
  async function importVehicles(file) {
    try {
      var items;
      if (/\.json$/i.test(file.name)) items = JSON.parse(await file.text());
      else { var book = XLSX.read(await file.arrayBuffer()); items = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]); }
      if (!Array.isArray(items) || !items.length) throw new Error("导入文件没有车辆数据");
      var rows = items.map(function (item, i) { var id = item.id || slug((item.brand || "vehicle") + "-" + (item.name || i)); var data = Object.assign({}, item, { id: id, published: item.published !== false && item.published !== "false" }); delete data.sort_order; delete data.updated_at; return { id: id, data: data, published: data.published, sort_order: item.sort_order == null ? state.vehicles.length + i : +item.sort_order }; });
      var result = await db.from("vehicles").upsert(rows); if (result.error) throw result.error; log("批量导入车辆：" + rows.length + " 款"); await loadAll(true); toast("已导入 " + rows.length + " 款车辆");
    } catch (e) { toast(formatError(e), true); }
  }
  function showPage(name) { document.querySelectorAll(".page").forEach(function (p) { p.classList.toggle("active", p.id === "page-" + name); }); document.querySelectorAll(".nav [data-page]").forEach(function (b) { b.classList.toggle("active", b.dataset.page === name); }); $("pageTitle").textContent = titles[name] || name; if (innerWidth < 721) scrollTo(0, 0); }
  function subscribe() { if (state.channel) return; state.channel = db.channel("admin-live-v3").on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, function () { loadAll(true); }).on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, function () { loadAll(true); }).on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, function () { loadAll(true); }).on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, function () { loadAll(true); }).subscribe(); }

  document.querySelectorAll(".nav [data-page]").forEach(function (b) { b.onclick = function () { showPage(b.dataset.page); }; });
  document.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { showPage(b.dataset.go); }; });
  document.querySelectorAll("#vehicleEditorTabs [data-tab]").forEach(function (b) { b.onclick = function () { switchVehicleTab(b.dataset.tab); }; });
  document.querySelectorAll("#vehicleLangTabs [data-lang]").forEach(function (b) { b.onclick = function () { storeCopyFields(); state.copyLang = b.dataset.lang; loadCopyFields(); }; });
  document.querySelectorAll("#contentLangTabs [data-lang]").forEach(function (b) { b.onclick = function () { state.contentLang = b.dataset.lang; renderContent(); }; });
  $("dismissBanner").onclick = function () { document.querySelector(".dev-banner").classList.add("hidden"); };
  $("sidebarToggle").onclick = function () { document.body.classList.toggle("sidebar-collapsed"); localStorage.setItem("aex_sidebar_collapsed", document.body.classList.contains("sidebar-collapsed") ? "1" : "0"); };
  $("refreshBtn").onclick = function () { loadAll(); }; $("quickAddBtn").onclick = $("addVehicleBtn").onclick = function () { openVehicle(); };
  $("closeVehicleBtn").onclick = $("cancelVehicleBtn").onclick = closeVehicle; $("vehicleDrawer").onclick = function (e) { if (e.target === $("vehicleDrawer")) closeVehicle(); };
  $("vehicleForm").onsubmit = saveVehicle; $("deleteVehicleBtn").onclick = deleteVehicle;
  $("vehicleSearch").oninput = renderVehicles; $("vehicleTypeFilter").onchange = renderVehicles; $("vehicleStatusFilter").onchange = renderVehicles;
  $("vFiles").onchange = function () { state.gallery = state.gallery.filter(function (url) { return !/^blob:/i.test(url); }); Array.from($("vFiles").files || []).forEach(function (file) { state.gallery.push(URL.createObjectURL(file)); }); renderGallery(); toast("图片已预览，保存后上传云端"); };
  $("addColorBtn").onclick = function () { var name = value("vColorName"); if (!name) return; state.colors.push({ name: name, hex: $("vColorPicker").value }); setValue("vColorName", ""); renderColors(); };
  $("contentSearch").oninput = renderContent; $("saveContentBtn").onclick = saveContent; $("saveSettingsBtn").onclick = saveSettings;
  $("importVehiclesBtn").onclick = function () { $("vehicleImportFile").click(); }; $("vehicleImportFile").onchange = function () { if (this.files[0]) importVehicles(this.files[0]); this.value = ""; };
  $("exportVehiclesBtn").onclick = exportVehicles; $("exportInquiriesBtn").onclick = exportInquiries; $("backupAllBtn").onclick = backup; $("exportSnapshotBtn").onclick = backup;
  $("clearCacheBtn").onclick = function () { ["aex_site_cache","aex_vehicles_cache"].forEach(function (k) { localStorage.removeItem(k); }); loadAll(); toast("本地缓存已清理"); };
  $("addReplyBtn").onclick = function () { var text = prompt("输入快捷回复"); if (!text) return; var replies = JSON.parse(localStorage.getItem("aex_quick_replies") || "[]"); replies.push(text); localStorage.setItem("aex_quick_replies", JSON.stringify(replies)); renderReplies(); };
  if (window.lucide) window.lucide.createIcons();
  if (localStorage.getItem("aex_sidebar_collapsed") === "1") document.body.classList.add("sidebar-collapsed");
  loadAll(true).then(subscribe).catch(function (e) { toast(formatError(e), true); });
})();
