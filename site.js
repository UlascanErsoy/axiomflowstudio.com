(function () {
  'use strict'
  var root = document.documentElement
  root.classList.remove('no-js')

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // hero: the three kitchens in turn, or the one asked for. The other two are
  // fetched only once the page has loaded, each is decoded before it is shown
  // (a decode at the moment of the crossfade stalls a phone for a second),
  // and nothing turns while the hero is off screen or the tab is hidden.
  var imgs = document.querySelectorAll('.hero-img')
  var dots = document.querySelectorAll('.hero-dots .dot')
  var at = 0, timer = 0, seen = true
  function fetchRest() {
    for (var i = 0; i < imgs.length; i++) {
      var ds = imgs[i].getAttribute('data-srcset')
      if (ds) { imgs[i].srcset = ds; imgs[i].removeAttribute('data-srcset') }
    }
  }
  function ready(img) {
    if (img.hasAttribute('data-srcset')) fetchRest()
    if (!img.decode) return Promise.resolve()
    return img.decode().catch(function () {})
  }
  function show(n) {
    var to = (n + imgs.length) % imgs.length
    ready(imgs[to]).then(function () {
      at = to
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].classList.toggle('on', i === at)
        dots[i].classList.toggle('on', i === at)
        dots[i].setAttribute('aria-pressed', i === at ? 'true' : 'false')
      }
    })
  }
  function cycle() {
    clearInterval(timer)
    if (still || !seen) return
    timer = setInterval(function () { if (!document.hidden) show(at + 1) }, 7000)
  }
  for (var d = 0; d < dots.length; d++) {
    dots[d].addEventListener('click', (function (n) { return function () { show(n); cycle() } })(d))
  }
  // the first picture is on screen from the first frame (it is the page's
  // largest paint) and only settles in scale, like the others when they arrive
  if (imgs[0] && !still) {
    imgs[0].classList.add('enter')
    requestAnimationFrame(function () { requestAnimationFrame(function () { imgs[0].classList.remove('enter') }) })
  }
  if (document.readyState === 'complete') setTimeout(fetchRest, 1200)
  else window.addEventListener('load', function () { setTimeout(fetchRest, 1200) })
  var hero = document.querySelector('.hero')
  var video = /[?&]video\b/.test(location.search) && !still &&
    !(navigator.connection && navigator.connection.saveData) && document.createElement('video').canPlayType
  function stills() {
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { seen = e[0].isIntersecting; cycle() }).observe(hero)
    } else cycle()
  }
  if (video) heroVideo()
  else stills()

  // On trial (?video in the address): the showreels, rendered from our 3D
  // engine, in place of the stills. Two players, so that the next kitchen is
  // loaded before it is needed and the change is a crossfade. Each reel ends
  // on black and begins on its own still, so the crossfade reads as a fade
  // up from black, and the first reel takes over from the still on the page
  // without a visible change. Paused off screen and in a hidden tab.
  function heroVideo() {
    var ids = ['u-shape', 'open-plan', 'island']
    var stage = document.querySelector('.hero-stage')
    var shade = document.querySelector('.hero-shade')
    var probe = document.createElement('video')
    var av1 = probe.canPlayType('video/mp4; codecs="av01.0.09M.10"') === 'probably'
    var size = window.innerWidth < 760 ? 1280 : 1920
    function src(i) { return 'assets/video/' + ids[i] + '-' + size + (av1 ? '.av1' : '.h264') + '.mp4' }
    function player() {
      var v = document.createElement('video')
      v.className = 'hero-video'
      v.muted = true
      v.defaultMuted = true
      v.playsInline = true
      v.setAttribute('playsinline', '')
      v.setAttribute('aria-hidden', 'true')
      v.preload = 'auto'
      // a reel that is not there (they are not published yet): back to the stills
      v.addEventListener('error', function () {
        if (gone) return
        gone = true
        pl.forEach(function (p) { p.removeAttribute('src'); p.remove() })
        stills()
      })
      stage.insertBefore(v, shade)
      return v
    }
    var gone = false
    var pl = [player(), player()], cur = 0, kitchen = 0, visible = true
    function mark(i) {
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('on', d === i)
        dots[d].setAttribute('aria-pressed', d === i ? 'true' : 'false')
      }
    }
    function load(v, i) { v.dataset.k = String(i); v.src = src(i); v.load() }
    function play(i) {
      var next = pl[1 - cur], was = pl[cur]
      if (next.dataset.k !== String(i)) load(next, i)
      var go = function () {
        next.currentTime = 0
        var p = next.play()
        if (p && p.catch) p.catch(function () {})
        next.addEventListener('playing', function on() {
          next.removeEventListener('playing', on)
          next.classList.add('on')
          was.classList.remove('on')
          setTimeout(function () { if (!was.classList.contains('on')) was.pause() }, 900)
          cur = 1 - cur
          kitchen = i
          mark(i)
          // the one after, ready in the other player
          setTimeout(function () { load(pl[1 - cur], (i + 1) % ids.length) }, 1500)
        })
      }
      if (next.readyState >= 3) go()
      else next.addEventListener('canplay', function c() { next.removeEventListener('canplay', c); go() })
    }
    pl.forEach(function (v) {
      v.addEventListener('ended', function () { if (v === pl[cur]) play((kitchen + 1) % ids.length) })
    })
    for (var d = 0; d < dots.length; d++) {
      dots[d].addEventListener('click', (function (n) { return function (ev) {
        if (gone) return
        ev.stopImmediatePropagation()
        if (n !== kitchen) play(n)
      } })(d), true)
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting
        var v = pl[cur]
        if (!v.classList.contains('on')) return
        if (visible && !document.hidden) { var p = v.play(); if (p && p.catch) p.catch(function () {}) } else v.pause()
      }).observe(hero)
    }
    document.addEventListener('visibilitychange', function () {
      var v = pl[cur]
      if (!v.classList.contains('on')) return
      if (document.hidden || !visible) v.pause()
      else { var p = v.play(); if (p && p.catch) p.catch(function () {}) }
    })
    // the still is on the page already; the first reel starts on that very frame
    load(pl[1], 0)
    play(0)
  }

  // things rise into view as they are reached
  var items = document.querySelectorAll('.reveal')
  if ('IntersectionObserver' in window && !still) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    items.forEach(function (el) {
      // siblings in a row follow one another
      var sibs = el.parentElement ? el.parentElement.querySelectorAll(':scope > .reveal') : []
      var i = Array.prototype.indexOf.call(sibs, el)
      if (i > 0) el.style.setProperty('--delay', (i * 0.08).toFixed(2) + 's')
      io.observe(el)
    })
  } else {
    items.forEach(function (el) { el.classList.add('in') })
  }

  var y = document.getElementById('year')
  if (y) y.textContent = String(new Date().getFullYear())
})()
