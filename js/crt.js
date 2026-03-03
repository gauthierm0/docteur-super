// ============================================================
// WebGL CRT Shader — overlay implementation
//
// Curvature (barrel distortion) — backdrop-filter: url(#crt-barrel) on a
//   position:fixed div. Viewport-relative, scroll-proof, distorts everything
//   behind it (all page content including .hero-title + .description).
//
// Color correction   — backdrop-filter: brightness/contrast/saturate
// Bloom              — backdrop-filter: blur + mix-blend-mode:screen
// Scanlines/grain/
//  vignette/flicker  — WebGL2 canvas, mix-blend-mode:multiply
// ============================================================
(function () {
  'use strict';

  var DEFAULTS = {
    enabled:           true,
    scanlineIntensity: 0.28,
    scanlineCount:     488,
    adaptiveIntensity: 0.27,
    brightness:        1.25,
    contrast:          1.08,
    saturation:        1.24,
    bloomIntensity:    0.83,
    bloomThreshold:    0.49,
    rgbShift:          0.70,
    vignetteStrength:  0.17,
    curvature:         0.335,
    flickerStrength:   0.00,
  };

  var params = Object.assign({}, DEFAULTS);

  // ── SVG barrel-distortion filter (used by barrelDiv via backdrop-filter) ──
  var svgNS   = 'http://www.w3.org/2000/svg';
  var xlinkNS = 'http://www.w3.org/1999/xlink';

  var barrelSVG = document.createElementNS(svgNS, 'svg');
  barrelSVG.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');

  var defs   = document.createElementNS(svgNS, 'defs');
  var filter = document.createElementNS(svgNS, 'filter');
  filter.id  = 'crt-barrel';
  filter.setAttribute('x', '-5%');
  filter.setAttribute('y', '-5%');
  filter.setAttribute('width',  '110%');
  filter.setAttribute('height', '110%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  var feImg = document.createElementNS(svgNS, 'feImage');
  feImg.id  = 'crt-barrel-img';
  feImg.setAttribute('preserveAspectRatio', 'none');
  feImg.setAttribute('result', 'dmap');

  var feDisp = document.createElementNS(svgNS, 'feDisplacementMap');
  feDisp.id  = 'crt-barrel-disp';
  feDisp.setAttribute('in',              'SourceGraphic');
  feDisp.setAttribute('in2',             'dmap');
  feDisp.setAttribute('scale',           '0');
  feDisp.setAttribute('xChannelSelector','R');
  feDisp.setAttribute('yChannelSelector','G');

  filter.appendChild(feImg);
  filter.appendChild(feDisp);
  defs.appendChild(filter);
  barrelSVG.appendChild(defs);
  document.body.appendChild(barrelSVG);

  // Reusable canvas for the displacement map
  var barrelCanvas = document.createElement('canvas');
  barrelCanvas.width = barrelCanvas.height = 256;

  function buildBarrelMap(curvature) {
    var size = 256;
    var ctx  = barrelCanvas.getContext('2d');
    var id   = ctx.createImageData(size, size);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var nx = (x / (size - 1)) * 2 - 1;   // −1 … +1
        var ny = (y / (size - 1)) * 2 - 1;
        var r2 = nx * nx + ny * ny;
        // Barrel: pull corners outward (matches curveRemapUV from CRTShader)
        var dx = nx * r2 * curvature;
        var dy = ny * r2 * curvature;
        var i  = (y * size + x) * 4;
        id.data[i]     = Math.max(0, Math.min(255, Math.round(128 + dx * 127)));
        id.data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 127)));
        id.data[i + 2] = 0;
        id.data[i + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  // ── Layer 0: Barrel distortion (backdrop-filter on fixed viewport div) ──
  // position:fixed + backdrop-filter → viewport-relative, scroll-proof.
  // Sits BELOW the color/bloom divs so those stack correctly on top.
  var barrelDiv = document.createElement('div');
  barrelDiv.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:999993;';
  document.body.appendChild(barrelDiv);

  function applyCurvature() {
    var c = params.enabled ? params.curvature : 0;
    if (c < 0.001) {
      barrelDiv.style.backdropFilter = '';
      return;
    }
    buildBarrelMap(c);
    var url = barrelCanvas.toDataURL('image/png');
    feImg.setAttribute('href', url);
    feImg.setAttributeNS(xlinkNS, 'xlink:href', url);
    // scale = max pixel displacement; at corner (r²=2, c=0.1): ~30 px
    feDisp.setAttribute('scale', String((c * 300).toFixed(1)));
    barrelDiv.style.backdropFilter = 'url(#crt-barrel)';
  }
  applyCurvature();

  // ── Layer 1: Color correction ────────────────────────────────
  var colorDiv = document.createElement('div');
  colorDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999994;';
  document.body.appendChild(colorDiv);

  function applyColorFilter() {
    if (!params.enabled) { colorDiv.style.backdropFilter = ''; return; }
    colorDiv.style.backdropFilter =
      'brightness(' + params.brightness + ') contrast(' + params.contrast +
      ') saturate(' + params.saturation + ')';
  }
  applyColorFilter();

  // ── Layer 2: Bloom ───────────────────────────────────────────
  var bloomDiv = document.createElement('div');
  bloomDiv.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:999995;mix-blend-mode:screen;';
  document.body.appendChild(bloomDiv);

  function applyBloom() {
    var intensity = params.enabled ? params.bloomIntensity : 0;
    if (intensity < 0.001) {
      bloomDiv.style.backdropFilter = '';
      bloomDiv.style.opacity = '0';
      return;
    }
    var blur = 8 + (1 - params.bloomThreshold) * 24;
    bloomDiv.style.backdropFilter = 'blur(' + blur.toFixed(1) + 'px)';
    bloomDiv.style.opacity = (intensity * 0.35).toFixed(3);
  }
  applyBloom();

  // ── Layer 3: WebGL canvas (scanlines, grain, vignette, flicker) ──
  var canvas = document.createElement('canvas');
  canvas.id = 'crt-canvas';
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;' +
    'z-index:999997;mix-blend-mode:multiply;';
  document.body.appendChild(canvas);

  var gl = canvas.getContext('webgl2', { alpha: false });
  if (!gl) gl = canvas.getContext('webgl', { alpha: false });

  if (gl) {
    var isGL2 = !!canvas.getContext('webgl2');

    var VS = isGL2
      ? [ '#version 300 es',
          'precision highp float;',
          'const vec2 POS[4]=vec2[4](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(1,1));',
          'const vec2 UVS[4]=vec2[4](vec2(0,0),vec2(1,0),vec2(0,1),vec2(1,1));',
          'out vec2 vUv;',
          'void main(){vUv=UVS[gl_VertexID];gl_Position=vec4(POS[gl_VertexID],0.,1.);}',
        ].join('\n')
      : 'attribute vec2 aPos,aUv;varying vec2 vUv;' +
        'void main(){vUv=aUv;gl_Position=vec4(aPos,0.,1.);}';

    var FS_BODY = [
      'uniform float uTime,uScanlineIntensity,uScanlineCount,uAdaptiveIntensity;',
      'uniform float uVignetteStrength,uFlickerStrength,uRgbShift;',
      'const float PI=3.14159265;',
      'float hash21(vec2 p){p=fract(p*vec2(443.8975,397.2973));p+=dot(p,p+19.19);return fract(p.x*p.y);}',
      'void main(){',
      '  vec2 uv=vUv;',
      '  vec3 col=vec3(1.);',
      '  if(uScanlineIntensity>0.001){',
      '    float sl=abs(sin(uv.y*uScanlineCount*PI));',
      '    float ad=1.;',
      '    if(uAdaptiveIntensity>0.001) ad=1.-sin(uv.y*30.)*0.5*uAdaptiveIntensity*0.2;',
      '    col*=1.-sl*uScanlineIntensity*ad;',
      '  }',
      '  if(uRgbShift>0.005&&uScanlineIntensity>0.001){',
      '    float sh=uRgbShift*0.002;',
      '    float slR=abs(sin((uv.y+sh)*uScanlineCount*PI));',
      '    float slB=abs(sin((uv.y-sh)*uScanlineCount*PI));',
      '    float amt=uRgbShift*0.06;',
      '    col.r=max(0.,col.r-slR*uScanlineIntensity*amt);',
      '    col.b=max(0.,col.b-slB*uScanlineIntensity*amt);',
      '  }',
      '  col*=0.85+hash21(uv+fract(uTime*0.37))*0.15;',
      '  if(uVignetteStrength>0.001){',
      '    vec2 v=uv*2.-1.;float d=max(abs(v.x),abs(v.y));',
      '    col*=clamp(1.-d*d*uVignetteStrength,0.,1.);',
      '  }',
      '  if(uFlickerStrength>0.001) col*=1.+sin(uTime*110.)*uFlickerStrength;',
      '  OUT=vec4(clamp(col,0.,1.),1.);',
      '}',
    ].join('\n');

    var FS = isGL2
      ? '#version 300 es\nprecision highp float;\nin vec2 vUv;\nout vec4 fragColor;\n' +
        FS_BODY.replace(/OUT/g, 'fragColor')
      : 'precision highp float;\nvarying vec2 vUv;\n' +
        FS_BODY.replace(/OUT/g, 'gl_FragColor');

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error('CRT shader error:', gl.getShaderInfoLog(s));
      return s;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    if (!isGL2) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]),
        gl.STATIC_DRAW);
      var aPos = gl.getAttribLocation(prog, 'aPos');
      var aUv  = gl.getAttribLocation(prog, 'aUv');
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(aUv,  2, gl.FLOAT, false, 16, 8);
    } else {
      gl.bindVertexArray(gl.createVertexArray());
    }

    var U = {};
    ['uTime','uScanlineIntensity','uScanlineCount','uAdaptiveIntensity',
     'uVignetteStrength','uFlickerStrength','uRgbShift',
    ].forEach(function(n) { U[n] = gl.getUniformLocation(prog, n); });

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function render(ts) {
      var t = ts * 0.001, on = params.enabled;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform1f(U.uTime,              t);
      gl.uniform1f(U.uScanlineIntensity, on ? params.scanlineIntensity : 0);
      gl.uniform1f(U.uScanlineCount,     params.scanlineCount);
      gl.uniform1f(U.uAdaptiveIntensity, params.adaptiveIntensity);
      gl.uniform1f(U.uVignetteStrength,  on ? params.vignetteStrength  : 0);
      gl.uniform1f(U.uFlickerStrength,   on ? params.flickerStrength   : 0);
      gl.uniform1f(U.uRgbShift,          on ? params.rgbShift          : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

})();
