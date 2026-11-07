/*
 * Crypto Risk Tools: what each tool shows for a given input.
 * Each view turns the inputs into { text, hidden, style, copy, announce } keyed by element id.
 * The page script applies it to the DOM; the site generator uses the same views to
 * pre-render the default results into the HTML, so the first paint is already complete.
 */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./calc.js") : root.CRCalc;
  var usd = C.fmtUsd;
  var pct = C.fmtPct;

  var FOOT = "Education only. Not financial advice.";

  /* ---------- 1. position size ---------- */
  var POSITION_DEFAULTS = { side: "long", account: "50,000", riskPct: "1", entry: "60,000", stop: "57,000", leverage: "5" };

  function position(st, url) {
    var r = C.positionSize(st);
    var x = r.result;
    var levRaw = C.parseNumber(st.leverage);
    var L = x ? x.leverage : C.isBlank(st.leverage) ? 1 : levRaw >= 1 ? levRaw : NaN;
    var t = {};
    var h = {};
    var dash = "-";
    t["p-notional"] = x ? usd(x.notional, 0) : dash;
    t["p-units"] = x ? C.fmtUnits(x.units) + " units at " + usd(C.parseNumber(st.entry)) : r.wrongSide ? "Move the stop to the other side of the entry" : "Enter your numbers to size the position";
    t["p-risk"] = x ? usd(x.riskAmount) : dash;
    t["p-stop"] = x ? pct(x.stopDistancePct) : dash;
    t["p-margin-label"] = Number.isFinite(L) ? "Margin at " + C.fmtLev(L) : "Margin";
    t["p-margin"] = x ? usd(x.margin) : dash;
    t["p-exposure"] = x ? pct(x.exposurePct) : dash;
    if (x && x.leverage > 1) {
      t["p-liq"] = usd(x.liq);
      t["p-liq-sub"] = pct(x.liqDistancePct) + " away, before fees and maintenance margin";
    } else {
      t["p-liq"] = x ? "None at 1x" : dash;
      t["p-liq-sub"] = x ? "No borrowed funds, so no liquidation estimate" : "Shown when leverage is above 1x";
    }
    [0, 1, 2].forEach(function (i) {
      var tg = x && x.targets[i];
      t["p-t" + (i + 1)] = tg ? usd(tg.price) : dash;
      t["p-g" + (i + 1)] = tg ? "+" + usd(tg.reward, 0) + " if reached" : dash;
    });
    var checks = x ? x.checks : [];
    h["a-beyond"] = checks.indexOf("stopBeyondLiq") < 0;
    h["a-tight"] = checks.indexOf("tight") < 0;
    h["a-margin"] = checks.indexOf("marginOverAccount") < 0;
    h["a-clear"] = checks.indexOf("clear") < 0;
    h["a-wrong"] = !r.wrongSide;
    t["a-wrong-text"] = "For a " + r.side + " position the stop must be " + (r.side === "long" ? "below" : "above") + " the entry price.";
    h["a-invalid"] = r.ok || r.wrongSide;

    var copy = null;
    var announce = r.wrongSide ? t["a-wrong-text"] : "Fix the highlighted fields to see the position size.";
    if (x) {
      copy = [
        "Crypto position size (" + x.side + ", " + C.fmtLev(x.leverage) + ")",
        "Account " + usd(C.parseNumber(st.account)) + ", risk " + C.fmtNum(C.parseNumber(st.riskPct), 4) + "% = " + usd(x.riskAmount) + " at risk",
        "Entry " + usd(C.parseNumber(st.entry)) + ", stop " + usd(C.parseNumber(st.stop)) + " (" + pct(x.stopDistancePct) + " away)",
        "Position: " + C.fmtUnits(x.units) + " units, " + usd(x.notional, 0) + " position value",
        "Margin at " + C.fmtLev(x.leverage) + ": " + usd(x.margin) + ". Exposure: " + pct(x.exposurePct) + " of the account",
        x.leverage > 1 ? "Estimated liquidation: " + usd(x.liq) + " (" + pct(x.liqDistancePct) + " away, before fees and maintenance margin)" : "Leverage 1x: no liquidation estimate",
        "Price at 1R / 2R / 3R: " + x.targets.map(function (g) { return usd(g.price); }).join(" / "),
      ];
      if (x.stopBeyondLiq) copy.push("Warning: the stop is beyond the estimated liquidation price.");
      if (x.tight) copy.push("Warning: liquidation sits very close to the stop.");
      if (x.marginOverAccount) copy.push("Warning: the margin required is larger than the account.");
      if (url) copy.push(url);
      copy.push(FOOT);
      copy = copy.join("\n");
      announce = "Position size " + usd(x.notional, 0) + ", " + C.fmtUnits(x.units) + " units. Amount at risk " + usd(x.riskAmount) + ".";
    }
    return { ok: r.ok, errors: r.errors, text: t, hidden: h, style: {}, copy: copy, announce: announce };
  }

  /* ---------- 2. drawdown recovery ---------- */
  var DRAWDOWN_DEFAULTS = { lossPct: "30", balance: "10,000" };

  // Chart geometry, shared by the generator (static drawing) and the page (moving marker).
  // Two drawings: "" for wide screens and "m-" for phones, so text stays readable at 390px.
  function makeChart(c) {
    c.px = function (x) {
      return c.l + (x / c.xMax) * (c.w - c.l - c.r);
    };
    c.py = function (y) {
      return c.t + (1 - y / c.yMax) * (c.h - c.t - c.b);
    };
    return c;
  }
  var CHARTS = {
    "": makeChart({ w: 640, h: 340, l: 66, r: 20, t: 20, b: 46, xMax: 80, yMax: 400, xStep: 10, font: 12 }),
    "m-": makeChart({ w: 360, h: 300, l: 50, r: 12, t: 16, b: 42, xMax: 80, yMax: 400, xStep: 20, font: 12 }),
  };
  var CHART = CHARTS[""];

  function drawdown(st, url) {
    var r = C.drawdownRecovery(st);
    var x = r.result;
    var t = {};
    var h = {};
    var s = {};
    var dash = "-";
    t["d-gain"] = x ? "+" + pct(x.gainPct) : dash;
    t["d-sub"] = x
      ? "A " + C.fmtNum(x.lossPct, 2) + "% loss leaves " + C.fmtNum(100 - x.lossPct, 2) + "% of the capital, so what is left has to grow " + C.fmtNum(x.multiple, 2) + "x to get back to the start."
      : "Enter a loss between 0% and 100%.";
    t["d-loss"] = x ? pct(x.lossPct) : dash;
    t["d-left"] = x ? pct(100 - x.lossPct) : dash;
    t["d-multiple"] = x ? C.fmtNum(x.multiple, 2) + "x" : dash;
    var streak = x ? C.lossesUntilDrawdown(1, x.lossPct) : null;
    t["d-streak"] = streak ? streak.trades + " in a row" : dash;
    if (x && x.balance !== null) {
      t["d-after"] = usd(x.afterLoss);
      t["d-after-sub"] = "from " + usd(x.balance);
      t["d-need"] = "+" + usd(x.dollarsNeeded);
      t["d-need-sub"] = "back to " + usd(x.balance);
    } else {
      t["d-after"] = dash;
      t["d-after-sub"] = "Add an account size";
      t["d-need"] = dash;
      t["d-need-sub"] = "Add an account size";
    }
    // chart marker, on both drawings
    var on = !!x && x.lossPct <= CHART.xMax;
    h["chart-off"] = !(x && x.lossPct > CHART.xMax);
    if (x && x.lossPct > CHART.xMax) t["chart-off"] = "A " + C.fmtNum(x.lossPct, 2) + "% loss needs +" + pct(x.gainPct) + ", above the top of this chart.";
    Object.keys(CHARTS).forEach(function (p) {
      var K = CHARTS[p];
      h[p + "chart-you"] = !on;
      // Hide a fixed annotation when the visitor's marker would sit on top of it.
      [50, 75].forEach(function (a) {
        h[p + "pt-" + a] = on && Math.abs(x.lossPct - a) < (p ? 16 : 12);
      });
      if (!on) return;
      var cx = K.px(x.lossPct);
      var cy = K.py(Math.min(x.gainPct, K.yMax));
      s[p + "chart-you-x"] = { x1: cx, x2: cx, y1: cy, y2: K.py(0) };
      s[p + "chart-you-dot"] = { cx: cx, cy: cy };
      var label = "-" + C.fmtNum(x.lossPct, 1) + "% needs +" + C.fmtNum(x.gainPct, 1) + "%";
      var bw = label.length * 7 + 16;
      var bx = Math.min(Math.max(cx - bw / 2, K.l), K.w - K.r - bw);
      var by = cy - 40 < K.t - 8 ? cy + 14 : cy - 38;
      s[p + "chart-you-box"] = { x: bx, y: by, width: bw };
      s[p + "chart-you-label"] = { x: bx + bw / 2, y: by + 17 };
      t[p + "chart-you-label"] = label;
    });
    var copy = null;
    var announce = "Enter a loss between 0% and 100%.";
    if (x) {
      copy = [
        "Drawdown recovery",
        "Loss: " + pct(x.lossPct) + ". Gain needed to get back to even: +" + pct(x.gainPct) + " (" + C.fmtNum(x.multiple, 2) + "x)",
      ];
      if (x.balance !== null) copy.push(usd(x.balance) + " falls to " + usd(x.afterLoss) + " and needs +" + usd(x.dollarsNeeded) + " to recover");
      if (streak) copy.push("At 1% risk per trade, " + streak.trades + " losses in a row produce a drawdown this size");
      copy.push("Formula: gain needed = 1 / (1 - loss) - 1");
      if (url) copy.push(url);
      copy.push(FOOT);
      copy = copy.join("\n");
      announce = "A " + C.fmtNum(x.lossPct, 2) + "% loss needs a " + pct(x.gainPct) + " gain to recover.";
    }
    return { ok: r.ok, errors: r.errors, text: t, hidden: h, style: s, copy: copy, announce: announce };
  }

  /* ---------- 3. risk per trade ---------- */
  var RISK_DEFAULTS = { account: "20,000", down: "20" };
  var RISK_LEVELS = [0.5, 1, 1.5, 2];
  var STREAK_LEVELS = [0.5, 1, 1.5, 2, 3, 5];
  var THRESHOLDS = [10, 20, 30, 50];

  function riskTable(st, url) {
    var r = C.riskRow({ account: st.account });
    var t = {};
    var h = {};
    RISK_LEVELS.forEach(function (p, i) {
      var amt = r.ok ? r.result.amounts[i].amount : NaN;
      t["y-" + i] = r.ok ? usd(amt, amt % 1 ? 2 : 0) : "-";
    });
    t["y-label"] = r.ok ? usd(r.result.account, r.result.account % 1 ? 2 : 0) : "Yours";
    var down = C.parseNumber(st.down);
    if (THRESHOLDS.indexOf(down) < 0) down = 20;
    t["s-head"] = "Losses in a row until down " + down + "%";
    t["s-caption"] = "Losing trades in a row, each risking a fixed percent of the current balance, until the account is down at least " + down + "%.";
    STREAK_LEVELS.forEach(function (p, i) {
      var s = C.lossesUntilDrawdown(p, down);
      t["s-" + i + "-n"] = String(s.trades);
      t["s-" + i + "-dd"] = pct(s.drawdownPct);
      t["s-" + i + "-g"] = "+" + pct(s.gainToRecoverPct);
    });
    var copy = null;
    var announce = "Enter your account size.";
    if (r.ok) {
      copy = ["Dollars at risk per trade for a " + usd(r.result.account) + " account"]
        .concat(r.result.amounts.map(function (a) { return C.fmtNum(a.pct, 1) + "%: " + usd(a.amount); }))
        .concat(url ? [url] : [])
        .concat([FOOT])
        .join("\n");
      announce = "At 1%, " + usd(r.result.amounts[1].amount) + " at risk per trade.";
    }
    return { ok: r.ok, errors: r.errors, text: t, hidden: h, style: {}, copy: copy, announce: announce, down: down };
  }

  /* ---------- 4. risk reward ---------- */
  var RR_DEFAULTS = { side: "long", entry: "100", stop: "95", target: "110", riskAmount: "500" };

  function riskReward(st, url) {
    var r = C.riskReward(st);
    var x = r.result;
    var t = {};
    var h = {};
    var s = {};
    var dash = "-";
    t["rr-ratio"] = x ? "1 : " + C.fmtNum(x.ratio, 2) : dash;
    t["rr-sub"] = x ? "The target is " + C.fmtNum(x.ratio, 2) + " times as far from the entry as the stop (" + C.fmtNum(x.ratio, 2) + "R)." : "Enter an entry, a stop and a target.";
    t["rr-be"] = x ? pct(x.breakEvenPct, 1) : dash;
    t["rr-be-sub"] = x ? "1 ÷ (1 + " + C.fmtNum(x.ratio, 2) + "), before fees" : "1 ÷ (1 + R)";
    t["rr-risk"] = x ? usd(x.riskDist) : dash;
    t["rr-risk-sub"] = x ? pct(x.riskPct) + " of the entry" : "entry to stop";
    t["rr-rew"] = x ? usd(x.rewardDist) : dash;
    t["rr-rew-sub"] = x ? pct(x.rewardPct) + " of the entry" : "entry to target";
    if (x && x.rewardAmount !== null) {
      t["rr-dollars"] = usd(x.riskAmount, 0) + " to " + usd(x.rewardAmount, 0);
      t["rr-dollars-sub"] = "risked at the stop, planned at the target";
    } else {
      t["rr-dollars"] = dash;
      t["rr-dollars-sub"] = "Add an amount at risk";
    }
    var riskShare = x ? (x.riskDist / (x.riskDist + x.rewardDist)) * 100 : 50;
    s["rr-bar-r"] = { width: riskShare.toFixed(2) + "%" };
    s["rr-bar-w"] = { width: (100 - riskShare).toFixed(2) + "%" };
    t["rr-l-stop"] = x ? usd(C.parseNumber(st.stop)) : dash;
    t["rr-l-entry"] = x ? usd(C.parseNumber(st.entry)) : dash;
    t["rr-l-target"] = x ? usd(C.parseNumber(st.target)) : dash;
    t["rr-note"] = x
      ? "Arithmetic, not a forecast: if every trade is set up at 1 : " + C.fmtNum(x.ratio, 2) + ", the account breaks even when " + pct(x.breakEvenPct, 1) + " of trades reach the target and the rest reach the stop, before fees and slippage."
      : "";
    h["rr-note-wrap"] = !x;
    var copy = null;
    var announce = "Enter an entry, a stop and a target.";
    if (x) {
      copy = [
        "Risk reward (" + x.side + ")",
        "Entry " + usd(C.parseNumber(st.entry)) + ", stop " + usd(C.parseNumber(st.stop)) + ", target " + usd(C.parseNumber(st.target)),
        "Risk " + usd(x.riskDist) + " (" + pct(x.riskPct) + "), reward " + usd(x.rewardDist) + " (" + pct(x.rewardPct) + ")",
        "Risk reward ratio: 1 : " + C.fmtNum(x.ratio, 2),
        "Break-even win rate: " + pct(x.breakEvenPct, 1) + " (arithmetic: 1 / (1 + R), before fees)",
      ];
      if (x.rewardAmount !== null) copy.push("Amount at risk " + usd(x.riskAmount) + ", planned reward at target " + usd(x.rewardAmount));
      if (url) copy.push(url);
      copy.push(FOOT);
      copy = copy.join("\n");
      announce = "Risk reward 1 to " + C.fmtNum(x.ratio, 2) + ". Break-even win rate " + pct(x.breakEvenPct, 1) + ".";
    }
    return { ok: r.ok, errors: r.errors, text: t, hidden: h, style: s, copy: copy, announce: announce };
  }

  var api = {
    position: { defaults: POSITION_DEFAULTS, keys: ["side", "account", "riskPct", "entry", "stop", "leverage"], view: position },
    drawdown: { defaults: DRAWDOWN_DEFAULTS, keys: ["lossPct", "balance"], view: drawdown },
    risk: { defaults: RISK_DEFAULTS, keys: ["account", "down"], view: riskTable },
    rr: { defaults: RR_DEFAULTS, keys: ["side", "entry", "stop", "target", "riskAmount"], view: riskReward },
    CHART: CHART,
    CHARTS: CHARTS,
    RISK_LEVELS: RISK_LEVELS,
    STREAK_LEVELS: STREAK_LEVELS,
    THRESHOLDS: THRESHOLDS,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CRViews = api;
})(typeof self !== "undefined" ? self : this);
