// ============================================================
// Lenis smooth scroll
// https://github.com/darkroomengineering/lenis
// ============================================================

const lenis = new Lenis({
  duration: 0.8,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});
// RAF is handled by GSAP ticker in animations.js
