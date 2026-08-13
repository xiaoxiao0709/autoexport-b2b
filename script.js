/* ============================================================
   China Auto Export B2B — front-end logic
   - Data-driven I18N (fetch data/site.json)
   - Vehicle inventory rendered from data/vehicles.json
   - Combined filter: type chips + search + brand dropdown
   - All original interactions: header, mobile menu, reveal,
     count-up, nav highlight, quote modal, dot world map
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- I18N ---------------- */
  var I18N = null;
  var pendingLang = null;
  var RTL = { ar: true };
  var LANG_CODE = { en: "EN", zh: "中", ar: "العربية", ru: "RU" };

  function applyLang(lang) {
    if (!I18N) { pendingLang = lang; return; }
    var d = I18N[lang] || I18N.en;
    var root = document.documentElement;
    root.lang = lang;
    root.dir = RTL[lang] ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = d[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = d[el.dataset.i18nPh];
      if (v != null) el.setAttribute("placeholder", v);
    });
    var label = document.getElementById("langLabel");
    if (label) label.textContent = LANG_CODE[lang] || "EN";
    var menu = document.getElementById("langMenu");
    if (menu) menu.querySelectorAll("li").forEach(function (li) {
      li.classList.toggle("active", li.dataset.lang === lang);
    });
    try { localStorage.setItem("aex_lang", lang); } catch (e) {}
    if (location.hash.indexOf("#vehicle/") === 0 && vehicles.length) openVehicleFromHash();
  }

  function setupLangSwitcher() {
    var cur = document.getElementById("langCurrent");
    var menu = document.getElementById("langMenu");
    if (cur && menu) {
      cur.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = menu.classList.toggle("open");
        cur.setAttribute("aria-expanded", open ? "true" : "false");
      });
      menu.querySelectorAll("li").forEach(function (li) {
        li.addEventListener("click", function () {
          applyLang(li.dataset.lang);
          menu.classList.remove("open");
          cur.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("click", function () {
        menu.classList.remove("open");
        cur.setAttribute("aria-expanded", "false");
      });
    }
  }

  /* ---------------- Interactions ---------------- */
  var io;
  function observeReveals(els) {
    if (!io) return;
    els.forEach(function (el) { io.observe(el); });
  }

  function setupInteractions() {
    /* Header state */
    var header = document.getElementById("siteHeader");
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Mobile menu */
    var toggle = document.getElementById("navToggle");
    var menu = document.getElementById("mobileMenu");
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        toggle.classList.remove("open");
        document.body.style.overflow = "";
      });
    });

    /* Reveal on scroll */
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    /* Count-up stats */
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        countIO.unobserve(el);
        var target = +el.dataset.count;
        var dur = 1800;
        var t0 = performance.now();
        var tick = function (now) {
          var p = Math.min((now - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.round(target * eased).toLocaleString("en-US");
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll("[data-count]").forEach(function (el) { countIO.observe(el); });

    /* Nav active state */
    var sections = ["home", "about", "vehicles", "process", "markets", "partnership"];
    var navLinks = document.querySelectorAll(".nav-links a");
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          navLinks.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
          });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) navIO.observe(el);
    });

    /* Quote modal */
    var modal = document.getElementById("quoteModal");
    var modelChip = document.getElementById("modalModel");
    var formWrap = document.getElementById("quoteFormWrap");
    var successBox = document.getElementById("quoteSuccess");
    var lastFocus = null;

    window.__openModal = function (model) {
      lastFocus = document.activeElement;
      modelChip.textContent = model || "General Inquiry — Full Stock List";
      formWrap.style.display = "";
      successBox.classList.remove("show");
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      var first = modal.querySelector("input");
      if (first) setTimeout(function () { first.focus(); }, 250);
    };
    function closeModal() {
      modal.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    document.querySelectorAll("[data-quote]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.__openModal(btn.dataset.model); });
    });
    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
    document.getElementById("quoteForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      formWrap.style.display = "none";
      successBox.classList.add("show");
    });

    /* Dot-matrix world map */
    renderWorldMap();
  }

  function renderWorldMap() {
    var LAND = {
      1: [[6,12],[40,50]], 2: [[3,15],[42,55]], 3: [[1,16],[21,23],[40,60]],
      4: [[3,17],[21,23],[38,62]], 5: [[4,18],[30,39],[38,63]], 6: [[5,18],[29,39],[38,62]],
      7: [[6,18],[30,39],[39,63]], 8: [[7,17],[29,39],[39,62]], 9: [[7,16],[30,38],[38,58]],
      10: [[7,14],[31,37],[38,55]], 11: [[7,13],[38,52],[61,62]], 12: [[8,12],[29,39],[40,56],[61,62]],
      13: [[9,15],[29,40],[42,58]], 14: [[12,19],[29,41],[43,59]], 15: [[15,21],[30,40],[44,59]],
      16: [[16,22],[31,39],[46,60]], 17: [[16,22],[31,38],[52,58]], 18: [[16,23],[31,37],[52,59]],
      19: [[17,23],[31,37],[53,58]], 20: [[17,22],[32,37],[52,59]], 21: [[18,22],[32,36],[51,59]],
      22: [[18,21],[32,35],[52,59]], 23: [[18,21],[33,35],[52,58]], 24: [[18,20],[33,34],[53,57]],
      25: [[18,20],[54,56]], 26: [[19,20]], 27: [[19,20]], 28: [[19,19]]
    };
    var svg = document.getElementById("worldMap");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var g = document.createElementNS(NS, "g");
    var CW = 1000 / 64, CH = 520 / 30;
    var dots = "";
    Object.keys(LAND).forEach(function (row) {
      LAND[row].forEach(function (rng) {
        for (var c = rng[0]; c <= rng[1]; c++) {
          dots += '<circle class="map-land-dot" cx="' + (c * CW + CW / 2).toFixed(1) +
                  '" cy="' + (row * CH + CH / 2).toFixed(1) + '" r="2.3"/>';
        }
      });
    });
    g.innerHTML = dots;
    svg.insertBefore(g, svg.firstChild);
  }

  /* ---------------- Inventory (data-driven) ---------------- */
  var TYPE_KEY = { ev: "car.ev", phev: "car.phev", petrol: "car.petrol" };
  var BODY_KEY = {
    "SUV": "car.suv", "Hatchback": "car.hatch",
    "7-Seat SUV": "car.suv7", "Shooting Brake": "car.shoot"
  };

  var grid = document.getElementById("invGrid");
  var vehicles = [];
  var activeType = "all";
  var searchTerm = "";
  var brandTerm = "all";
  var lastSiteJSON = "";
  var lastVehiclesJSON = "";
  var dataClient = null;
  var siteSettings = null;
  var dataChannel = null;
  var VEHICLE_FACTS = {
    "byd-song-plus": { dimensions:"4775 × 1890 × 1670 mm", wheelbase:"2765 mm", seats:"5", battery:"Blade Battery / DM-i", transmission:"E-CVT", price:"USD 18,900–24,500 FOB" },
    "byd-seagull": { dimensions:"3780 × 1715 × 1540 mm", wheelbase:"2500 mm", seats:"4", battery:"30.08 / 38.88 kWh LFP", transmission:"Single-speed EV", price:"USD 9,500–12,500 FOB" },
    "chery-tiggo8-pro": { dimensions:"4722 × 1860 × 1745 mm", wheelbase:"2710 mm", seats:"5 / 7", battery:"Petrol", transmission:"7-speed DCT", price:"USD 17,800–23,800 FOB" },
    "geely-monjaro": { dimensions:"4770 × 1895 × 1689 mm", wheelbase:"2845 mm", seats:"5", battery:"Petrol", transmission:"8-speed AT", price:"USD 22,500–28,900 FOB" },
    "haval-h6": { dimensions:"4683 × 1886 × 1730 mm", wheelbase:"2738 mm", seats:"5", battery:"Petrol", transmission:"7-speed DCT", price:"USD 14,800–20,800 FOB" },
    "zeekr-001": { dimensions:"4977 × 1999 × 1533 mm", wheelbase:"3005 mm", seats:"5", battery:"95 / 100 kWh", transmission:"Single-speed EV", price:"USD 39,800–52,800 FOB" }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }

  function yearIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>';
  }
  function typeIcon(type) {
    if (type === "petrol") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V9l4-4h6l4 4v12"/><path d="M9 21v-6h6v6"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>';
  }
  function bodyIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18M5 17l1.5-5.5A2 2 0 0 1 8.4 10h7.2a2 2 0 0 1 1.9 1.5L19 17"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>';
  }

  function cardHTML(v, i) {
    var typeKey = TYPE_KEY[v.type] || "car.petrol";
    var bodyKey = BODY_KEY[v.bodyType] || null;
    var bodyLabel = bodyKey
      ? '<span data-i18n="' + bodyKey + '">' + escapeHtml(v.bodyType) + "</span>"
      : escapeHtml(v.bodyType);
    return '<article class="car-card reveal" data-vehicle-id="' + escapeAttr(v.id) + '" data-type="' + escapeAttr(v.type) +
      '" data-brand="' + escapeAttr(v.brand) + '" data-name="' + escapeAttr(v.name) +
      '" style="--i:' + (i % 3) + '">' +
      '<div class="car-media" role="link" tabindex="0" aria-label="View ' + escapeAttr(v.brand + " " + v.name) + '">' +
        '<img src="' + escapeAttr(v.image) + '" alt="' + escapeAttr(v.brand + " " + v.name) + '" loading="lazy">' +
        '<span class="car-status"><span data-i18n="inv.status">Export Ready</span></span>' +
      "</div>" +
      '<div class="car-body">' +
        "<div><div class=\"car-brand\">" + escapeHtml(v.brand) + "</div>" +
        '<h3 class="car-name">' + escapeHtml(v.name) + "</h3></div>" +
        '<div class="car-meta">' +
          "<span>" + yearIcon() + '<span data-i18n="car.year">' + escapeHtml(v.year) + "</span></span>" +
          "<span>" + typeIcon(v.type) + '<span data-i18n="' + typeKey + '">' + escapeHtml(v.type) + "</span></span>" +
          "<span>" + bodyIcon() + bodyLabel + "</span>" +
        "</div>" +
        (function () {
          var specs = [v.range, v.power, v.drivetrain].filter(Boolean).map(function (s) {
            return '<span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;font-size:11px;color:#475569">' + escapeHtml(s) + "</span>";
          }).join("");
          var specsHtml = specs ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + specs + "</div>" : "";
          var market = (v.marketZh || v.marketEn) ? '<div style="margin-top:6px;font-size:11px;color:#94a3b8">目标市场 / Market: ' + escapeHtml(v.marketZh || v.marketEn) + "</div>" : "";
          return specsHtml + market;
        })() +
        '<div class="car-foot">' +
          '<div class="car-stock"><span data-i18n="car.available">Available</span><b>' +
            '<span class="car-stock-num">' + escapeHtml(v.stock) + '</span> ' +
            '<span data-i18n="car.units">Units</span></b></div>' +
          '<button class="btn btn-price" data-quote data-model="' +
            escapeAttr(v.brand + " " + v.name + " " + v.year) + '">' +
            '<span data-i18n="car.request">Request Price</span></button>' +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function renderVehicles() {
    var live = vehicles.filter(function (v) { return v.published !== false; });
    grid.innerHTML = live.map(cardHTML).join("");
    grid.querySelectorAll("[data-quote]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.__openModal(btn.dataset.model); });
    });
    grid.querySelectorAll("[data-vehicle-id]").forEach(function (card) {
      var open = function () {
        card.style.transform = "scale(.97)";
        setTimeout(function () { window.location.href = "vehicle.html?id=" + encodeURIComponent(card.dataset.vehicleId); }, 140);
      };
      card.addEventListener("click", function (event) {
        if (!event.target.closest("button, a, input, select")) open();
      });
      card.querySelector(".car-media").addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
    });
    observeReveals(grid.querySelectorAll(".reveal"));
    applyFilters();
    openVehicleFromHash();
  }

  function vehicleDescription(v) {
    return v.detailEn || v.descEn || v.description ||
      (v.brand + " " + v.name + " is available for dealer and importer orders from China. Multiple trims, exterior colours and shipment options can be matched against current factory and port-side stock.");
  }

  function openVehicleDetail(v) {
    var detail = document.getElementById("vehicleDetail");
    if (!detail || !v) return;
    var gallery = (v.gallery && v.gallery.length ? v.gallery : [v.image]).filter(Boolean);
    var facts = VEHICLE_FACTS[v.id] || {};
    var lang = document.documentElement.lang || "en";
    var zh = lang === "zh", ar = lang === "ar", ru = lang === "ru";
    var labels = zh ? { price:"出口参考价", range:"续航里程", power:"最大功率", drive:"驱动形式", body:"车身形式", year:"车型年份", stock:"现货库存", market:"出口市场", gallery:"车辆图片", notes:"出口说明", quote:"获取出口报价" } : ar ? { price:"السعر التصديري المرجعي", range:"المدى", power:"القدرة", drive:"نظام الدفع", body:"نوع الهيكل", year:"سنة الطراز", stock:"المخزون", market:"الأسواق", gallery:"معرض الصور", notes:"ملاحظات التصدير", quote:"طلب عرض سعر" } : ru ? { price:"Экспортная цена", range:"Запас хода", power:"Мощность", drive:"Привод", body:"Тип кузова", year:"Год модели", stock:"В наличии", market:"Рынки", gallery:"Галерея", notes:"Условия экспорта", quote:"Запросить цену" } : { price:"Export reference", range:"Range", power:"Power", drive:"Drivetrain", body:"Body type", year:"Model year", stock:"Stock", market:"Markets", gallery:"Vehicle Gallery", notes:"Export Notes", quote:"Request Export Quote" };
    var desc = zh ? (v.detailZh || v.descZh || v.description || (v.brand + " " + v.name + " 面向海外经销商和进口商供应。我们可根据采购数量、配置、颜色和目的港匹配中国工厂及港口现货。")) : (ar ? (v.detailAr || v.detailEn || vehicleDescription(v)) : (ru ? (v.detailRu || v.detailEn || vehicleDescription(v)) : vehicleDescription(v)));
    document.getElementById("vehicleDetailTitle").textContent = v.brand + " " + v.name;
    document.getElementById("vehicleDetailEyebrow").textContent = (v.year || "") + " · " + (zh ? "可出口" : (v.status || "Export Ready"));
    document.getElementById("vehicleDetailDescription").textContent = desc;
    var main = document.getElementById("vehicleDetailImage"); main.src = gallery[0]; main.alt = v.brand + " " + v.name;
    var specs = [
      [labels.price, v.exportPrice || facts.price || (zh ? "询价" : "Quote on request")], [labels.range, v.range || "—"],
      [labels.power, v.power || "—"], [labels.drive, v.drivetrain || "—"],
      [labels.body, zh ? (v.categoryZh || v.bodyType || "—") : (v.bodyType || v.categoryEn || "—")], [labels.year, v.year || "—"],
      [labels.stock, (v.stock || 0) + (zh ? " 台" : " units")], [labels.market, zh ? (v.marketZh || "全球") : (v.marketEn || "Global")]
    ];
    document.getElementById("vehicleDetailSpecs").innerHTML = specs.map(function (s) { return '<div class="vehicle-spec"><span>' + escapeHtml(s[0]) + '</span><b>' + escapeHtml(s[1]) + '</b></div>'; }).join("");
    var technical = [
      [zh ? "车身尺寸" : "Dimensions", v.dimensions || facts.dimensions], [zh ? "轴距" : "Wheelbase", v.wheelbase || facts.wheelbase],
      [zh ? "座位数" : "Seats", v.seats || facts.seats], [zh ? "电池/能源" : "Battery / Energy", v.battery || facts.battery],
      [zh ? "变速箱" : "Transmission", v.transmission || facts.transmission]
    ].filter(function (item) { return item[1]; });
    document.getElementById("vehicleDetailSpecs").innerHTML += technical.map(function (s) { return '<div class="vehicle-spec"><span>' + escapeHtml(s[0]) + '</span><b>' + escapeHtml(s[1]) + '</b></div>'; }).join("");
    document.getElementById("vehicleDetailGallery").innerHTML = gallery.map(function (src) { return '<button type="button"><img src="' + escapeAttr(src) + '" alt="' + escapeAttr(v.brand + " " + v.name) + '"></button>'; }).join("");
    document.querySelectorAll("#vehicleDetailGallery button").forEach(function (button) { button.onclick = function () { main.style.opacity = "0"; setTimeout(function () { main.src = button.querySelector("img").src; main.style.opacity = "1"; }, 180); }; });
    document.getElementById("vehicleDetailGalleryTitle").textContent = labels.gallery;
    document.getElementById("vehicleDetailNotesTitle").textContent = labels.notes;
    document.getElementById("vehicleDetailQuoteText").textContent = labels.quote;
    document.getElementById("vehicleDetailNotes").textContent = v.exportNotes || (zh ? "参考价格基于中国当前出口库存，不含目的国关税及当地费用。最终 FOB/CIF 价格取决于配置、采购数量、颜色、生产日期、目的港和船期。请联系我们获取最新形式发票及验车资料。" : "Reference price is based on current China export inventory and excludes destination customs duties. Final FOB/CIF pricing depends on trim, quantity, colour, production date, destination port and freight schedule. Contact our team for a current proforma quotation and inspection package.");
    document.getElementById("vehicleDetailWhatsApp").href = "https://wa.me/8619310192287?text=" + encodeURIComponent("I am interested in " + v.brand + " " + v.name + " " + (v.year || ""));
    document.getElementById("vehicleDetailQuote").onclick = function () { closeVehicleDetail(false); window.__openModal(v.brand + " " + v.name + " " + (v.year || "")); };
    detail.classList.add("open"); detail.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  }

  function closeVehicleDetail(clearHash) {
    var detail = document.getElementById("vehicleDetail"); if (!detail) return;
    detail.classList.remove("open"); detail.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
    if (clearHash !== false && location.hash.indexOf("#vehicle/") === 0) history.pushState(null, "", location.pathname + location.search + "#vehicles");
  }

  function openVehicleFromHash() {
    if (location.hash.indexOf("#vehicle/") !== 0) return;
    var id = decodeURIComponent(location.hash.slice(9));
    openVehicleDetail(vehicles.find(function (v) { return String(v.id) === id; }));
  }

  function populateBrands() {
    var sel = document.getElementById("brandFilter");
    if (!sel) return;
    var selected = sel.value || brandTerm;
    while (sel.options.length > 1) sel.remove(1);
    var brands = Array.from(new Set(vehicles.map(function (v) { return v.brand; }))).sort();
    brands.forEach(function (b) {
      var o = document.createElement("option");
      o.value = b; o.textContent = b;
      sel.appendChild(o);
    });
    if (brands.indexOf(selected) > -1) {
      sel.value = selected;
    } else {
      sel.value = "all";
      brandTerm = "all";
    }
  }

  function applyFilters() {
    var cards = grid.querySelectorAll(".car-card");
    var visible = 0;
    cards.forEach(function (card) {
      var type = card.dataset.type;
      var brand = card.dataset.brand;
      var name = card.dataset.name;
      var matchType = activeType === "all" || type === activeType;
      var matchBrand = brandTerm === "all" || brand === brandTerm;
      var matchSearch = !searchTerm ||
        (brand + " " + name).toLowerCase().indexOf(searchTerm) !== -1;
      var show = matchType && matchBrand && matchSearch;
      card.classList.toggle("hide", !show);
      if (show) visible++;
    });
    var empty = document.getElementById("invEmpty");
    if (!empty) {
      empty = document.createElement("p");
      empty.id = "invEmpty";
      empty.className = "inv-empty";
      empty.setAttribute("data-i18n", "inv.empty");
      empty.textContent = "No vehicles match your filters.";
      grid.parentNode.insertBefore(empty, grid.nextSibling);
    }
    empty.style.display = visible ? "none" : "";
  }

  function setupFilters() {
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeType = chip.dataset.filter;
        applyFilters();
      });
    });
    var search = document.getElementById("carSearch");
    if (search) search.addEventListener("input", function () {
      searchTerm = search.value.trim().toLowerCase();
      applyFilters();
    });
    var brand = document.getElementById("brandFilter");
    if (brand) brand.addEventListener("change", function () {
      brandTerm = brand.value;
      applyFilters();
    });
  }

  /* ---------------- Data loading ---------------- */
  function fetchJSON(path, version) {
    return fetch(path + "?v=" + version, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function getDataClient() {
    if (dataClient) return dataClient;
    var cfg = window.AUTOEXPORT_SUPABASE;
    if (!cfg || !window.supabase) return null;
    dataClient = window.supabase.createClient(cfg.url, cfg.publishableKey);
    return dataClient;
  }

  function fetchSiteData(version) {
    var client = getDataClient();
    if (!client) {
      return Promise.all([
        fetchJSON("data/site.json", version),
        fetchJSON("data/vehicles.json", version),
        fetchJSON("data/config.json", version)
      ]);
    }
    return Promise.all([
      client.from("site_content").select("content").eq("id", "main").single(),
      client.from("vehicles").select("id,data,published,sort_order").order("sort_order"),
      client.from("site_settings").select("business_name,whatsapp,email").eq("id", "main").single()
    ]).then(function (results) {
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;
      if (results[2].error) throw results[2].error;
      return [
        results[0].data.content,
        results[1].data.map(function (row) {
          return Object.assign({}, row.data, { id: row.id, published: row.published });
        }),
        results[2].data
      ];
    });
  }

  function applySiteSettings(settings) {
    if (!settings) return;
    var rawPhone = settings.whatsapp || "";
    var digits = rawPhone.replace(/[^0-9]/g, "");
    var phoneText = rawPhone;
    if (digits === "8619310192287") phoneText = "+86 193 1019 2287";
    else if (digits && rawPhone.indexOf("+") !== 0) phoneText = "+" + digits;
    document.querySelectorAll("[data-contact-whatsapp]").forEach(function (link) {
      if (digits) link.href = "https://wa.me/" + digits;
    });
    document.querySelectorAll("[data-contact-phone]").forEach(function (el) {
      if (phoneText) el.textContent = phoneText;
    });
    document.querySelectorAll("[data-contact-email]").forEach(function (link) {
      if (!settings.email) return;
      link.href = "mailto:" + settings.email;
      link.textContent = settings.email;
    });
  }

  function subscribeToData() {
    var client = getDataClient();
    if (!client || dataChannel) return;
    dataChannel = client.channel("public-site-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, function () { loadData(true); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, function () { loadData(true); })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, function () { loadData(true); })
      .subscribe();
  }

  function loadData(silent) {
    var version = Date.now();
    fetchSiteData(version).then(function (res) {
      var siteJSON = JSON.stringify(res[0]);
      var vehiclesJSON = JSON.stringify(res[1]);
      var vehiclesChanged = vehiclesJSON !== lastVehiclesJSON;
      I18N = res[0];
      siteSettings = res[2];
      lastSiteJSON = siteJSON;
      lastVehiclesJSON = vehiclesJSON;
      var saved = "en";
      try { saved = localStorage.getItem("aex_lang") || "en"; } catch (e) {}
      applyLang(pendingLang || saved);
      applySiteSettings(siteSettings);
      if (vehiclesChanged) {
        vehicles = res[1];
        populateBrands();
        renderVehicles();
      }
    }).catch(function (err) {
      console.error("Failed to load site data:", err);
      if (!silent && grid) {
        grid.innerHTML = '<p class="inv-empty">Failed to load vehicle data. ' +
          "Please run the site from a local server (e.g. <code>python -m http.server</code>).</p>";
      }
    });
  }

  /* ---------------- Init ---------------- */
  function init() {
    setupLangSwitcher();
    setupInteractions();
    setupFilters();
    loadData();
    subscribeToData();
    setInterval(function () { loadData(true); }, 30000);
    window.addEventListener("focus", function () { loadData(true); });
    window.addEventListener("hashchange", openVehicleFromHash);
    var detailClose = document.getElementById("vehicleDetailClose");
    if (detailClose) detailClose.onclick = function () { closeVehicleDetail(true); };
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadData(true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
