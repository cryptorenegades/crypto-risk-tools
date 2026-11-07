/*
 * Crypto Risk Tools: page wiring. Reads the form, runs the view, updates the page,
 * keeps the inputs in the URL so a result can be shared, and handles the copy buttons.
 * No network requests, no cookies, no storage.
 */
(function () {
  "use strict";
  // Mobile tools menu: close on Escape or a click outside.
  var menu = document.querySelector(".menu");
  if (menu) {
    document.addEventListener("click", function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary").focus();
      }
    });
  }
  var printBtn = document.getElementById("print");
  if (printBtn)
    printBtn.addEventListener("click", function () {
      window.print();
    });

  var V = window.CRViews;
  var form = document.querySelector("form[data-tool]");
  if (!form || !V) return;
  var tool = V[form.getAttribute("data-tool")];
  var keys = tool.keys;
  var touched = {};
  var last = null;
  var live = document.getElementById("live");
  var liveTimer = null;

  function field(k) {
    return form.elements[k];
  }

  function getVal(k) {
    var el = field(k);
    if (!el) return "";
    if (el instanceof RadioNodeList || (el.length && el[0] && el[0].type === "radio")) {
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return "";
    }
    return el.value;
  }

  function setVal(k, v) {
    var el = field(k);
    if (!el) return;
    if (el instanceof RadioNodeList || (el.length && el[0] && el[0].type === "radio")) {
      for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === v;
    } else el.value = v;
  }

  function read() {
    var st = {};
    keys.forEach(function (k) {
      st[k] = getVal(k);
    });
    return st;
  }

  // "50,000", "$50000" and "50000" are the same value.
  function norm(v) {
    var n = window.CRCalc.parseNumber(v);
    return Number.isFinite(n) ? String(n) : String(v).trim();
  }

  function isDefault(st) {
    return keys.every(function (k) {
      return norm(st[k]) === norm(tool.defaults[k]);
    });
  }

  function shareUrl(st) {
    if (isDefault(st)) return location.origin + location.pathname;
    var q = new URLSearchParams();
    keys.forEach(function (k) {
      var v = norm(st[k]);
      if (v !== "") q.set(k, v);
    });
    return location.origin + location.pathname + "?" + q.toString();
  }

  function apply(view) {
    Object.keys(view.text).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.textContent !== view.text[id]) el.textContent = view.text[id];
    });
    Object.keys(view.hidden).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.toggleAttribute("hidden", !!view.hidden[id]); // works for SVG elements too
    });
    Object.keys(view.style).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var attrs = view.style[id];
      Object.keys(attrs).forEach(function (a) {
        if (a === "width" && el instanceof HTMLElement) el.style.width = attrs[a];
        else el.setAttribute(a, typeof attrs[a] === "number" ? attrs[a].toFixed(1) : attrs[a]);
      });
    });
  }

  function showErrors(errors, st) {
    var byField = {};
    errors.forEach(function (e) {
      // A blank field the visitor has not left yet stays quiet; the panel already says what is missing.
      var blank = String(st[e.field] || "").trim() === "";
      if (blank && !touched[e.field]) return;
      if (!byField[e.field]) byField[e.field] = e.message;
    });
    keys.forEach(function (k) {
      var box = document.getElementById(k + "-error");
      var el = field(k);
      if (!box || !el || el.length) return;
      var msg = byField[k];
      box.textContent = msg || "";
      box.hidden = !msg;
      if (msg) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    });
  }

  function announce(text) {
    if (!live) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      live.textContent = text;
    }, 700);
  }

  function run(writeUrl) {
    var st = read();
    var url = shareUrl(st);
    var view = tool.view(st, url);
    apply(view);
    showErrors(view.errors, st);
    last = { st: st, view: view, url: url };
    if (writeUrl) {
      try {
        history.replaceState(null, "", isDefault(st) ? location.pathname : url.slice(location.origin.length));
      } catch (e) {
        /* file:// previews can refuse replaceState; the tool still works */
      }
    }
    return view;
  }

  // Load shared state from the URL.
  var params = new URLSearchParams(location.search);
  keys.forEach(function (k) {
    if (params.has(k)) setVal(k, params.get(k));
  });

  form.addEventListener("input", function () {
    run(true);
    announce(last.view.announce);
  });
  form.addEventListener("change", function () {
    run(true);
  });
  // Controls placed elsewhere on the page but tied to this form with the form="" attribute.
  if (form.id)
    document.querySelectorAll('[form="' + form.id + '"]').forEach(function (el) {
      el.addEventListener("change", function () {
        run(true);
        announce(last.view.announce);
      });
    });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(true);
  });
  form.addEventListener(
    "blur",
    function (e) {
      if (e.target && e.target.name) {
        touched[e.target.name] = true;
        // Dollar fields get thousands separators once the visitor leaves them.
        if (e.target.closest && e.target.closest(".has-pre")) {
          var n = window.CRCalc.parseNumber(e.target.value);
          if (Number.isFinite(n) && n >= 1000) e.target.value = n.toLocaleString("en-US", { maximumFractionDigits: 8 });
        }
        run(false);
      }
    },
    true
  );

  var reset = document.getElementById("reset");
  if (reset)
    reset.addEventListener("click", function () {
      keys.forEach(function (k) {
        setVal(k, tool.defaults[k]);
      });
      touched = {};
      run(true);
      announce("Example restored. " + last.view.announce);
    });

  // Quick-pick chips: <button data-set-field="lossPct" data-set-value="50">
  document.querySelectorAll("[data-set-field]").forEach(function (b) {
    b.addEventListener("click", function () {
      setVal(b.getAttribute("data-set-field"), b.getAttribute("data-set-value"));
      run(true);
      announce(last.view.announce);
    });
  });

  // Copy buttons
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }
  var status = document.getElementById("copy-status");
  var statusTimer = null;
  function flash(msg) {
    if (!status) return;
    status.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      status.textContent = "";
    }, 2500);
  }
  var copyBtn = document.getElementById("copy-results");
  if (copyBtn)
    copyBtn.addEventListener("click", function () {
      if (!last || !last.view.copy) return flash("Fix the fields first");
      copyText(last.view.copy).then(
        function () {
          flash("Results copied");
        },
        function () {
          flash("Copy blocked by the browser");
        }
      );
    });
  var linkBtn = document.getElementById("copy-link");
  if (linkBtn)
    linkBtn.addEventListener("click", function () {
      copyText(last ? last.url : location.href).then(
        function () {
          flash("Link copied");
        },
        function () {
          flash("Copy blocked by the browser");
        }
      );
    });

  run(false);
})();
