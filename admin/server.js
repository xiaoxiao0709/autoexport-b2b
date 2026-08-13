(function () {
  "use strict";
  var cfg = window.AUTOEXPORT_SUPABASE;
  var db = window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true } });
  var state = { vehicles: [], content: null, settings: null, inquiries: [], editingId: null, channel: null, dev: new URLSearchParams(location.search).get("dev") === "1" };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var slug = function (value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };

  function toast(message, error) {
    var el = $("toast"); el.textContent = message; el.className = "toast" + (error ? " error" : "");
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { el.className = "toast hidden"; }, 3000);
  }

  function showLogin(message) {
    $("loginView").classList.remove("hidden"); $("passwordView").classList.add("hidden"); $("adminView").classList.add("hidden");
    $("loginError").textContent = message || "";
  }

  function showPasswordSetup(session) {
    if (!session || !session.user) return showLogin("邀请链接无效或已过期，请重新发送邀请");
    $("loginView").classList.add("hidden"); $("passwordView").classList.remove("hidden"); $("adminView").classList.add("hidden");
    $("passwordError").textContent = "";
  }

  async function enterAdmin(session) {
    if (!state.dev && (!session || !session.user || session.user.app_metadata.role !== "admin")) {
      if (session) await db.auth.signOut();
      showLogin("该账号没有管理员权限"); return;
    }
    $("loginView").classList.add("hidden"); $("passwordView").classList.add("hidden"); $("adminView").classList.remove("hidden");
    await loadAll(); subscribe(); if (window.lucide) window.lucide.createIcons();
  }

  async function loadAll() {
    var results = await Promise.all([
      db.from("vehicles").select("id,data,published,sort_order").order("sort_order"),
      db.from("site_content").select("content").eq("id", "main").single(),
      db.from("site_settings").select("*").eq("id", "main").single(),
      state.dev ? Promise.resolve({ data: [], error: null }) : db.from("inquiries").select("*").order("created_at", { ascending: false })
    ]);
    var failed = results.find(function (r) { return r.error; }); if (failed) { toast(failed.error.message, true); return; }
    state.vehicles = results[0].data.map(function (row) { return Object.assign({}, row.data, { id: row.id, published: row.published, sort_order: row.sort_order }); });
    state.content = results[1].data.content; state.settings = results[2].data; state.inquiries = results[3].data;
    renderAll();
  }

  function renderAll() { renderStats(); renderVehicles(); renderContent(); renderSettings(); renderInquiries(); }
  function renderStats() {
    $("statVehicles").textContent = state.vehicles.length;
    $("statPublished").textContent = state.vehicles.filter(function (v) { return v.published !== false; }).length;
    $("statStock").textContent = state.vehicles.reduce(function (sum, v) { return sum + (+v.stock || 0); }, 0);
    $("statInquiries").textContent = state.inquiries.filter(function (v) { return v.status === "new"; }).length;
  }

  function renderVehicles() {
    var rows = $("vehicleRows"); rows.innerHTML = ""; $("vehicleEmpty").classList.toggle("hidden", state.vehicles.length > 0);
    state.vehicles.forEach(function (v) {
      var tr = document.createElement("tr");
      var stockClass = (+v.stock || 0) < 10 ? " style=\"color:#b42318;font-weight:800\"" : ((+v.stock || 0) < 20 ? " style=\"color:#b54708;font-weight:800\"" : "");
      tr.innerHTML = '<td><img src="' + esc(v.image || "") + '" alt=""></td><td><b>' + esc(v.brand) + '</b><br>' + esc(v.name) + '</td><td>' + esc(v.type) + '</td><td>' + esc(v.year) + '</td><td' + stockClass + '>' + esc(v.stock) + '</td><td><button class="badge ' + (v.published === false ? "off" : "") + '" data-toggle="' + esc(v.id) + '">' + (v.published === false ? "已下架" : "已上架") + '</button></td><td><div class="actions"><button class="icon-btn" data-edit="' + esc(v.id) + '" title="编辑"><i data-lucide="pencil"></i></button><button class="icon-btn" data-delete="' + esc(v.id) + '" title="删除"><i data-lucide="trash-2"></i></button></div></td>';
      rows.appendChild(tr);
    });
    rows.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openVehicle(b.dataset.edit); }; });
    rows.querySelectorAll("[data-toggle]").forEach(function (b) { b.onclick = function () { toggleVehicle(b.dataset.toggle); }; });
    rows.querySelectorAll("[data-delete]").forEach(function (b) { b.onclick = function () { deleteVehicle(b.dataset.delete); }; });
    if (window.lucide) window.lucide.createIcons();
  }

  function blankVehicle() { return { brand: "", name: "", type: "ev", year: 2025, bodyType: "SUV", stock: 1, range: "", power: "", drivetrain: "", marketZh: "", marketEn: "", status: "Export Ready", image: "", gallery: [], descZh: "", descEn: "", detailAr: "", detailRu: "", highlights: {}, features: [], colors: [], published: true }; }
  function openVehicle(id) {
    var v = id ? state.vehicles.find(function (item) { return item.id === id; }) : blankVehicle(); state.editingId = id || null;
    $("vehicleModalTitle").textContent = id ? "编辑车辆" : "新增车辆";
    [["vBrand","brand"],["vName","name"],["vType","type"],["vYear","year"],["vBody","bodyType"],["vStock","stock"],["vRange","range"],["vPower","power"],["vDrivetrain","drivetrain"],["vDimensions","dimensions"],["vWheelbase","wheelbase"],["vSeats","seats"],["vBattery","battery"],["vEngine","engine"],["vTransmission","transmission"],["vWarranty","warranty"],["vTires","tires"],["vExportPrice","exportPrice"],["vMarketZh","marketZh"],["vMarketEn","marketEn"],["vStatus","status"],["vImage","image"],["vDescZh","descZh"],["vDescEn","descEn"],["vDetailAr","detailAr"],["vDetailRu","detailRu"],["vExportNotes","exportNotes"]].forEach(function (pair) { $(pair[0]).value = v[pair[1]] == null ? "" : v[pair[1]]; });
    $("vHighlights").value = Object.keys(v.highlights || {}).map(function (key) { return key + "|" + v.highlights[key]; }).join("\n");
    $("vFeatures").value = (v.features || []).join(", "); $("vColors").value = (v.colors || []).join(", ");
    $("vPublished").checked = v.published !== false; $("vFile").value = ""; renderPreview(v.gallery || [v.image]); $("vehicleModal").classList.remove("hidden");
  }
  function closeVehicle() { $("vehicleModal").classList.add("hidden"); state.editingId = null; }

  function renderPreview(urls) {
    var root = $("vPreview"); if (!root) return; root.innerHTML = (urls || []).filter(Boolean).map(function (url) { return '<img src="' + esc(url) + '" alt="" style="width:92px;height:64px;object-fit:cover;border:1px solid #d0d5dd;border-radius:6px">'; }).join("");
  }
  async function uploadImages(id, existing) {
    var files = Array.from($("vFile").files || []); if (!files.length) return existing.filter(Boolean);
    var urls = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i]; var ext = (file.name.split(".").pop() || "jpg").toLowerCase(); var path = "vehicles/" + id + "-" + Date.now() + "-" + i + "." + ext;
      var result = await db.storage.from("vehicle-images").upload(path, file, { upsert: false, cacheControl: "31536000" });
      if (result.error) throw result.error;
      urls.push(db.storage.from("vehicle-images").getPublicUrl(path).data.publicUrl);
    }
    return existing.concat(urls);
  }

  async function saveVehicle(event) {
    event.preventDefault();
    if (state.dev) return toast("免登录开发预览模式不可写入，请登录正式后台后保存", true);
    try {
      var old = state.editingId ? state.vehicles.find(function (v) { return v.id === state.editingId; }) : null;
      var id = state.editingId || slug($("vBrand").value + "-" + $("vName").value) || String(Date.now());
      var highlights = {};
      $("vHighlights").value.split(/\r?\n/).map(function (line) { var parts = line.split("|"); if (parts.length > 1 && parts[0].trim()) highlights[parts[0].trim()] = parts.slice(1).join("|").trim(); });
      var data = Object.assign({}, old || {}, { id: id, brand: $("vBrand").value.trim(), name: $("vName").value.trim(), type: $("vType").value, year: +$("vYear").value || 2025, bodyType: $("vBody").value.trim(), stock: +$("vStock").value || 0, range: $("vRange").value.trim(), power: $("vPower").value.trim(), drivetrain: $("vDrivetrain").value.trim(), dimensions: $("vDimensions").value.trim(), wheelbase: $("vWheelbase").value.trim(), seats: $("vSeats").value.trim(), battery: $("vBattery").value.trim(), engine: $("vEngine").value.trim(), transmission: $("vTransmission").value.trim(), warranty: $("vWarranty").value.trim(), tires: $("vTires").value.trim(), exportPrice: $("vExportPrice").value.trim(), marketZh: $("vMarketZh").value.trim(), marketEn: $("vMarketEn").value.trim(), status: $("vStatus").value.trim(), descZh: $("vDescZh").value.trim(), descEn: $("vDescEn").value.trim(), detailAr: $("vDetailAr").value.trim(), detailRu: $("vDetailRu").value.trim(), highlights: highlights, features: $("vFeatures").value.split(",").map(function (item) { return item.trim(); }).filter(Boolean), colors: $("vColors").value.split(",").map(function (item) { return item.trim(); }).filter(Boolean), exportNotes: $("vExportNotes").value.trim(), published: $("vPublished").checked });
      var existingGallery = old && old.gallery ? old.gallery : (old && old.image ? [old.image] : []);
      data.gallery = await uploadImages(id, existingGallery); data.image = data.gallery[0] || $("vImage").value.trim(); delete data.sort_order;
      var order = old ? old.sort_order : state.vehicles.length;
      var result = await db.from("vehicles").upsert({ id: id, data: data, published: data.published, sort_order: order }); if (result.error) throw result.error;
      closeVehicle(); toast("车辆已保存，前端已同步"); await loadAll();
    } catch (error) { toast(error.message, true); }
  }

  async function toggleVehicle(id) {
    if (state.dev) return toast("免登录开发预览模式不可写入，请登录正式后台后操作", true);
    var v = state.vehicles.find(function (item) { return item.id === id; }); var published = v.published === false;
    var data = Object.assign({}, v, { published: published }); delete data.sort_order;
    var result = await db.from("vehicles").update({ published: published, data: data }).eq("id", id); if (result.error) return toast(result.error.message, true); await loadAll();
  }
  async function deleteVehicle(id) { if (state.dev) return toast("免登录开发预览模式不可写入，请登录正式后台后操作", true); if (!confirm("确认删除该车辆？")) return; var result = await db.from("vehicles").delete().eq("id", id); if (result.error) return toast(result.error.message, true); toast("车辆已删除"); await loadAll(); }

  function renderContent() {
    var root = $("contentList"); if (!state.content) return; root.innerHTML = ""; var term = $("contentSearch").value.trim().toLowerCase(); var groups = {};
    Object.keys(state.content.en || {}).forEach(function (key) { if (term && key.toLowerCase().indexOf(term) < 0) return; var group = key.split(".")[0]; (groups[group] = groups[group] || []).push(key); });
    Object.keys(groups).sort().forEach(function (group) {
      var details = document.createElement("details"); details.className = "content-group"; details.open = true; details.innerHTML = "<summary>" + esc(group) + "（" + groups[group].length + "）</summary><div class=\"lang-head\"><span></span><span>英文</span><span>中文</span><span>阿拉伯文</span><span>俄文</span></div>";
      groups[group].forEach(function (key) { var row = document.createElement("div"); row.className = "content-row"; row.innerHTML = '<span class="content-key">' + esc(key) + '</span>' + ["en","zh","ar","ru"].map(function (lang) { return '<input data-lang="' + lang + '" data-key="' + esc(key) + '" value="' + esc((state.content[lang] || {})[key] || "") + '">'; }).join(""); details.appendChild(row); }); root.appendChild(details);
    });
    root.querySelectorAll("input[data-key]").forEach(function (input) { input.oninput = function () { state.content[input.dataset.lang] = state.content[input.dataset.lang] || {}; state.content[input.dataset.lang][input.dataset.key] = input.value; }; });
  }
  async function saveContent() { if (state.dev) return toast("免登录开发预览模式不可写入，请登录正式后台后保存", true); var result = await db.from("site_content").update({ content: state.content, updated_at: new Date().toISOString() }).eq("id", "main"); if (result.error) return toast(result.error.message, true); toast("主页内容已实时更新"); }

  function renderSettings() { if (!state.settings) return; $("settingBusiness").value = state.settings.business_name || ""; $("settingWhatsapp").value = state.settings.whatsapp || ""; $("settingEmail").value = state.settings.email || ""; }
  async function saveSettings(event) { event.preventDefault(); if (state.dev) return toast("免登录开发预览模式不可写入，请登录正式后台后保存", true); var result = await db.from("site_settings").update({ business_name: $("settingBusiness").value.trim(), whatsapp: $("settingWhatsapp").value.trim(), email: $("settingEmail").value.trim(), updated_at: new Date().toISOString() }).eq("id", "main"); if (result.error) return toast(result.error.message, true); toast("联系信息已保存"); }

  function renderInquiries() {
    var rows = $("inquiryRows"); rows.innerHTML = ""; $("inquiryEmpty").classList.toggle("hidden", state.inquiries.length > 0);
    state.inquiries.forEach(function (q) { var tr = document.createElement("tr"); tr.innerHTML = "<td>" + new Date(q.created_at).toLocaleString("zh-CN") + "</td><td>" + esc(q.name) + "</td><td>" + esc(q.company) + "</td><td>" + esc(q.whatsapp || q.email) + "</td><td style=\"white-space:normal;min-width:260px\">" + esc(q.message) + "</td><td>" + esc(q.status) + "</td>"; rows.appendChild(tr); });
  }

  function subscribe() {
    if (state.channel) return; state.channel = db.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, loadAll).subscribe();
  }

  function showPage(name) { document.querySelectorAll(".page").forEach(function (p) { p.classList.toggle("active", p.id === "page-" + name); }); document.querySelectorAll(".nav [data-page]").forEach(function (b) { b.classList.toggle("active", b.dataset.page === name); }); var names = { dashboard: "概览", vehicles: "车辆资源", content: "主页内容", settings: "联系信息", inquiries: "采购询盘" }; $("pageTitle").textContent = names[name]; }

  $("loginForm").onsubmit = async function (event) { event.preventDefault(); $("loginError").textContent = ""; var result = await db.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }); if (result.error) return showLogin("邮箱或密码错误"); enterAdmin(result.data.session); };
  $("passwordForm").onsubmit = async function (event) {
    event.preventDefault();
    var password = $("newPassword").value; var confirmation = $("confirmPassword").value; $("passwordError").textContent = "";
    if (password.length < 8) return $("passwordError").textContent = "密码至少需要 8 位";
    if (password !== confirmation) return $("passwordError").textContent = "两次输入的密码不一致";
    var result = await db.auth.updateUser({ password: password });
    if (result.error) return $("passwordError").textContent = result.error.message;
    var sessionResult = await db.auth.getSession();
    history.replaceState(null, "", location.pathname);
    enterAdmin(sessionResult.data.session);
  };
  $("logoutBtn").onclick = async function () { await db.auth.signOut(); showLogin(); };
  document.querySelectorAll(".nav [data-page]").forEach(function (b) { b.onclick = function () { showPage(b.dataset.page); }; });
  $("addVehicleBtn").onclick = function () { openVehicle(); }; $("closeVehicleBtn").onclick = closeVehicle; $("cancelVehicleBtn").onclick = closeVehicle; $("vehicleForm").onsubmit = saveVehicle;
  $("vFile").onchange = function () { var urls = Array.from($("vFile").files || []).map(function (file) { return URL.createObjectURL(file); }); renderPreview(urls); };
  $("contentSearch").oninput = renderContent; $("saveContentBtn").onclick = saveContent; $("settingsForm").onsubmit = saveSettings;
  db.auth.getSession().then(function (result) {
    if (state.dev) return enterAdmin(null);
    var inviteFlow = /(?:^|[?#&])type=(invite|recovery)(?:&|$)/.test(location.hash + location.search);
    if (inviteFlow) showPasswordSetup(result.data.session);
    else if (result.data.session) enterAdmin(result.data.session);
    else showLogin();
  });
  if (window.lucide) window.lucide.createIcons();
})();
