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
    return '<article class="car-card reveal" data-type="' + escapeAttr(v.type) +
      '" data-brand="' + escapeAttr(v.brand) + '" data-name="' + escapeAttr(v.name) +
      '" style="--i:' + (i % 3) + '">' +
      '<div class="car-media">' +
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
    observeReveals(grid.querySelectorAll(".reveal"));
    applyFilters();
  }

  function populateBrands() {
    var sel = document.getElementById("brandFilter");
    if (!sel) return;
    var brands = Array.from(new Set(vehicles.map(function (v) { return v.brand; }))).sort();
    brands.forEach(function (b) {
      var o = document.createElement("option");
      o.value = b; o.textContent = b;
      sel.appendChild(o);
    });
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
  function loadData() {
    Promise.all([
      fetch("data/site.json").then(function (r) { return r.json(); }),
      fetch("data/vehicles.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
      I18N = res[0];
      var saved = "en";
      try { saved = localStorage.getItem("aex_lang") || "en"; } catch (e) {}
      applyLang(pendingLang || saved);
      vehicles = res[1];
      populateBrands();
      renderVehicles();
    }).catch(function (err) {
      console.error("Failed to load site data:", err);
      if (grid) {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
