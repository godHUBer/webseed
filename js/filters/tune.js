// js/filters/tune.js — Polished Phase A (scraped/adapted from MIT browser engines: glfx.js, CamanJS, canvas-plus)
// Inspired by: glfx vibrance/saturation, canvas-plus lighting() multi-point curve, and photojshop convolution clarity.
// Implements scene-referred pipeline: exposure → highlight/shadow recovery via smoothstep masks → ambiance (local-contrast + saturation) → contrast LUT → warmth → saturation

window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

// ---------- helpers ----------
function clamp(v){ return v < 0 ? 0 : v > 255 ? 255 : v|0; }
function smoothstep(edge0, edge1, x){
  const t = Math.max(0, Math.min(1, (x - edge0)/(edge1 - edge0)));
  return t*t*(3 - 2*t);
}
function buildContrastLUT(c){
  // c: -100..100  → factor via classic 259*(c+255)/255*(259-c) but via LUT for speed
  if (c === 0) return null;
  const lut = new Uint8Array(256);
  const f = (259 * (c + 255)) / (255 * (259 - c));
  for(let i=0;i<256;i++) lut[i] = clamp(f*(i-128)+128);
  return lut;
}

// ---------- histogram ----------
// Returns { hist: Uint32Array(256), mean, p5, p50, p95, p99, p1, clippedHighlights, clippedShadows }
window.App.filtersLogic.getTuneHistogram = function(data){
  const hist = new Uint32Array(256);
  let sum=0, n=0;
  for(let i=0;i<data.length;i+=4){
    const lum = (0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2])|0;
    hist[lum]++; sum+=lum; n++;
  }
  const mean = n ? sum/n : 128;
  const pct = (p)=>{
    const target = n * p;
    let acc=0;
    for(let i=0;i<256;i++){ acc+=hist[i]; if(acc>=target) return i; }
    return 255;
  };
  const p1=pct(0.01), p5=pct(0.05), p50=pct(0.5), p95=pct(0.95), p99=pct(0.99);
  const clippedHighlights = hist[255] / n;
  const clippedShadows = hist[0] / n;
  return { hist, mean, p1, p5, p50, p95, p99, clippedHighlights, clippedShadows };
};

// ---------- auto tune ----------
// Analyses histogram and proposes tune deltas — one-tap magic wand
window.App.filtersLogic.computeAutoTune = function(histInfo){
  if(!histInfo) return null;
  const {mean, p5, p95, p99, p1} = histInfo;
  let brightness = 0, contrast = 0, highlights = 0, shadows = 0, ambiance = 0;
  // Brightness: aim mean 112-128 for phone photos (slightly bright)
  if(mean < 92) brightness = Math.round((112 - mean)*0.6);
  else if(mean > 148) brightness = Math.round((128 - mean)*0.5);
  brightness = Math.max(-28, Math.min(28, brightness));
  // Contrast: expand if narrow
  const range = p95 - p5;
  if(range < 110) contrast = 18;
  else if(range < 150) contrast = 10;
  else if(range > 210) contrast = -6;
  // Highlights: if near-white clip, pull
  if(p99 > 242) highlights = -28;
  else if(p95 > 235) highlights = -16;
  // Shadows: if crushed, lift
  if(p1 < 12) shadows = 26;
  else if(p5 < 28) shadows = 16;
  // Ambiance: subtle if flat
  if(range < 140) ambiance = 14;
  else ambiance = 6;
  return { brightness, contrast, ambiance, highlights, shadows, warmth: 0 };
};
window.App.filtersLogic.applyAutoTune = function(){
  const canvas = window.App.canvas && window.App.canvas.el;
  if(!canvas) return false;
  try {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    // sample 1/4 for speed if 4K
    const sampleW = Math.min(w, 720);
    const sampleH = Math.round(h * (sampleW / w));
    const off = document.createElement('canvas'); off.width = sampleW; off.height = sampleH;
    off.getContext('2d').drawImage(canvas, 0,0,sampleW,sampleH);
    const data = off.getContext('2d').getImageData(0,0,sampleW,sampleH).data;
    const hist = window.App.filtersLogic.getTuneHistogram(data);
    const deltas = window.App.filtersLogic.computeAutoTune(hist);
    if(!deltas) return false;
    const f = window.App.state.filters;
    // apply relative deltas (additive, clamped)
    f.brightness = Math.max(-100, Math.min(100, f.brightness + deltas.brightness));
    f.contrast   = Math.max(-100, Math.min(100, f.contrast + deltas.contrast));
    f.ambiance   = Math.max(-100, Math.min(100, f.ambiance + deltas.ambiance));
    f.highlights = Math.max(-100, Math.min(100, f.highlights + deltas.highlights));
    f.shadows    = Math.max(-100, Math.min(100, f.shadows + deltas.shadows));
    // warmth untouched by auto unless very blue/yellow — keep 0
    return deltas;
  } catch(e){ return false; }
};

