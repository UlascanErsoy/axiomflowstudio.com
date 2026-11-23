/* Liquid glass: the same refraction as the workbench's sign-in card
   (webui/src/LiquidGlass.tsx), without React. Each element with
   [data-lens] gets a displacement map drawn to its shape, used as its
   backdrop-filter, so the picture behind bends at the rounded rim.
   Only Chromium draws an SVG filter as a backdrop filter; everywhere else
   the element keeps the frost .glass gives it in styles.css. */
(function () {
  'use strict'

  // dispersion 0: one displacement pass instead of three plus the blends that rejoin them
  var G = { bezel: 30, curve: 2.5, depth: 24, index: 1.5, blur: 2, dispersion: 0, saturate: 1.4 }
  var NS = 'http://www.w3.org/2000/svg'
  var serial = 0

  // Refraction costs a filter pass over the backdrop on every frame the
  // backdrop moves. Desktop-class machines only (a fine pointer and a wide
  // window): phones keep the frost, which is also all iOS can draw.
  function refracts() {
    if (window.matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)').matches) return false
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches) return false
    if (navigator.connection && navigator.connection.saveData) return false
    return /\bChrome\/\d/.test(navigator.userAgent) && window.CSS && CSS.supports('backdrop-filter', 'url(#a)')
  }

  function lens(w, h, radius) {
    // one map pixel per CSS pixel: the bend is smooth, and feImage scales it
    var ratio = 1
    var W = Math.round(w), H = Math.round(h)
    if (W < 2 || H < 2) return null
    var canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    var ctx = canvas.getContext('2d')
    if (!ctx) return null
    var r = Math.min(radius, w / 2, h / 2)
    var bezel = Math.max(1, Math.min(G.bezel, r))

    // how far a ray entering at each point of the rim is bent (Snell's law)
    var N = 128, n = Math.max(1.2, G.curve)
    var bend = new Float32Array(N + 1), reach = 0.01
    for (var i = 0; i <= N; i++) {
      var t = Math.max(i, 0.25) / N, u = 1 - t
      var body = 1 - Math.pow(u, n)
      var height = Math.pow(body, 1 / n)
      var slope = Math.pow(u, n - 1) * Math.pow(body, 1 / n - 1)
      var into = Math.atan(slope)
      var out = Math.asin(Math.sin(into) / Math.max(1, G.index))
      bend[i] = Math.tan(into - out) * (height * bezel + G.depth)
      if (bend[i] > reach) reach = bend[i]
    }

    var img = ctx.createImageData(W, H), px = img.data
    // everything starts as "no bend" (mid grey, opaque); only the rim is worked out
    new Uint32Array(px.buffer).fill(new Uint32Array(new Uint8Array([128, 128, 128, 255]).buffer)[0])
    var hx = w / 2 - r, hy = h / 2 - r
    // the bent rim lies within r of an edge (bezel <= r), round corners included
    var band = Math.ceil(r * ratio) + 1
    for (var j = 0; j < H; j++) {
      var y = (j + 0.5) / ratio - h / 2
      var qy = Math.max(Math.abs(y) - hy, 0)
      var inner = j >= band && j < H - band
      for (var k = 0; k < W; k++) {
        if (inner && k === band) k = W - band   // skip the flat middle of the row
        var x = (k + 0.5) / ratio - w / 2
        var qx = Math.max(Math.abs(x) - hx, 0)
        var away = Math.hypot(qx, qy), edge = r - away, dx = 0, dy = 0
        if (away > 0 && edge >= 0 && edge < bezel) {
          var f = (edge / bezel) * N, a = Math.floor(f)
          var far = bend[a] + (bend[Math.min(N, a + 1)] - bend[a]) * (f - a)
          dx = (-(x < 0 ? -qx : qx) / away) * far
          dy = (-(y < 0 ? -qy : qy) / away) * far
        }
        var o = (j * W + k) * 4
        px[o] = Math.round(127.5 + (127.5 * dx) / reach)
        px[o + 1] = Math.round(127.5 + (127.5 * dy) / reach)
        px[o + 2] = 128
        px[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return { map: canvas.toDataURL('image/png'), reach: reach }
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name)
    for (var a in attrs) e.setAttribute(a, attrs[a])
    if (parent) parent.appendChild(e)
    return e
  }

  function filterFor(id, map, reach, w, h) {
    var svg = el('svg', { 'class': 'glass-filter', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' })
    var f = el('filter', { id: id, 'color-interpolation-filters': 'sRGB' }, svg)
    el('feFlood', { 'flood-color': 'rgb(128,128,128)', result: 'flat' }, f)
    el('feImage', { href: map, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'shape' }, f)
    var m = el('feMerge', { result: 'lens' }, f)
    el('feMergeNode', { 'in': 'flat' }, m)
    el('feMergeNode', { 'in': 'shape' }, m)
    var scale = 2 * reach, s = G.dispersion
    function bent(as, by) {
      el('feDisplacementMap', { 'in': 'SourceGraphic', in2: 'lens', scale: scale * by, xChannelSelector: 'R', yChannelSelector: 'G', result: as }, f)
    }
    if (!s) { bent('whole', 1); return svg }
    bent('far', 1 + s)
    el('feColorMatrix', { 'in': 'far', type: 'matrix', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'red' }, f)
    bent('mid', 1)
    el('feColorMatrix', { 'in': 'mid', type: 'matrix', values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'green' }, f)
    bent('near', 1 - s)
    el('feColorMatrix', { 'in': 'near', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', result: 'blue' }, f)
    el('feBlend', { 'in': 'red', in2: 'green', mode: 'screen', result: 'warm' }, f)
    el('feBlend', { 'in': 'warm', in2: 'blue', mode: 'screen' }, f)
    return svg
  }

  function attach(pane) {
    var svg = null, last = ''
    function draw() {
      var b = pane.getBoundingClientRect()
      var w = Math.round(b.width * 100) / 100, h = Math.round(b.height * 100) / 100
      var r = parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0
      var key = w + 'x' + h + 'r' + r
      if (key === last) return
      last = key
      var made = lens(w, h, r)
      if (!made) return
      var id = 'liquid-glass-' + (++serial)
      var img = new Image()
      img.src = made.map
      var use = function () {
        if (key !== last) return
        var next = filterFor(id, made.map, made.reach, w, h)
        document.body.appendChild(next)
        var filter = (G.blur > 0 ? 'blur(' + G.blur + 'px) ' : '') + 'url(#' + id + ') saturate(' + G.saturate + ')'
        pane.style.setProperty('-webkit-backdrop-filter', filter)
        pane.style.setProperty('backdrop-filter', filter)
        pane.classList.add('lensed')
        if (svg) svg.remove()
        svg = next
      }
      img.decode ? img.decode().then(use, use) : (img.onload = use)
    }
    var pending = 0
    new ResizeObserver(function () {
      clearTimeout(pending)
      pending = setTimeout(draw, 60)
    }).observe(pane)
  }

  // the light on every rim leans a little with the pointer
  // The angle is set on each pane, not the root: a custom property on the root
  // is inherited by every element, so each pointer move restyled the page.
  function lean() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover)').matches) return
    var panes = document.querySelectorAll('.glass'), rims = []
    for (var p = 0; p < panes.length; p++) {
      var rim = document.createElement('i')
      rim.className = 'glass-rim'
      rim.setAttribute('aria-hidden', 'true')
      panes[p].appendChild(rim)
      panes[p].classList.add('rimmed')
      rims.push(rim)
    }
    // only panes on screen, and only when the light has turned a whole degree
    var shown = new Set(), lastTurn = ''
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? shown.add(e.target) : shown.delete(e.target) })
      })
      rims.forEach(function (r) { io.observe(r.parentNode) })
    } else rims.forEach(function (r) { shown.add(r.parentNode) })
    var frame = 0, x = 0, y = 0
    window.addEventListener('pointermove', function (e) {
      x = e.clientX
      y = e.clientY
      if (frame) return
      frame = requestAnimationFrame(function () {
        frame = 0
        var turn = -45 + (x / window.innerWidth - 0.5) * 80 + (y / window.innerHeight - 0.5) * 30
        var v = Math.round(turn) + 'deg'
        if (v === lastTurn) return
        lastTurn = v
        for (var i = 0; i < rims.length; i++) {
          if (shown.has(rims[i].parentNode)) rims[i].style.setProperty('--glass-light', v)
        }
      })
    }, { passive: true })
  }

  function start() {
    lean()
    if (!refracts() || !('ResizeObserver' in window)) return
    var panes = document.querySelectorAll('[data-lens]')
    var go = function () { for (var i = 0; i < panes.length; i++) attach(panes[i]) }
    // after the page has painted: the frost is already there, the bend arrives a moment later
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 })
    else setTimeout(go, 300)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
