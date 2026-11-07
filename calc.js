/*
 * Crypto Risk Tools: shared math. Pure functions only (no DOM, no network, no storage).
 * Tested by dev-v2/calc.test.js. Works in the browser (window.CRCalc) and in Node (require).
 *
 * Position size: same formulas and checks as the calculator on
 * https://www.cryptorenegades.co/tools/position-size-calculator/
 *   amount at risk      = account x risk % / 100
 *   distance per unit   = entry - stop (long) or stop - entry (short)
 *   units               = amount at risk / distance per unit
 *   position value      = units x entry
 *   margin              = position value / leverage
 *   exposure            = position value / account x 100
 *   stop distance       = distance per unit / entry x 100
 *   est. liquidation    = entry x (1 - 1 / leverage) long, entry x (1 + 1 / leverage) short
 *                         (approximation before fees and maintenance margin)
 *
 * Drawdown recovery:    gain needed = 1 / (1 - loss) - 1
 * Losing streak:        smallest n with (1 - risk)^n <= 1 - threshold (risk taken on the current balance)
 * Risk reward:          R = |target - entry| / |entry - stop|; break-even win rate = 1 / (1 + R)
 */
(function (root) {
  "use strict";

  /* ---------- parsing ---------- */

  function parseNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/[,\s$%]/g, "");
    if (s === "") return NaN;
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === "";
  }

  function err(field, message) {
    return { field: field, message: message };
  }

  function positive(errors, raw, field, blankMsg, label) {
    if (isBlank(raw)) {
      errors.push(err(field, blankMsg));
      return NaN;
    }
    var n = parseNumber(raw);
    if (!(n > 0)) errors.push(err(field, label + " must be a number greater than 0."));
    return n;
  }

  /* ---------- 1. position size ---------- */

  /**
   * @param {{side:"long"|"short", account:any, riskPct:any, entry:any, stop:any, leverage?:any}} input
   * Leverage left empty means 1 (spot), exactly like the site, which uses max(1, leverage || 1).
   */
  function positionSize(input) {
    var side = input.side === "short" ? "short" : "long";
    var errors = [];
    var A = positive(errors, input.account, "account", "Enter your account size.", "Account size");
    var R = NaN;
    if (isBlank(input.riskPct)) errors.push(err("riskPct", "Enter your risk per trade as a percent, for example 1."));
    else {
      R = parseNumber(input.riskPct);
      if (!(R > 0)) errors.push(err("riskPct", "Risk per trade must be greater than 0%."));
      else if (R > 100) errors.push(err("riskPct", "Risk per trade cannot be more than 100% of the account."));
    }
    var E = positive(errors, input.entry, "entry", "Enter your entry price.", "Entry price");
    var S = positive(errors, input.stop, "stop", "Enter your stop price.", "Stop price");

    var L = 1;
    if (!isBlank(input.leverage)) {
      var lv = parseNumber(input.leverage);
      if (!Number.isFinite(lv)) errors.push(err("leverage", "Leverage must be a number. Use 1 for spot, 5 for 5x."));
      else if (lv < 1) errors.push(err("leverage", "Leverage must be 1 or more. Use 1 for spot."));
      else L = lv;
    }

    var perUnit = side === "long" ? E - S : S - E;
    var wrongSide = E > 0 && S > 0 && !(perUnit > 0);
    if (wrongSide) {
      errors.push(err("stop", "For a " + side + " position the stop must be " + (side === "long" ? "below" : "above") + " the entry price."));
    }
    if (errors.length) return { ok: false, side: side, wrongSide: wrongSide, errors: errors, result: null };

    var riskAmount = (A * R) / 100;
    var units = riskAmount / perUnit;
    var notional = units * E;
    var margin = notional / L;
    var stopDistancePct = (perUnit / E) * 100;
    var liq = side === "long" ? E * (1 - 1 / L) : E * (1 + 1 / L);
    var liqDistancePct = (Math.abs(E - liq) / E) * 100;
    var stopBeyondLiq = L > 1 && (side === "long" ? S <= liq : S >= liq);
    var tight = L > 1 && !stopBeyondLiq && liqDistancePct - stopDistancePct < 1.5;
    var marginOverAccount = margin > A;
    var targets = [1, 2, 3].map(function (m) {
      return { m: m, price: side === "long" ? E + perUnit * m : E - perUnit * m, reward: riskAmount * m };
    });

    // Same priority as the site: every warning that applies is shown; "clear" only when none apply and leverage > 1.
    var checks = [];
    if (stopBeyondLiq) checks.push("stopBeyondLiq");
    if (tight) checks.push("tight");
    if (marginOverAccount) checks.push("marginOverAccount");
    if (!checks.length && L > 1) checks.push("clear");

    return {
      ok: true,
      side: side,
      wrongSide: false,
      errors: [],
      result: {
        side: side,
        riskAmount: riskAmount,
        perUnit: perUnit,
        units: units,
        notional: notional,
        margin: margin,
        leverage: L,
        exposurePct: (notional / A) * 100,
        stopDistancePct: stopDistancePct,
        liq: liq,
        liqDistancePct: liqDistancePct,
        stopBeyondLiq: stopBeyondLiq,
        tight: tight,
        marginOverAccount: marginOverAccount,
        targets: targets,
        checks: checks,
      },
    };
  }

  /* ---------- 2. drawdown recovery ---------- */

  /** Gain needed (as a fraction) to recover from a loss given as a fraction, 0 <= d < 1. */
  function recoveryGain(d) {
    return 1 / (1 - d) - 1;
  }

  /**
   * @param {{lossPct:any, balance?:any}} input  balance is the peak (pre-loss) account value, optional
   */
  function drawdownRecovery(input) {
    var errors = [];
    var d = NaN;
    if (isBlank(input.lossPct)) errors.push(err("lossPct", "Enter the size of the loss as a percent, for example 25."));
    else {
      d = parseNumber(input.lossPct);
      if (!Number.isFinite(d) || d <= 0) errors.push(err("lossPct", "The loss must be a number greater than 0%."));
      else if (d >= 100) errors.push(err("lossPct", "A 100% loss leaves no capital to recover with. Enter a loss below 100%."));
    }
    var hasBalance = !isBlank(input.balance);
    var B = hasBalance ? parseNumber(input.balance) : NaN;
    if (hasBalance && !(B > 0)) errors.push(err("balance", "Account size must be a number greater than 0, or leave it empty."));
    if (errors.length) return { ok: false, errors: errors, result: null };

    var g = recoveryGain(d / 100);
    var result = { lossPct: d, gainPct: g * 100, multiple: 1 + g, balance: null, afterLoss: null, dollarsLost: null, dollarsNeeded: null };
    if (hasBalance) {
      result.balance = B;
      result.afterLoss = B * (1 - d / 100);
      result.dollarsLost = B - result.afterLoss;
      result.dollarsNeeded = result.dollarsLost; // back to the peak: same dollars, larger percentage of a smaller base
    }
    return { ok: true, errors: [], result: result };
  }

  /* ---------- 3. risk per trade ---------- */

  function riskAmount(account, pct) {
    return (account * pct) / 100;
  }

  /**
   * Consecutive losing trades until the account is down at least thresholdPct, when each
   * loss is riskPct of the current balance. Returns the count and the drawdown after it.
   */
  function lossesUntilDrawdown(riskPct, thresholdPct) {
    var r = riskPct / 100;
    var floor = 1 - thresholdPct / 100;
    if (!(r > 0 && r < 1) || !(floor > 0 && floor < 1)) return null;
    var balance = 1;
    var n = 0;
    // 1e-12 guards against floating error deciding an exact boundary case.
    while (balance > floor + 1e-12) {
      balance *= 1 - r;
      n++;
    }
    return { trades: n, drawdownPct: (1 - balance) * 100, gainToRecoverPct: recoveryGain(1 - balance) * 100 };
  }

  function riskRow(input) {
    var errors = [];
    var A = positive(errors, input.account, "account", "Enter your account size.", "Account size");
    if (errors.length) return { ok: false, errors: errors, result: null };
    return {
      ok: true,
      errors: [],
      result: { account: A, amounts: [0.5, 1, 1.5, 2].map(function (p) { return { pct: p, amount: riskAmount(A, p) }; }) },
    };
  }

  /* ---------- 4. risk reward ---------- */

  function breakEvenWinRate(R) {
    return 1 / (1 + R);
  }

  /**
   * @param {{side:"long"|"short", entry:any, stop:any, target:any, riskAmount?:any}} input
   */
  function riskReward(input) {
    var side = input.side === "short" ? "short" : "long";
    var errors = [];
    var E = positive(errors, input.entry, "entry", "Enter your entry price.", "Entry price");
    var S = positive(errors, input.stop, "stop", "Enter your stop price.", "Stop price");
    var T = positive(errors, input.target, "target", "Enter your target price.", "Target price");
    var hasRisk = !isBlank(input.riskAmount);
    var D = hasRisk ? parseNumber(input.riskAmount) : NaN;
    if (hasRisk && !(D > 0)) errors.push(err("riskAmount", "Amount at risk must be a number greater than 0, or leave it empty."));

    if (E > 0 && S > 0) {
      var stopOk = side === "long" ? S < E : S > E;
      if (!stopOk) errors.push(err("stop", "For a " + side + " position the stop must be " + (side === "long" ? "below" : "above") + " the entry price."));
    }
    if (E > 0 && T > 0) {
      var targetOk = side === "long" ? T > E : T < E;
      if (!targetOk) errors.push(err("target", "For a " + side + " position the target must be " + (side === "long" ? "above" : "below") + " the entry price."));
    }
    if (errors.length) return { ok: false, side: side, errors: errors, result: null };

    var riskDist = Math.abs(E - S);
    var rewardDist = Math.abs(T - E);
    var R = rewardDist / riskDist;
    return {
      ok: true,
      side: side,
      errors: [],
      result: {
        side: side,
        riskDist: riskDist,
        rewardDist: rewardDist,
        riskPct: (riskDist / E) * 100,
        rewardPct: (rewardDist / E) * 100,
        ratio: R,
        breakEvenPct: breakEvenWinRate(R) * 100,
        riskAmount: hasRisk ? D : null,
        rewardAmount: hasRisk ? D * R : null,
      },
    };
  }

  /* ---------- formatting ---------- */

  function fmtUsd(n, digits) {
    if (!Number.isFinite(n)) return "-";
    if (digits === undefined && Math.abs(n) > 0 && Math.abs(n) < 1) {
      // Sub-dollar prices keep 4 significant digits instead of rounding to $0.00.
      return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 });
    }
    var d = digits === undefined ? 2 : digits;
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtUnits(n) {
    if (!Number.isFinite(n)) return "-";
    if (n > 0 && n < 1) return n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
    return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 2 : 4 });
  }

  function fmtPct(n, digits) {
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString("en-US", { minimumFractionDigits: digits === undefined ? 2 : digits, maximumFractionDigits: digits === undefined ? 2 : digits }) + "%";
  }

  function fmtNum(n, digits) {
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString("en-US", { maximumFractionDigits: digits === undefined ? 2 : digits });
  }

  function fmtLev(n) {
    return Number.isFinite(n) ? fmtNum(n, 2) + "x" : "-";
  }

  var api = {
    parseNumber: parseNumber,
    isBlank: isBlank,
    positionSize: positionSize,
    recoveryGain: recoveryGain,
    drawdownRecovery: drawdownRecovery,
    riskAmount: riskAmount,
    riskRow: riskRow,
    lossesUntilDrawdown: lossesUntilDrawdown,
    breakEvenWinRate: breakEvenWinRate,
    riskReward: riskReward,
    fmtUsd: fmtUsd,
    fmtUnits: fmtUnits,
    fmtPct: fmtPct,
    fmtNum: fmtNum,
    fmtLev: fmtLev,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CRCalc = api;
})(typeof self !== "undefined" ? self : this);
