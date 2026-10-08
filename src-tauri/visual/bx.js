/* The kit every visual runs on. It receives the agent's HTML from the app by
   postMessage, runs its scripts in order, themes everything from the app's
   colors, and only ever asks the app for three things: open a file, put a
   question in the composer, open an https link. */
(function () {
  "use strict";

  var PALETTE = {
    dark: {
      cat: ["#60aaf3", "#e28d4f", "#00beb7", "#de82b7", "#bea333", "#ab93ed"],
      seq: ["#002d66", "#004f8b", "#2f72b1", "#5497d9", "#7abdff"],
      status: { good: "#5bbd74", warn: "#d29922", bad: "#f07f77" },
    },
    light: {
      cat: ["#2378c2", "#b15900", "#008d87", "#ac4e87", "#8e7200", "#7c60bd"],
      seq: ["#ddedff", "#a8cff7", "#70adea", "#418ad1", "#0465af"],
      status: { good: "#0e8c41", warn: "#a16700", bad: "#bc4945" },
    },
  };
  var ASK_LIMIT = 2000;

  var state = {
    scheme: "dark",
    fg: "rgb(235, 235, 235)",
    bg: "rgb(23, 23, 23)",
    accent: "#60aaf3",
    font: "",
    mono: "",
    reducedMotion: false,
    animate: false,
    charts: [],
    themeFns: [],
    lastHeight: -1,
    failed: false,
  };

  function post(message) {
    message.bx = 1;
    parent.postMessage(message, "*");
  }

  /* ---------- color ---------- */

  function rgbParts(color) {
    var match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(
      color || "",
    );
    if (match) return [+match[1], +match[2], +match[3]];
    var hex = /^#([0-9a-f]{6})$/i.exec(color || "");
    if (hex) {
      var n = parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return [235, 235, 235];
  }

  function alpha(color, a) {
    var p = rgbParts(color);
    return "rgba(" + p[0] + ", " + p[1] + ", " + p[2] + ", " + a + ")";
  }

  function mix(a, b, t) {
    var pa = rgbParts(a);
    var pb = rgbParts(b);
    var out = [0, 1, 2].map(function (i) {
      return Math.round(pa[i] + (pb[i] - pa[i]) * t);
    });
    return "rgb(" + out.join(", ") + ")";
  }

  function palette() {
    return PALETTE[state.scheme] || PALETTE.dark;
  }

  function clamp01(t) {
    return Math.max(0, Math.min(1, +t || 0));
  }

  function color(i) {
    var cat = palette().cat;
    return cat[(((i | 0) % cat.length) + cat.length) % cat.length];
  }

  function seq(t) {
    var steps = palette().seq;
    var x = clamp01(t) * (steps.length - 1);
    var lo = Math.floor(x);
    var hi = Math.min(steps.length - 1, lo + 1);
    return mix(steps[lo], steps[hi], x - lo);
  }

  function div(t) {
    var v = Math.max(-1, Math.min(1, +t || 0));
    var mid = alpha(state.fg, 0.12);
    var midSolid = mix(state.bg, state.fg, 0.12);
    if (v === 0) return mid;
    return v < 0 ? mix(midSolid, color(1), -v) : mix(midSolid, color(0), v);
  }

  function status(name) {
    return palette().status[name] || state.fg;
  }

  /* ---------- theme ---------- */

  function applyTheme(theme) {
    if (theme) {
      state.scheme = theme.scheme === "light" ? "light" : "dark";
      state.fg = theme.fg || state.fg;
      state.bg = theme.bg || state.bg;
      state.accent = theme.accent || palette().cat[0];
      state.font = theme.font || "";
      state.mono = theme.mono || "";
    }
    var root = document.documentElement.style;
    var set = function (name, value) {
      root.setProperty(name, value);
    };
    set("--bx-fg", state.fg);
    set("--bx-fg-2", alpha(state.fg, 0.6));
    set("--bx-fg-3", alpha(state.fg, 0.45));
    set("--bx-grid", alpha(state.fg, 0.08));
    set("--bx-axis", alpha(state.fg, 0.2));
    set("--bx-hairline", alpha(state.fg, 0.1));
    set("--bx-tip-bg", state.bg);
    set("--bx-surface", alpha(state.fg, 0.03));
    set("--bx-on-accent", state.bg);
    set("--bx-accent", state.accent);
    if (state.font) set("--bx-font", state.font);
    if (state.mono) set("--bx-mono", state.mono);
    palette().cat.forEach(function (c, i) {
      set("--bx-c" + (i + 1), c);
    });
    set("--bx-good", status("good"));
    set("--bx-warn", status("warn"));
    set("--bx-bad", status("bad"));
    set("color-scheme", state.scheme);
    if (window.echarts) registerChartTheme();
  }

  function themeName() {
    return "bx-" + state.scheme;
  }

  function axis(splitLine) {
    return {
      axisLine: {
        show: !splitLine,
        lineStyle: { color: alpha(state.fg, 0.2) },
      },
      axisTick: { show: false },
      axisLabel: { color: alpha(state.fg, 0.45), fontSize: 11 },
      splitLine: {
        show: splitLine,
        lineStyle: { color: alpha(state.fg, 0.08) },
      },
      nameTextStyle: { color: alpha(state.fg, 0.45), fontSize: 11 },
    };
  }

  function chartTheme() {
    var fg2 = alpha(state.fg, 0.6);
    var font = state.font || "system-ui, -apple-system, sans-serif";
    var valueAxis = axis(true);
    valueAxis.splitNumber = 4;
    return {
      color: palette().cat,
      backgroundColor: "transparent",
      textStyle: { fontFamily: font, fontSize: 11, color: fg2 },
      legend: {
        textStyle: { color: fg2, fontSize: 11 },
        icon: "roundRect",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
      },
      tooltip: {
        backgroundColor: state.bg,
        borderColor: alpha(state.fg, 0.1),
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: state.fg, fontSize: 12, fontFamily: font },
        extraCssText:
          "border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.22);transition:opacity 80ms ease-out;",
        transitionDuration: 0,
        axisPointer: {
          lineStyle: { color: alpha(state.fg, 0.35), width: 1 },
          crossStyle: { color: alpha(state.fg, 0.35) },
        },
      },
      axisPointer: { lineStyle: { color: alpha(state.fg, 0.35) } },
      categoryAxis: axis(false),
      valueAxis: valueAxis,
      timeAxis: axis(false),
      logAxis: valueAxis,
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      line: {
        lineStyle: { width: 1.75, cap: "round", join: "round" },
        symbol: "circle",
        symbolSize: 6,
        showSymbol: false,
        // End labels in ink, not in the series color, without the default
        // halo, pushed apart when two lines end close together.
        endLabel: {
          color: fg2,
          fontSize: 11,
          distance: 8,
          textBorderWidth: 0,
          textShadowBlur: 0,
        },
        labelLayout: { moveOverlap: "shiftY" },
        emphasis: { focus: "series" },
        blur: { lineStyle: { opacity: 0.35 }, areaStyle: { opacity: 0.05 } },
      },
      bar: {
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        barCategoryGap: "25%",
        emphasis: { focus: "series" },
        blur: { itemStyle: { opacity: 0.35 } },
      },
      heatmap: {
        itemStyle: { borderColor: state.bg, borderWidth: 2, borderRadius: 2 },
      },
      treemap: {
        itemStyle: { borderColor: state.bg, borderWidth: 1, gapWidth: 2 },
        label: { color: state.fg, fontSize: 11 },
        upperLabel: { color: fg2, fontSize: 11 },
        breadcrumb: {
          itemStyle: {
            color: alpha(state.fg, 0.08),
            textStyle: { color: fg2 },
          },
          emphasis: { itemStyle: { color: alpha(state.fg, 0.16) } },
        },
      },
      visualMap: {
        textStyle: { color: fg2, fontSize: 11 },
        inRange: { color: palette().seq },
        itemWidth: 10,
        itemHeight: 80,
      },
      markLine: {
        lineStyle: { color: alpha(state.fg, 0.35), type: "dashed", width: 1 },
        label: { color: fg2, fontSize: 11 },
        symbol: "none",
      },
      animationDuration: 600,
      animationEasing: "cubicOut",
      animationDurationUpdate: 300,
      animationEasingUpdate: "cubicOut",
    };
  }

  function registerChartTheme() {
    window.echarts.registerTheme(themeName(), chartTheme());
  }

  function withMotion(option) {
    var copy = Object.assign({}, option);
    if (!state.animate || state.reducedMotion) {
      copy.animation = false;
    } else if (copy.animationDelay === undefined) {
      copy.animationDelay = function (index) {
        return Math.min(index * 20, 300);
      };
    }
    return copy;
  }

  function retheme() {
    state.charts.forEach(function (entry) {
      if (typeof entry.chart.setTheme === "function") {
        entry.chart.setTheme(themeName());
      } else {
        entry.chart.dispose();
        entry.chart = window.echarts.init(entry.el, themeName(), {
          renderer: "svg",
        });
        var still = Object.assign({}, entry.option, { animation: false });
        entry.chart.setOption(still);
      }
    });
    state.themeFns.forEach(function (fn) {
      try {
        fn({ scheme: state.scheme });
      } catch (error) {
        reportError(error);
      }
    });
  }

  /* ---------- building blocks ---------- */

  function resolve(el) {
    var node = typeof el === "string" ? document.querySelector(el) : el;
    if (!node) throw new Error("bx: element not found: " + el);
    return node;
  }

  function chart(el, option, opts) {
    if (!window.echarts) throw new Error("bx.chart: ECharts did not load");
    var node = resolve(el);
    var height = (opts && opts.height) || 280;
    node.style.width = "100%";
    node.style.height = height + "px";
    var instance = window.echarts.init(node, themeName(), { renderer: "svg" });
    instance.setOption(withMotion(option));
    var entry = { el: node, option: option, chart: instance };
    state.charts.push(entry);
    new ResizeObserver(function () {
      entry.chart.resize();
    }).observe(node);
    return instance;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /* ---------- bridge ---------- */

  function open(path, line) {
    if (!path) return;
    var message = { type: "open", path: String(path) };
    if (line !== undefined && line !== null && isFinite(+line))
      message.line = +line;
    post(message);
  }

  function openSpec(spec) {
    var match = /^(.*?):(\d+)$/.exec(spec);
    if (match) open(match[1], +match[2]);
    else open(spec);
  }

  function ask(text) {
    var value = String(text || "").trim();
    if (value) post({ type: "ask", text: value.slice(0, ASK_LIMIT) });
  }

  function onTheme(fn) {
    if (typeof fn === "function") state.themeFns.push(fn);
  }

  function activate(target) {
    var node =
      target &&
      target.closest &&
      target.closest("[data-open],[data-ask],a[href]");
    if (!node) return false;
    if (node.hasAttribute("data-open"))
      openSpec(node.getAttribute("data-open"));
    else if (node.hasAttribute("data-ask")) ask(node.getAttribute("data-ask"));
    else post({ type: "link", url: node.href });
    return true;
  }

  document.addEventListener("click", function (event) {
    if (activate(event.target)) event.preventDefault();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var node = event.target;
    if (node && node.matches && node.matches("[data-open],[data-ask]")) {
      event.preventDefault();
      activate(node);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !event.defaultPrevented)
      post({ type: "escape" });
  });

  /* ---------- lifecycle ---------- */

  function reportError(error, line) {
    state.failed = true;
    var message = error && error.message ? error.message : String(error);
    var report = { type: "error", message: message.slice(0, 500) };
    if (line) report.line = line;
    post(report);
  }

  window.addEventListener("error", function (event) {
    reportError(event.error || event.message, event.lineno);
  });

  window.addEventListener("unhandledrejection", function (event) {
    reportError(event.reason);
  });

  function reportSize() {
    var height = Math.ceil(
      document.documentElement.getBoundingClientRect().height,
    );
    if (height === state.lastHeight) return;
    state.lastHeight = height;
    post({ type: "size", height: height });
  }

  function loadCharts() {
    if (window.echarts) return Promise.resolve();
    return new Promise(function (resolveLoad, reject) {
      var script = document.createElement("script");
      script.src = "echarts-6.1.0.min.js";
      script.onload = function () {
        registerChartTheme();
        resolveLoad();
      };
      script.onerror = function () {
        reject(new Error("ECharts did not load"));
      };
      document.head.appendChild(script);
    });
  }

  function runScripts(root) {
    var scripts = Array.prototype.slice.call(root.querySelectorAll("script"));
    for (var i = 0; i < scripts.length && !state.failed; i++) {
      var old = scripts[i];
      if (old.src) {
        old.remove();
        continue;
      }
      var fresh = document.createElement("script");
      fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    }
  }

  function render(message) {
    var root = document.getElementById("bx-root");
    state.charts.forEach(function (entry) {
      entry.chart.dispose();
    });
    state.charts = [];
    state.themeFns = [];
    state.failed = false;
    state.animate = !!message.animate;
    state.reducedMotion = !!message.reducedMotion;
    applyTheme(message.theme);
    document.body.classList.toggle(
      "bx-animate",
      state.animate && !state.reducedMotion,
    );
    var html = String(message.html || "");
    root.innerHTML = html;
    var needsCharts = /bx\.chart|echarts/.test(html);
    (needsCharts ? loadCharts() : Promise.resolve())
      .then(function () {
        runScripts(root);
        requestAnimationFrame(function () {
          reportSize();
          if (!state.failed) post({ type: "ready" });
        });
      })
      .catch(reportError);
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.bx !== 1) return;
    if (data.type === "render") render(data);
    else if (data.type === "theme") {
      state.reducedMotion = !!data.reducedMotion;
      applyTheme(data.theme);
      retheme();
    }
  });

  new ResizeObserver(reportSize).observe(document.documentElement);

  window.bx = {
    chart: chart,
    color: color,
    seq: seq,
    div: div,
    status: status,
    open: open,
    ask: ask,
    onTheme: onTheme,
  };

  // What bx-pieces.js uses; it loads right after this file and adds its part
  // of `bx`.
  window.bxKit = { resolve: resolve, el: el };
})();
