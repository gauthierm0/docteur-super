// ============================================================
// Pixel reveal — canvas-based, GSAP ScrollTrigger driven
// Phase 1: random 32px pixel blocks emerge from red background
// Phase 2: full image resolves from 16px → 8px → 4px → sharp
// ============================================================

gsap.registerPlugin(ScrollTrigger);

// ── Lenis + GSAP ticker integration ─────────────────────────
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

// ── Config ───────────────────────────────────────────────────
const STEPS        = 5;                    // discrete pixelation steps
const DURATION     = 0.7;                  // seconds per reveal
const REFINE_SIZES = [32, 16, 8, 4, 2];   // block sizes per step



// ── Core ─────────────────────────────────────────────────────
function setupReveal(container) {
  const img = container.querySelector('img');
  if (!img) return;

  // Keep real image hidden behind the canvas at all times
  img.style.opacity = '0';

  let canvas, ctx, tmp, tmpCtx, w, h;
  let triggered = false;
  let loaded    = false;

  function initCanvas() {
    w = container.offsetWidth;
    h = container.offsetHeight;
    canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.style.position = 'relative';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    tmp    = document.createElement('canvas');
    tmpCtx = tmp.getContext('2d');
  }

  function drawStep(sz) {
    const pw = Math.max(1, Math.round(w / sz));
    const ph = Math.max(1, Math.round(h / sz));
    tmp.width  = pw;
    tmp.height = ph;
    tmpCtx.imageSmoothingEnabled = false;
    tmpCtx.drawImage(img, 0, 0, pw, ph);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmp, 0, 0, w, h);
  }

  function animate() {
    const proxy = { t: 0 };
    gsap.to(proxy, {
      t: 1,
      duration: DURATION,
      ease: `steps(${STEPS})`,
      onUpdate() {
        const step = Math.round(proxy.t * STEPS);
        drawStep(REFINE_SIZES[Math.min(step, REFINE_SIZES.length - 1)]);
      },
      onComplete() {
        gsap.to(canvas, {
          opacity: 0, duration: 0.15, ease: 'none',
          onStart() { img.style.opacity = '1'; },
          onComplete() { canvas.remove(); },
        });
      },
    });
  }

  // As soon as the image is decoded: paint pixelated canvas immediately.
  // This happens before the scroll trigger, so the image is already
  // visible on screen in its pixelated state when the user sees it.
  function onLoad() {
    loaded = true;
    initCanvas();
    drawStep(REFINE_SIZES[0]); // paint most-pixelated frame right away
    if (triggered) animate();  // trigger already fired → start resolving
  }

  if (img.complete && img.naturalWidth > 0) {
    onLoad();
  } else {
    img.addEventListener('load', onLoad, { once: true });
  }

  ScrollTrigger.create({
    trigger: container,
    start: 'center bottom',
    once: true,
    onEnter() {
      triggered = true;
      if (loaded) {
        animate();
      } else {
        // Image not decoded yet — nudge browser then wait for onLoad
        img.loading = 'eager';
      }
    },
  });
}

document.querySelectorAll('.img').forEach(setupReveal);
