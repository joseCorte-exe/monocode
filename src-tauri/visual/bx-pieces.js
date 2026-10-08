/* Metrics, ranked bars, tables and number formats: the pieces most data
   visuals are built from. frame.html loads it right after bx.js. */
(function () {
  "use strict";

  var kit = window.bxKit;
  var resolve = kit.resolve;
  var el = kit.el;
  var ROWS_BEFORE_MORE = 12;

  function metrics(target, items, opts) {
    var host = resolve(target);
    var wrap = el("div", "bx-metrics" + (opts && opts.cards ? " cards" : ""));
    (items || []).slice(0, 5).forEach(function (item, i) {
      var tile = el("div", "bx-metric bx-enter");
      tile.style.setProperty("--i", i);
      tile.appendChild(el("div", "bx-metric-value", item.value));
      tile.appendChild(el("div", "bx-metric-label", item.label));
      if (item.delta !== undefined && item.delta !== null) {
        var delta = el("div", "bx-metric-delta", item.delta);
        var tone =
          item.tone ||
          (/^\s*[+▲]/.test(item.delta)
            ? "good"
            : /^\s*[-−▼]/.test(item.delta)
              ? "bad"
              : "");
        if (tone) delta.dataset.tone = tone;
        tile.appendChild(delta);
      }
      if (item.hint) tile.title = item.hint;
      wrap.appendChild(tile);
    });
    host.appendChild(wrap);
    return wrap;
  }

  /* Cut a path in the middle until it fits, keeping the start and the file
     name. */
  function fitMiddle(node, text) {
    node.textContent = text;
    if (node.scrollWidth <= node.clientWidth || !node.clientWidth) return;
    var slash = text.lastIndexOf("/");
    var tail = slash >= 0 ? text.slice(slash) : text.slice(-12);
    var head = text.slice(0, Math.max(0, text.length - tail.length));
    var lo = 0;
    var hi = head.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      node.textContent = head.slice(0, mid) + "…" + tail;
      if (node.scrollWidth <= node.clientWidth) lo = mid;
      else hi = mid - 1;
    }
    node.textContent = head.slice(0, lo) + "…" + tail;
  }

  function moreButton(host, total, render) {
    if (total <= ROWS_BEFORE_MORE) return;
    var button = el("button", "bx-more", "show all (" + total + ")");
    button.type = "button";
    button.addEventListener("click", function () {
      button.remove();
      render(total);
    });
    host.appendChild(button);
  }

  function bars(target, rows, opts) {
    var host = resolve(target);
    var options = opts || {};
    var format = options.format || num;
    var list = (rows || []).slice();
    var max =
      list.reduce(function (m, row) {
        return Math.max(m, +row.value || 0);
      }, 0) || 1;
    var grid = el("div", "bx-bars");
    host.appendChild(grid);
    var labels = [];
    function render(count) {
      grid.textContent = "";
      labels = [];
      list.slice(0, count).forEach(function (row, i) {
        var label = el(
          "div",
          "bx-bar-label" + (row.path || options.path ? " bx-path" : ""),
        );
        var full = String(row.path || row.label || "");
        label.title = full;
        if (row.path) {
          label.dataset.open = row.path;
          label.tabIndex = 0;
        }
        var track = el("div", "bx-bar-track");
        var fill = el("div", "bx-bar-fill");
        fill.style.width = (Math.max(0, +row.value || 0) / max) * 100 + "%";
        fill.style.setProperty("--i", i);
        if (row.color) fill.style.background = row.color;
        track.appendChild(fill);
        grid.appendChild(label);
        grid.appendChild(track);
        grid.appendChild(el("div", "bx-bar-value", format(row.value)));
        labels.push([label, full]);
      });
      fitAll();
    }
    function fitAll() {
      labels.forEach(function (pair) {
        fitMiddle(pair[0], pair[1]);
      });
    }
    render(Math.min(list.length, ROWS_BEFORE_MORE));
    moreButton(host, list.length, render);
    new ResizeObserver(fitAll).observe(grid);
    return grid;
  }

  function table(target, spec) {
    var host = resolve(target);
    var columns = (spec && spec.columns) || [];
    var rows = (spec && spec.rows) || [];
    var node = el("table", "bx-table");
    var head = el("thead");
    var headRow = el("tr");
    columns.forEach(function (column) {
      var th = el(
        "th",
        column.align === "right" ? "bx-right" : "",
        column.label || column.key,
      );
      if (column.width) th.style.width = column.width;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    node.appendChild(head);
    var body = el("tbody");
    node.appendChild(body);
    function render(count) {
      body.textContent = "";
      rows.slice(0, count).forEach(function (row) {
        var tr = el("tr");
        columns.forEach(function (column) {
          var value = row[column.key];
          var shown = column.format ? column.format(value, row) : value;
          var td = el("td", column.align === "right" ? "bx-right" : "", shown);
          td.title = shown === undefined || shown === null ? "" : String(shown);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }
    render(Math.min(rows.length, ROWS_BEFORE_MORE));
    host.appendChild(node);
    moreButton(host, rows.length, render);
    return node;
  }

  /* ---------- formatting ---------- */

  function num(value, digits) {
    var v = +value;
    if (!isFinite(v)) return String(value);
    if (Math.abs(v) >= 10000) {
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: digits === undefined ? 1 : digits,
      }).format(v);
    }
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: digits === undefined ? 2 : digits,
    }).format(v);
  }

  function pct(fraction, digits) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: digits === undefined ? 0 : digits,
    }).format(+fraction || 0);
  }

  function bytes(value) {
    var v = +value || 0;
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    while (Math.abs(v) >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return num(v, i === 0 ? 0 : 1) + " " + units[i];
  }

  function dur(ms) {
    var v = +ms || 0;
    if (v < 1000) return Math.round(v) + " ms";
    if (v < 60000) return num(v / 1000, 1) + " s";
    if (v < 3600000) return num(v / 60000, 1) + " min";
    return num(v / 3600000, 1) + " h";
  }

  function date(value, style) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var options =
      style === "time"
        ? { hour: "numeric", minute: "2-digit" }
        : style === "long"
          ? { year: "numeric", month: "short", day: "numeric" }
          : { month: "short", day: "numeric" };
    return new Intl.DateTimeFormat(undefined, options).format(d);
  }

  window.bx.metrics = metrics;
  window.bx.bars = bars;
  window.bx.table = table;
  window.bx.fmt = { num: num, pct: pct, bytes: bytes, dur: dur, date: date };
})();
