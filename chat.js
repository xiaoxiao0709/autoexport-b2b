/* ============================================================
   Auto Export — front-end live chat widget ("临时聊天")
   Visitors start a conversation; messages are stored as a
   GitHub Issue (label: chat) using a scoped chat token from
   data/config.json. The admin console replies as issue comments,
   and this widget polls to show 客服 replies in real time.
   Without a chat token configured, it falls back to WhatsApp/email.
   ============================================================ */
(function () {
  "use strict";
  var API = "https://api.github.com";
  var POLL_MS = 10000;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function repoFromLocation() {
    var h = location.hostname, p = location.pathname.split("/").filter(Boolean);
    if (h && h.indexOf(".github.io") > -1) {
      var owner = h.split(".")[0];
      var repo = (h === "github.io") ? owner : (p[0] || owner);
      return { owner: owner, repo: repo };
    }
    return { owner: "xiaoxiao0709", repo: "autoexport-b2b" };
  }

  function gh(path, token, method, body) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) h["Authorization"] = "Bearer " + token;
    return fetch(API + path, { method: method || "GET", headers: h, body: body ? JSON.stringify(body) : undefined });
  }

  function storeKey() { var r = repoFromLocation(); return "aex_chat_" + r.owner + "_" + r.repo; }
  function loadStore() { try { return JSON.parse(localStorage.getItem(storeKey())) || null; } catch (e) { return null; } }
  function saveStore(s) { try { localStorage.setItem(storeKey(), JSON.stringify(s)); } catch (e) {} }

  var cfg = null, store = loadStore(), pollTimer = null;

  /* ---------- widget DOM ---------- */
  var root, panel, threadEl, inputEl, nameEl, contactEl, sendBtn, headEl;
  function buildWidget() {
    var style = el("style");
    style.textContent =
      ".aex-chat-btn{position:fixed;right:20px;bottom:20px;z-index:60;display:flex;align-items:center;gap:8px;background:#1f3a8a;color:#fff;border:none;border-radius:999px;padding:13px 18px;font:600 14px system-ui;box-shadow:0 8px 24px rgba(16,24,40,.25);cursor:pointer}" +
      ".aex-chat-btn:hover{background:#2742a6}" +
      ".aex-chat-panel{position:fixed;right:20px;bottom:80px;z-index:60;width:330px;max-width:calc(100vw - 32px);height:440px;max-height:calc(100vh - 110px);background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 48px rgba(16,24,40,.22);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif}" +
      ".aex-chat-panel.open{display:flex}" +
      ".aex-chat-head{background:#1f3a8a;color:#fff;padding:13px 15px;display:flex;justify-content:space-between;align-items:center}" +
      ".aex-chat-head b{font-size:14px}.aex-chat-head small{opacity:.8;font-weight:400}" +
      ".aex-chat-head .x{cursor:pointer;font-size:18px;line-height:1}" +
      ".aex-chat-thread{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}" +
      ".aex-msg{padding:8px 12px;border-radius:12px;max-width:82%;font-size:13px;white-space:pre-wrap;word-break:break-word;line-height:1.45}" +
      ".aex-msg.me{background:#1f3a8a;color:#fff;align-self:flex-end;border-bottom-right-radius:3px}" +
      ".aex-msg.them{background:#fff;border:1px solid #e2e8f0;align-self:flex-start;border-bottom-left-radius:3px}" +
      ".aex-chat-foot{padding:10px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;background:#fff}" +
      ".aex-chat-foot input,.aex-chat-foot textarea{width:100%;padding:9px 11px;border:1px solid #e2e8f0;border-radius:9px;font:inherit;box-sizing:border-box}" +
      ".aex-chat-foot textarea{min-height:42px;resize:vertical}" +
      ".aex-chat-foot button{background:#1f3a8a;color:#fff;border:none;border-radius:9px;padding:9px;font-weight:600;cursor:pointer}" +
      ".aex-chat-fallback{text-align:center;font-size:13px;color:#64748b;padding:14px}" +
      ".aex-chat-fallback a{display:inline-block;margin:6px 4px;padding:8px 14px;border-radius:9px;background:#eef2ff;color:#1f3a8a;text-decoration:none;font-weight:600}" +
      ".aex-chat-hint{font-size:11px;color:#94a3b8;text-align:center}";
    document.head.appendChild(style);

    var btn = el("button", "aex-chat-btn");
    btn.innerHTML = "💬 <span>在线咨询</span>";
    btn.onclick = toggle;

    panel = el("div", "aex-chat-panel");
    headEl = el("div", "aex-chat-head", "<div><b>在线咨询</b><br><small>Live Chat · 客服通常几分钟内回复</small></div><div class='x'>×</div>");
    headEl.querySelector(".x").onclick = toggle;
    threadEl = el("div", "aex-chat-thread");
    var foot = el("div", "aex-chat-foot");
    nameEl = el("input"); nameEl.placeholder = "您的称呼（必填）";
    contactEl = el("input"); contactEl.placeholder = "WhatsApp / 邮箱（选填，方便回拨）";
    inputEl = el("textarea"); inputEl.placeholder = "输入消息…";
    sendBtn = el("button"); sendBtn.textContent = "发送";
    sendBtn.onclick = onSend;
    foot.appendChild(nameEl); foot.appendChild(contactEl); foot.appendChild(inputEl); foot.appendChild(sendBtn);
    panel.appendChild(headEl); panel.appendChild(threadEl); panel.appendChild(foot);

    root = el("div");
    root.appendChild(btn); root.appendChild(panel);
    document.body.appendChild(root);
  }

  function toggle() { panel.classList.toggle("open"); if (panel.classList.contains("open")) render(); }

  function render() {
    threadEl.innerHTML = "";
    if (!cfg) { threadEl.appendChild(el("div", "aex-chat-hint", "加载中…")); return; }
    if (!cfg.chatToken) { renderFallback(); return; }
    if (!store || !store.num) { renderStartForm(); return; }
    renderThread();
    startPoll();
  }

  function renderFallback() {
    var wa = cfg.whatsapp ? ("https://wa.me/" + cfg.whatsapp.replace(/[^0-9]/g, "")) : "";
    var mail = cfg.email ? ("mailto:" + cfg.email) : "";
    var html = '<div class="aex-chat-fallback">在线客服暂未配置。<br>您可以通过以下方式直接联系我们：';
    if (wa) html += '<br><a href="' + wa + '" target="_blank" rel="noopener">WhatsApp 联系</a>';
    if (mail) html += '<a href="' + mail + '">发送邮件</a>';
    if (!wa && !mail) html += '<br>请在后台 Settings 中填写 WhatsApp / Email。';
    html += '</div>';
    threadEl.innerHTML = html;
    nameEl.style.display = contactEl.style.display = inputEl.style.display = sendBtn.style.display = "none";
  }

  function renderStartForm() {
    nameEl.style.display = contactEl.style.display = "block";
    inputEl.style.display = "block"; inputEl.placeholder = "输入您的第一条消息…";
    sendBtn.style.display = "block"; sendBtn.textContent = "开始对话";
    threadEl.innerHTML = '<div class="aex-chat-hint">留下称呼与消息，我们的客服会尽快回复您。</div>';
  }

  function renderThread() {
    nameEl.style.display = contactEl.style.display = "none";
    inputEl.style.display = "block"; inputEl.placeholder = "回复消息…";
    sendBtn.style.display = "block"; sendBtn.textContent = "发送";
    threadEl.innerHTML = "";
    threadEl.appendChild(msg("me", store.first || "(对话已开始)"));
    (store.comments || []).forEach(function (c) {
      var me = store.sent && store.sent.indexOf(c.body) > -1;
      threadEl.appendChild(msg(me ? "me" : "them", c.body));
    });
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function msg(side, text) { return el("div", "aex-msg " + side, esc(text)); }

  function onSend() {
    var text = inputEl.value.trim();
    if (!text) return;
    if (!cfg.chatToken) { renderFallback(); return; }
    if (!store || !store.num) {
      var name = (nameEl.value || "").trim() || "访客";
      var contact = (contactEl.value || "").trim();
      var body = "👤 访客：" + name + (contact ? "\n📞 联系方式：" + contact : "") + "\n\n💬 消息：\n" + text;
      sendBtn.disabled = true;
      gh("/repos/" + repoFromLocation().owner + "/" + repoFromLocation().repo + "/issues", cfg.chatToken, "POST",
        { title: "Chat: " + text.slice(0, 40), body: body, labels: ["chat"] })
        .then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.message); }); return r.json(); })
        .then(function (issue) {
          store = { num: issue.number, name: name, first: text, comments: [], sent: [text] };
          saveStore(store); inputEl.value = ""; sendBtn.disabled = false;
          renderThread(); startPoll();
        })
        .catch(function (err) { sendBtn.disabled = false; alert("发送失败：" + err.message); });
    } else {
      gh("/repos/" + repoFromLocation().owner + "/" + repoFromLocation().repo + "/issues/" + store.num + "/comments", cfg.chatToken, "POST", { body: text })
        .then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.message); }); return r.json(); })
        .then(function () {
          store.sent = store.sent || []; store.sent.push(text);
          inputEl.value = ""; refreshThread();
        })
        .catch(function (err) { alert("发送失败：" + err.message); });
    }
  }

  function startPoll() { if (pollTimer) return; pollTimer = setInterval(refreshThread, POLL_MS); }
  function refreshThread() {
    if (!store || !store.num || !cfg || !cfg.chatToken) return;
    gh("/repos/" + repoFromLocation().owner + "/" + repoFromLocation().repo + "/issues/" + store.num + "/comments", cfg.chatToken)
      .then(function (r) { if (!r.ok) throw new Error("poll failed"); return r.json(); })
      .then(function (comments) {
        store.comments = comments.map(function (c) { return { body: c.body, user: c.user ? c.user.login : "" }; });
        saveStore(store);
        if (panel.classList.contains("open")) renderThread();
      }).catch(function () {});
  }

  /* ---------- init ---------- */
  function init() {
    buildWidget();
    fetch("data/config.json").then(function (r) { return r.json(); }).then(function (c) { cfg = c; if (panel.classList.contains("open")) render(); })
      .catch(function () { cfg = { businessName: "Auto Export", whatsapp: "", email: "", chatToken: "" }; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
