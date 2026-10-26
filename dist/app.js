(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var palette = ["#5eead4", "#38bdf8", "#a78bfa", "#f472b6", "#fbbf24"];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setupClock() {
    var output = document.getElementById("clock");
    var pill = document.getElementById("clock-pill");
    if (!output) return;
    function tick() {
      var now = new Date();
      var text = now.toLocaleTimeString("es-ES", { hour12: false });
      output.textContent = text;
      if (pill) pill.setAttribute("aria-label", "Hora local: " + text);
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function setupScene() {
    var canvas = document.getElementById("scene");
    if (!canvas) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    var fpsNode = document.getElementById("fps");
    var wrap = canvas.parentElement;

    if (!ctx) {
      if (wrap) wrap.setAttribute("aria-label", "Tu navegador no soporta Canvas 2D.");
      return;
    }

    var state = {
      width: 0,
      height: 0,
      dpr: 1,
      gravity: 0.4,
      density: 90,
      link: 110,
      paused: false,
      pointer: { x: -1000, y: -1000, active: false },
      particles: [],
      frame: 0,
      lastTime: performance.now(),
      fpsTime: performance.now(),
      fpsFrames: 0,
      rendered: false
    };

    function makeParticle() {
      var angle = Math.random() * Math.PI * 2;
      var speed = 0.15 + Math.random() * 0.55;
      return {
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.3 + Math.random() * 2.4,
        color: palette[(Math.random() * palette.length) | 0],
        alpha: 0.45 + Math.random() * 0.5
      };
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      var width = Math.max(1, Math.round(rect.width));
      var height = Math.max(1, Math.round(rect.height));
      state.width = width;
      state.height = height;
      state.dpr = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed(false);
      if (state.paused) draw();
    }

    function seed(resetConsole) {
      var target = Math.round(state.density);
      var particles = state.particles || [];
      while (particles.length < target) particles.push(makeParticle());
      if (particles.length > target) particles.length = target;
      state.particles = particles;
      if (resetConsole) {
        updateConsole("mundo generado con " + target + " partículas");
      }
      if (!state.rendered) {
        state.rendered = true;
        draw();
        document.documentElement.setAttribute("data-app-ready", "true");
      }
    }

    function step(now) {
      if (state.paused) {
        state.lastTime = now;
        window.requestAnimationFrame(step);
        return;
      }
      var dt = clamp((now - state.lastTime) / 16.6667, 0.2, 2.4);
      state.lastTime = now;
      update(dt);
      draw();
      countFps(now);
      window.requestAnimationFrame(step);
    }

    function update(dt) {
      var gravity = state.gravity * 0.05;
      var pointer = state.pointer;
      var particles = state.particles;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.vy += gravity * dt;

        if (pointer.active) {
          var dx = pointer.x - p.x;
          var dy = pointer.y - p.y;
          var distSq = dx * dx + dy * dy;
          if (distSq < 200 * 200 && distSq > 1) {
            var dist = Math.sqrt(distSq);
            var force = (1 - dist / 200) * 0.09 * dt;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < -12) { p.x = -12; p.vx = Math.abs(p.vx) * 0.85; }
        if (p.x > state.width + 12) { p.x = state.width + 12; p.vx = -Math.abs(p.vx) * 0.85; }
        if (p.y < -12) { p.y = -12; p.vy = Math.abs(p.vy) * 0.85; }
        if (p.y > state.height + 12) { p.y = state.height + 12; p.vy = -Math.abs(p.vy) * 0.85; }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, state.width, state.height);
      var particles = state.particles;
      var limit = state.link;
      var limitSq = limit * limit;

      ctx.lineWidth = 0.7;
      for (var i = 0; i < particles.length; i++) {
        var a = particles[i];
        for (var j = i + 1; j < particles.length; j++) {
          var b = particles[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var distSq = dx * dx + dy * dy;
          if (distSq > limitSq) continue;
          var strength = 1 - distSq / limitSq;
          ctx.globalAlpha = strength * 0.28;
          ctx.strokeStyle = a.color;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (var k = 0; k < particles.length; k++) {
        var p = particles[k];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        if (p.radius > 2.6) {
          ctx.globalAlpha = p.alpha * 0.18;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (state.pointer.active) {
        var glow = ctx.createRadialGradient(
          state.pointer.x, state.pointer.y, 0,
          state.pointer.x, state.pointer.y, 90
        );
        glow.addColorStop(0, "rgba(94, 234, 212, 0.16)");
        glow.addColorStop(1, "rgba(94, 234, 212, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(state.pointer.x, state.pointer.y, 90, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function countFps(now) {
      state.fpsFrames++;
      if (now - state.fpsTime < 700) return;
      var fps = Math.round((state.fpsFrames * 1000) / (now - state.fpsTime));
      state.fpsTime = now;
      state.fpsFrames = 0;
      if (fpsNode) fpsNode.textContent = fps + " fps";
    }

    function movePointer(event) {
      var rect = canvas.getBoundingClientRect();
      state.pointer.x = event.clientX - rect.left;
      state.pointer.y = event.clientY - rect.top;
      state.pointer.active = true;
    }

    canvas.addEventListener("pointermove", movePointer, { passive: true });
    canvas.addEventListener("pointerdown", movePointer, { passive: true });
    canvas.addEventListener("pointerleave", function () {
      state.pointer.active = false;
      state.pointer.x = -1000;
      state.pointer.y = -1000;
    });

    var resizeObserver = new ResizeObserver(function () { resize(); });
    resizeObserver.observe(canvas);

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", function () {
      state.lastTime = performance.now();
    });

    resize();
    seed(true);
    if (!reduceMotion) {
      window.requestAnimationFrame(function (now) {
        state.lastTime = now;
        state.fpsTime = now;
        window.requestAnimationFrame(step);
      });
    } else {
      draw();
    }

    return state;
  }

  var consoleNode = null;
  var consoleCount = null;
  var consoleTimer = null;

  function updateConsole(message) {
    if (!consoleNode) {
      consoleNode = document.getElementById("console-output");
      consoleCount = document.getElementById("console-count");
    }
    if (!consoleNode) return;
    var line = "> " + message;
    consoleNode.textContent = line;
    if (consoleCount) consoleCount.textContent = "ok";
    window.clearTimeout(consoleTimer);
    if (consoleCount) {
      consoleTimer = window.setTimeout(function () {
        consoleCount.textContent = "";
      }, 1800);
    }
  }

  function setupControls(scene) {
    if (!scene) return;
    var gravity = document.getElementById("gravity");
    var density = document.getElementById("density");
    var link = document.getElementById("link");
    var gravityValue = document.getElementById("gravity-value");
    var densityValue = document.getElementById("density-value");
    var linkValue = document.getElementById("link-value");
    var toggle = document.getElementById("toggle");
    var run = document.getElementById("run");

    function syncLabels() {
      if (gravityValue) gravityValue.textContent = Number(scene.gravity).toFixed(2);
      if (densityValue) densityValue.textContent = String(Math.round(scene.density));
      if (linkValue) linkValue.textContent = String(Math.round(scene.link));
    }

    if (gravity) {
      gravity.value = String(scene.gravity);
      gravity.addEventListener("input", function () {
        scene.gravity = Number(gravity.value);
        syncLabels();
        updateConsole("gravedad = " + scene.gravity.toFixed(2));
      });
    }

    if (density) {
      density.value = String(scene.density);
      density.addEventListener("input", function () {
        scene.density = Number(density.value);
        syncLabels();
        scene.particles.length = 0;
        window.dispatchEvent(new Event("playground:reseed"));
      });
    }

    if (link) {
      link.value = String(scene.link);
      link.addEventListener("input", function () {
        scene.link = Number(link.value);
        syncLabels();
        updateConsole("enlaces = " + scene.link + " px");
      });
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        scene.paused = !scene.paused;
        toggle.textContent = scene.paused ? "Reanudar" : "Pausar";
        updateConsole(scene.paused ? "simulación en pausa" : "simulación reanudada");
      });
    }

    if (run) {
      run.addEventListener("click", function () {
        scene.paused = false;
        if (toggle) toggle.textContent = "Pausar";
        scene.particles.length = 0;
        scene.pointer.active = false;
        window.dispatchEvent(new Event("playground:reseed"));
        updateConsole("reiniciado a " + Math.round(scene.density) + " partículas");
      });
    }

    window.addEventListener("playground:reseed", function () {
      var target = Math.round(scene.density);
      while (scene.particles.length < target) {
        scene.particles.push({
          x: Math.random() * scene.width,
          y: Math.random() * scene.height,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1,
          radius: 1.3 + Math.random() * 2.4,
          color: palette[(Math.random() * palette.length) | 0],
          alpha: 0.45 + Math.random() * 0.5
        });
      }
      scene.particles.length = target;
    });

    syncLabels();
  }

  function setupReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".card, .details-panel, .section-head");
    if (!targets.length) return;
    for (var i = 0; i < targets.length; i++) {
      targets[i].style.opacity = "0";
      targets[i].style.transform = "translateY(14px)";
      targets[i].style.transition = "opacity 0.6s ease, transform 0.6s ease";
    }
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.style.opacity = "1";
        entries[i].target.style.transform = "translateY(0)";
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (var j = 0; j < targets.length; j++) observer.observe(targets[j]);
  }

  function boot() {
    setupClock();
    var scene = setupScene();
    setupControls(scene);
    setupReveal();
    updateConsole("playground listo — mueve el cursor");
    if (!document.documentElement.getAttribute("data-app-ready")) {
      document.documentElement.setAttribute("data-app-ready", "true");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
