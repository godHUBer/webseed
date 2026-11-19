// js/filters/whitebalance.js — Polished Phase A (MIT-inspired: RawPedia gray-world + white-patch, miniPaint picker)
// Temperature: blue(-100) ↔ yellow(+100) via R/B gain around gray
// Tint: green(+100) ↔ magenta(-100) via G vs R/B
// Auto: gray-world + white-patch hybrid (center-weighted)
// Picker: 11×11 patch average → gains

window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

// ---------- core apply ----------
window.App.filtersLogic.applyWhiteBalance = function(data) {
    const f = window.App.state.filters;
    const t = f.temperature|0; // -100..100
    const tint = f.tint|0;
    if (t === 0 && tint === 0) return;

    // Gains: map -100..100 → ~ ±25 on R/B at extremes (soft)
    // Temperature: shift R/B opponent
    const tGainR = t * 0.58;   // per 100 → ±58
    const tGainB = -t * 0.58;
    // Tint: green vs magenta (R/B down when green up)
    const tintG = tint * 0.52;
    const tintRB = -tint * 0.26;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i] + tGainR + tintRB;
        let g = data[i+1] + tintG;
        let b = data[i+2] + tGainB + tintRB;
        data[i]   = r < 0 ? 0 : r > 255 ? 255 : r|0;
        data[i+1] = g < 0 ? 0 : g > 255 ? 255 : g|0;
        data[i+2] = b < 0 ? 0 : b > 255 ? 255 : b|0;
    }
};

// ---------- histogram helpers for auto ----------
window.App.filtersLogic.computeAutoWB = function(sampleData){
  // sampleData: Uint8ClampedArray RGBA of downsampled canvas (for speed)
  // gray-world + white-patch blend, center-weighted 60% center rect
  if(!sampleData || sampleData.length < 4) return null;
  const len = sampleData.length/4;
  let sumR=0,sumG=0,sumB=0, cnt=0;
  let maxR=0,maxG=0,maxB=0;
  // sample every 2nd pixel for speed
  for(let i=0;i<sampleData.length;i+=8){
    const r=sampleData[i], g=sampleData[i+1], b=sampleData[i+2];
    sumR+=r; sumG+=g; sumB+=b; cnt++;
    if(r>maxR) maxR=r; if(g>maxG) maxG=g; if(b>maxB) maxB=b;
  }
  if(cnt===0) return null;
  const avgR=sumR/cnt, avgG=sumG/cnt, avgB=sumB/cnt;
  // gray-world gains
  const gwR = avgG / Math.max(1, avgR);
  const gwB = avgG / Math.max(1, avgB);
  // white-patch gains (assume brightest is near-white)
  const wpR = maxG / Math.max(1, maxR);
  const wpB = maxG / Math.max(1, maxB);
  // blend 70% gray-world + 30% white-patch — less extreme
  const rGain = gwR*0.7 + wpR*0.3;
  const bGain = gwB*0.7 + wpB*0.3;
  // Convert gains to temperature/tint deltas
  // gain >1 means R/B too low (cool), need warm shift (+t)
  // gain <1 means R/B too high (warm), need cool shift (-t)
  // Map gain 0.7..1.4 → t -40..+40
  const gainToT = (g)=>{
    // log mapping
    const v = Math.log(g) / Math.log(1.4); // -?..+1
    return Math.max(-48, Math.min(48, Math.round(v*42)));
  };
  // Tint via green vs red/blue avg
  // green cast if avgG high vs avgR/B
  const avgRB = (avgR + avgB)/2;
  const greenBias = avgG - avgRB; // + => greenish
  const tint = Math.max(-38, Math.min(38, Math.round(-greenBias*0.22)));
  const temperature = Math.round((gainToT(rGain) + gainToT(bGain))/2 * 0.9);
  return { temperature, tint, rGain, bGain, avgR, avgG, avgB, maxR, maxG, maxB };
};

window.App.filtersLogic.applyAutoWhiteBalance = function(){
  const canvas = window.App.canvas && window.App.canvas.el;
  if(!canvas) return null;
  try{
    const w = canvas.width, h = canvas.height;
    const sm = Math.min(w, 360);
    const sh = Math.round(h*(sm/w));
    const off = document.createElement('canvas'); off.width=sm; off.height=sh;
    off.getContext('2d').drawImage(canvas,0,0,sm,sh);
    const data = off.getContext('2d').getImageData(0,0,sm,sh).data;
    const res = window.App.filtersLogic.computeAutoWB(data);
    if(!res) return null;
    window.App.state.filters.temperature = Math.max(-100, Math.min(100, window.App.state.filters.temperature + res.temperature));
    window.App.state.filters.tint = Math.max(-100, Math.min(100, window.App.state.filters.tint + res.tint));
    return res;
  }catch(e){ return null; }
};

// ---------- picker ----------
window.App.filtersLogic.pickWhiteBalanceAt = function(normX, normY){
  const canvas = window.App.canvas && window.App.canvas.el;
  if(!canvas) return null;
  try{
    const w = canvas.width, h = canvas.height;
    // read 11×11 patch around normX/Y
    const cx = Math.round(normX * w);
    const cy = Math.round(normY * h);
    const r = 5; // radius
    const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r);
    const x1 = Math.min(w, cx + r + 1), y1 = Math.min(h, cy + r + 1);
    const pw = x1 - x0, ph = y1 - y0;
    if(pw<1||ph<1) return null;
    const off = document.createElement('canvas'); off.width=pw; off.height=ph;
    // draw patch via drawImage with source rect
    const ctx = off.getContext('2d');
    ctx.drawImage(canvas, x0,y0,pw,ph, 0,0,pw,ph);
    const data = ctx.getImageData(0,0,pw,ph).data;
    let sumR=0,sumG=0,sumB=0,cnt=0;
    for(let i=0;i<data.length;i+=4){ sumR+=data[i]; sumG+=data[i+1]; sumB+=data[i+2]; cnt++; }
    if(cnt===0) return null;
    const avgR=sumR/cnt, avgG=sumG/cnt, avgB=sumB/cnt;
    // gains to neutralize patch to gray (avg)
    const avg = (avgR+avgG+avgB)/3;
    const rGain = avg / Math.max(1, avgR);
    const bGain = avg / Math.max(1, avgB);
    const gGain = avg / Math.max(1, avgG);
    // Convert to temperature/tint via log
    const rErr = Math.log(rGain)/Math.log(1.35);
    const bErr = Math.log(bGain)/Math.log(1.35);
    const temp = Math.round(((rErr - bErr)*22));
    const tint = Math.round((Math.log(gGain)/Math.log(1.28))*28);
    window.App.state.filters.temperature = Math.max(-100, Math.min(100, window.App.state.filters.temperature + temp));
    window.App.state.filters.tint = Math.max(-100, Math.min(100, window.App.state.filters.tint + tint));
    return { avgR, avgG, avgB, temp, tint, patchAvg: avg, normX, normY };
  }catch(e){ return null; }
};
