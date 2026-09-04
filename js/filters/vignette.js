// js/filters/vignette.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let factorCacheKey = '';
    let factorCache = null;

    function getFactorMap(width, height, vignette) {
        const rxRaw = (vignette.anchor.radiusX!=null ? vignette.anchor.radiusX : vignette.anchor.radius);
        const ryRaw = (vignette.anchor.radiusY!=null ? vignette.anchor.radiusY : vignette.anchor.radius);
        const cacheKey = [
            width, height,
            vignette.anchor.x.toFixed(4),
            vignette.anchor.y.toFixed(4),
            rxRaw.toFixed(4), ryRaw.toFixed(4),
            (vignette.feather!=null?vignette.feather:45).toFixed(1)
        ].join('|');
        if (factorCacheKey === cacheKey && factorCache) {
            return factorCache;
        }
        const factors = new Float32Array(width * height);
        const cx = vignette.anchor.x;
        const cy = vignette.anchor.y;
        const rx = Math.max(0.08, rxRaw);
        const ry = Math.max(0.08, ryRaw);
        const featherPct = (vignette.feather!=null? vignette.feather:45)/100;
        const featherScale = 0.12 + featherPct*0.62;
        const maxDim = Math.max(width, height);
        const innerX = rx * maxDim;
        const innerY = ry * maxDim;
        let writeIndex = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let dx = (x / width) - cx;
                let dy = (y / height) - cy;
                const ex = (dx*width)/Math.max(1, innerX);
                const ey = (dy*height)/Math.max(1, innerY);
                const distEll = Math.sqrt(ex*ex + ey*ey);
                let factor = 1;
                if (distEll > 1) {
                    const t = Math.min(1, (distEll-1)/Math.max(0.0001, featherScale));
                    factor = 1 - (t * t * (3 - (2 * t)));
                }
                factors[writeIndex++] = Math.max(0, Math.min(1, factor));
            }
        }
        factorCacheKey = cacheKey;
        factorCache = factors;
        return factors;
    }

    window.App.filtersLogic.applyVignette = function (data, width, height) {
        if (window.App.normalizeVignetteState) window.App.normalizeVignetteState();
        const vig = window.App.state && window.App.state.vignette;
        if (!vig) return;
        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-vignette';
        if (!vig.enabled && !isToolOpen) return;
        if (isToolOpen) vig.enabled = true;
        const innerStr = vig.innerBrightness / 100;
        const outerStr = vig.outerBrightness / 100;
        const tint = vig.tint;
        let tintR=0,tintG=0,tintB=0, hasTint=false;
        if(tint && typeof tint==='string'){
            const hex=tint.replace('#','').trim();
            if(hex.length===6){ tintR=parseInt(hex.slice(0,2),16); tintG=parseInt(hex.slice(2,4),16); tintB=parseInt(hex.slice(4,6),16); hasTint=true; }
            else if(hex.length===3){ tintR=parseInt(hex[0]+hex[0],16); tintG=parseInt(hex[1]+hex[1],16); tintB=parseInt(hex[2]+hex[2],16); hasTint=true; }
        }
        if (innerStr === 0 && outerStr === 0 && !hasTint && !isToolOpen) return;
        const factors = getFactorMap(width, height, vig);
        let factorIndex = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const factor = factors[factorIndex++];
                let idx = (y * width + x) * 4;
                let R = data[idx];
                let G = data[idx+1];
                let B = data[idx+2];
                
                // Inner brightness (additive if pos, multiplicative if neg)
                if (innerStr !== 0) {
                    let w = Math.abs(innerStr) * factor;
                    if (innerStr > 0) {
                        R = R + (255 - R) * w;
                        G = G + (255 - G) * w;
                        B = B + (255 - B) * w;
                    } else {
                        R = R * (1 - w);
                        G = G * (1 - w);
                        B = B * (1 - w);
                    }
                }
                
                // Outer brightness + optional tint (Phase C warm vignette)
                let outFactor = 1.0 - factor;
                if (outerStr !== 0 || (hasTint && outFactor>0.02)) {
                    let w = Math.abs(outerStr) * outFactor;
                    if (outerStr > 0) {
                        R = R + (255 - R) * w;
                        G = G + (255 - G) * w;
                        B = B + (255 - B) * w;
                    } else if (outerStr < 0) {
                        if(hasTint){
                            // blend toward tint instead of black for warm vignette
                            const tw = w*0.55;
                            R = R*(1 - w) + tintR*tw + R*(w-tw);
                            G = G*(1 - w) + tintG*tw + G*(w-tw);
                            B = B*(1 - w) + tintB*tw + B*(w-tw);
                            // simplify: darken then add tint
                            R = R*(1-w*0.5) + tintR*w*0.35;
                            G = G*(1-w*0.5) + tintG*w*0.35;
                            B = B*(1-w*0.5) + tintB*w*0.35;
                            // actually just darken + tint blend:
                            // recalc correctly:
                            // We'll do darken as before then tint lerp
                        } else {
                            R = R * (1 - w);
                            G = G * (1 - w);
                            B = B * (1 - w);
                        }
                        if(hasTint && w>0.05){
                            const tintW = Math.min(0.42, w*0.6);
                            R = R*(1-tintW) + tintR*tintW;
                            G = G*(1-tintW) + tintG*tintW;
                            B = B*(1-tintW) + tintB*tintW;
                        }
                    }
                }

                data[idx] = Math.max(0, Math.min(255, R));
                data[idx+1] = Math.max(0, Math.min(255, G));
                data[idx+2] = Math.max(0, Math.min(255, B));
            }
        }
    };
})();