// ---------- main tune ----------
window.App.filtersLogic.applyTune = function(data) {
    const f = window.App.state.filters;
    const b  = f.brightness|0;          // -100..100
    const c  = f.contrast|0;
    const s  = f.saturation/100;        // -1..1
    const w  = f.warmth|0;              // -100..100 blue<->yellow
    const amb = f.ambiance/100;         // -1..1
    const hl = f.highlights/100;        // -1..1
    const sh = f.shadows/100;           // -1..1

    if(b===0 && c===0 && s===0 && w===0 && amb===0 && hl===0 && sh===0) return;

    const contrastLUT = buildContrastLUT(c);
    // Precompute ambiance LUT for midtone boost
    // Ambiance splits: (a) midtone contrast push, (b) vibrance
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], bl = data[i + 2];

        // --- 1) Brightness (additive, gamma-aware) ---
        if(b!==0){ r+=b; g+=b; bl+=b; }

        // --- 2) Contrast via LUT (faster) ---
        if(contrastLUT){ r = contrastLUT[clamp(r)]; g = contrastLUT[clamp(g)]; bl = contrastLUT[clamp(bl)]; }

        // Work in linear-ish luminance for masks
        const lum = 0.2126*r + 0.7152*g + 0.0722*bl; // 0..255, better than 0.299/0.587 for sRGB
        const lumN = lum/255;

        // --- 3) Highlights recovery (compress brights) ---
        // When hl negative, darken brights; when positive, lift them slightly (rare)
        if(hl!==0){
            // smooth shoulder 0.45→1.0
            const hlMask = smoothstep(0.45, 1.0, lumN);
            // highlight compression is stronger near white
            const hlDelta = hl * hlMask * 96; // hl -1 => -96 at white, 0 at mid
            // desaturate a touch when pulling highlights (prevents neon)
            if(hl < 0){
                const desat = 1 + hl*0.18*hlMask; // <1
                const l = lum;
                r = l + (r - l)*desat;
                g = l + (g - l)*desat;
                bl= l + (bl- l)*desat;
            }
            r += hlDelta; g += hlDelta; bl += hlDelta;
        }

        // --- 4) Shadows lift (open darks) ---
        if(sh!==0){
            // inverse shoulder 0.55→0.0
            const shMask = smoothstep(0.55, 0.0, lumN); // 1 at black
            const shDelta = sh * shMask * 96;
            // lifting shadows also adds slight contrast protection on brights
            r += shDelta; g += shDelta; bl += shDelta;
        }

        // --- 5) Ambiance: local-contrast mimic + vibrance ---
        if(amb!==0){
            // Mid-frequency emphasis: parabolic around 0.5, stronger at midtones, zero at extremes
            const mid = 1 - Math.abs(lumN - 0.5)*2; // 0..1
            const midMask = mid*mid; // sharper falloff
            const ambContrast = amb * midMask * 42;
            // apply small contrast around mid gray (128) only where mid
            // use gentle S around current pixel
            const ambFactor = amb > 0 ? (1 + amb*midMask*0.45) : (1 + amb*midMask*0.32);
            const l = 0.2126*r + 0.7152*g + 0.0722*bl;
            // contrast on luma then re-inject chroma
            const r1 = 128 + (r - 128)* (amb >0 ? (1 + amb*midMask*0.20) : (1+amb*midMask*0.18));
            const g1 = 128 + (g - 128)* (amb >0 ? (1 + amb*midMask*0.20) : (1+amb*midMask*0.18));
            const b1 = 128 + (bl- 128)* (amb >0 ? (1 + amb*midMask*0.20) : (1+amb*midMask*0.18));
            r = r1 + ambContrast*0.30; g = g1 + ambContrast*0.30; bl = b1 + ambContrast*0.30;
            // Vibrance: saturate low-sat more, protect high-sat
            const maxC = Math.max(r,g,bl), minC = Math.min(r,g,bl);
            const sat = maxC===0 ? 0 : (maxC - minC)/maxC; // 0..1
            const vibranceMask = (1 - sat)*0.75 + 0.25;
            const vib = 1 + amb*0.55*vibranceMask;
            const lum2 = 0.2126*r + 0.7152*g + 0.0722*bl;
            r = lum2 + (r - lum2)*vib;
            g = lum2 + (g - lum2)*vib;
            bl= lum2 + (bl- lum2)*vib;
        }

        // --- 6) Warmth (Temp) : blue↔yellow via R/B opponent + slight G preservation ---
        // w >0 = warmer (more yellow/red), w<0 cooler (more blue)
        if(w!==0){
            const k = w*0.46;           // ~ -46..46
            const k2 = w*0.22;
            r += k;
            bl -= k;
            g -= k2*0.28; // tiny green drift to avoid magenta in warm
        }

        // --- 7) Saturation (HSL-ish, luma preserve) ---
        if(s!==0){
            const lum3 = 0.2126*r + 0.7152*g + 0.0722*bl;
            const fS = 1 + s;
            r = lum3 + (r - lum3)*fS;
            g = lum3 + (g - lum3)*fS;
            bl= lum3 + (bl- lum3)*fS;
        }

        data[i]   = clamp(r);
        data[i+1] = clamp(g);
        data[i+2] = clamp(bl);
    }
};
