// js/filters/details.js — Polished Phase A (scraped/adapted from MIT: glfx unsharp, photojshop highPass, miniPaint clarity)
// Two-pass: (1) edge-aware sharpen/soften with halo suppression, (2) clarity/structure via large-radius DoG + midtone mask + edge preservation
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

window.App.filtersLogic.applyDetails = function(data, width, height) {
    const f = window.App.state.filters;
    // rawStructure contributes for RAW mode
    const structure = ( (f.structure||0) + (f.rawStructure||0) ) / 100; // -1..1
    const sharpen = (f.sharpen||0) / 100; // -1..1
    if (structure === 0 && sharpen === 0) return;

    const src = new Uint8ClampedArray(data);
    const w = width, h = height;

    // ---------- 1) Sharpen / Soften with halo suppression ----------
    if (sharpen !== 0) {
        const mix = Math.abs(sharpen);
        // Build luminance for Sobel edge map (to suppress sharpen on strong edges → halos)
        const lum = new Uint8Array(w*h);
        for(let i=0;i<w*h;i++){
            const idx=i*4;
            lum[i] = (0.2126*src[idx] + 0.7152*src[idx+1] + 0.0722*src[idx+2])|0;
        }
        // Sobel magnitude approx (cheap 3x3)
        // we compute on the fly per pixel in loop below via neighbors

        let weightCenter, weightEdge;
        if (sharpen > 0) {
            const strength = mix * 1.42; // slightly softer than 1.5 to reduce halos
            weightCenter = 1 + 4 * strength;
            weightEdge = -strength;
        } else {
            const strength = mix;
            weightCenter = (1 - strength) + strength * 0.18;
            weightEdge = strength * 0.22;
        }
        const w4 = w*4;
        // temp buffer for halo-suppressed output
        const out = new Uint8ClampedArray(data);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = (y*w + x)*4;
                // Sobel around luma
                const tl = lum[(y-1)*w + (x-1)], tc = lum[(y-1)*w + x], tr = lum[(y-1)*w + (x+1)];
                const ml = lum[y*w + (x-1)],                  mr = lum[y*w + (x+1)];
                const bl = lum[(y+1)*w + (x-1)], bc = lum[(y+1)*w + x], br = lum[(y+1)*w + (x+1)];
                const gx = -tl -2*ml -bl + tr +2*mr + br;
                const gy = -tl -2*tc -tr + bl +2*bc + br;
                const edge = Math.sqrt(gx*gx + gy*gy); // 0.. ~1440
                const edgeNorm = Math.min(1, edge / 90); // 0..1 strong edge
                const haloSuppress = 1 - edgeNorm*0.58; // reduce sharpen up to 58% on edges

                const wc = weightCenter;
                const we = weightEdge * haloSuppress;

                let r = src[i] * wc;
                let g = src[i+1]*wc;
                let b = src[i+2]*wc;
                const t = i - w4, bt = i + w4, l = i - 4, rt = i + 4;
                // cross only (4-neighbor) as original — fast, preserves diagonals
                r += (src[t]+src[bt]+src[l]+src[rt]) * we;
                g += (src[t+1]+src[bt+1]+src[l+1]+src[rt+1])*we;
                b += (src[t+2]+src[bt+2]+src[l+2]+src[rt+2])*we;

                out[i]= r<0?0:r>255?255:r;
                out[i+1]=g<0?0:g>255?255:g;
                out[i+2]=b<0?0:b>255?255:b;
                // alpha unchanged
            }
        }
        // copy inner region; border remains src (avoids edge artifacts)
        for(let y=1;y<h-1;y++){
            const row = y*w*4;
            for(let x=1;x<w-1;x++){
                const i=row + x*4;
                data[i]=out[i]; data[i+1]=out[i+1]; data[i+2]=out[i+2];
            }
        }
    }

    if (sharpen !== 0) src.set(data); // structure operates on sharpened

    // ---------- 2) Structure / Clarity (local contrast) ----------
    if (structure !== 0) {
        const radius = Math.max(3, Math.floor(w * 0.014)); // 1.4% width → 14px at 1000px
        const lum = new Float32Array(w*h);
        for(let i=0;i<w*h;i++){
            const idx=i*4;
            lum[i]= src[idx]*0.2126 + src[idx+1]*0.7152 + src[idx+2]*0.0722;
        }
        // separable box blur (moving window, O(wh))
        const blurH = new Float32Array(w*h);
        const blur = new Float32Array(w*h);
        // horizontal
        for(let y=0;y<h;y++){
            let sum=0;
            const off=y*w;
            for(let i=-radius;i<=radius;i++){
                const x = i<0?0:i>=w?w-1:i;
                sum+=lum[off+x];
            }
            blurH[off]=sum/(radius*2+1);
            for(let x=1;x<w;x++){
                const rx = x+radius < w ? x+radius : w-1;
                const lx = x-radius-1 >=0 ? x-radius-1 : 0;
                sum+=lum[off+rx]-lum[off+lx];
                blurH[off+x]=sum/(radius*2+1);
            }
        }
        // vertical
        for(let x=0;x<w;x++){
            let sum=0;
            for(let i=-radius;i<=radius;i++){
                const y=i<0?0:i>=h?h-1:i;
                sum+=blurH[y*w+x];
            }
            blur[x]=sum/(radius*2+1);
            for(let y=1;y<h;y++){
                const by = y+radius < h ? y+radius : h-1;
                const ty = y-radius-1 >=0 ? y-radius-1 : 0;
                sum+=blurH[by*w+x]-blurH[ty*w+x];
                blur[y*w+x]=sum/(radius*2+1);
            }
        }
        const intensity = structure * 1.85; // slightly softer than 2.0
        for(let i=0;i<w*h;i++){
            const l0 = lum[i];
            const lb = blur[i];
            const diff = l0 - lb; // DoG
            // edge-aware: don't boost where luma variance is huge (strong edge) — estimate via |diff|
            const edgeMask = 1 - Math.min(1, Math.abs(diff)/38)*0.45; // reduce 45% on strong edges
            const midMask = 1 - Math.pow(Math.abs(l0 - 128)/128, 1.6); // 1 mid, 0 ends, smoother
            const boost = diff * intensity * midMask * edgeMask;
            const idx=i*4;
            // preserve chroma: boost is achromatic
            data[idx]   = Math.max(0, Math.min(255, src[idx]   + boost));
            data[idx+1] = Math.max(0, Math.min(255, src[idx+1] + boost));
            data[idx+2] = Math.max(0, Math.min(255, src[idx+2] + boost));
        }
    }
};
