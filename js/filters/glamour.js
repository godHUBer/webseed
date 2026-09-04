// js/filters/glamour.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    function boxBlurRGB(src, width, height, radius) {
        const dst = new Uint8ClampedArray(src.length);
        const blurX = new Uint8Array(src.length); // Temporary horizontal pass buffer

        // Horizontal Pass
        const divisor = (radius * 2 + 1);
        for (let y = 0; y < height; y++) {
            let sumR = 0, sumG = 0, sumB = 0;
            const offset = y * width * 4;
            
            // Initial window
            for (let i = -radius; i <= radius; i++) {
                const x = Math.max(0, Math.min(width - 1, i)) * 4;
                sumR += src[offset + x];
                sumG += src[offset + x + 1];
                sumB += src[offset + x + 2];
            }
            
            blurX[offset] = sumR / divisor;
            blurX[offset+1] = sumG / divisor;
            blurX[offset+2] = sumB / divisor;
            blurX[offset+3] = 255;
            
            // Sliding window
            for (let x = 1; x < width; x++) {
                const rightX = Math.min(width - 1, x + radius) * 4;
                const leftX = Math.max(0, x - radius - 1) * 4;
                sumR += src[offset + rightX] - src[offset + leftX];
                sumG += src[offset + rightX + 1] - src[offset + leftX + 1];
                sumB += src[offset + rightX + 2] - src[offset + leftX + 2];
                
                const curP = offset + x * 4;
                blurX[curP] = sumR / divisor;
                blurX[curP+1] = sumG / divisor;
                blurX[curP+2] = sumB / divisor;
                blurX[curP+3] = 255;
            }
        }

        // Vertical Pass
        const w4 = width * 4;
        for (let x = 0; x < width; x++) {
            let sumR = 0, sumG = 0, sumB = 0;
            const base = x * 4;
            
            // Initial window
            for (let i = -radius; i <= radius; i++) {
                const y = Math.max(0, Math.min(height - 1, i));
                const p = y * w4 + base;
                sumR += blurX[p];
                sumG += blurX[p+1];
                sumB += blurX[p+2];
            }
            
            dst[base] = sumR / divisor;
            dst[base+1] = sumG / divisor;
            dst[base+2] = sumB / divisor;
            dst[base+3] = 255;
            
            // Sliding window
            for (let y = 1; y < height; y++) {
                const bottomY = Math.min(height - 1, y + radius);
                const topY = Math.max(0, y - radius - 1);
                const rOffset = bottomY * w4 + base;
                const lOffset = topY * w4 + base;
                
                sumR += blurX[rOffset] - blurX[lOffset];
                sumG += blurX[rOffset+1] - blurX[lOffset+1];
                sumB += blurX[rOffset+2] - blurX[lOffset+2];
                
                const curP = y * w4 + base;
                dst[curP] = sumR / divisor;
                dst[curP+1] = sumG / divisor;
                dst[curP+2] = sumB / divisor;
                dst[curP+3] = 255;
            }
        }
        return dst;
    }

    // Cache the blurred image so we don't recompute the heavy blur on every tiny interaction
    // if only Saturation or Warmth are changing.
    let cachedSourceWidth = 0;
    let cachedSourceHeight = 0;
    let cachedGlowValue = null;
    let cachedBlur = null;
    let cachedSourceSnap = null;

    window.App.filtersLogic.applyGlamourGlow = function (data, width, height) {
        const filters = window.App.state.filters;
        if (!filters) return;

        const glow = filters.glamourGlow || 0;
        const sat = filters.glamourSaturation || 0;
        const warmth = filters.glamourWarmth || 0;

        if (glow === 0 && sat === 0 && warmth === 0) return;

        let blurred = null;
        if (glow > 0) {
            const isEditingGlow = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-glamour-glow';
            if (isEditingGlow && cachedBlur && cachedSourceWidth === width && cachedSourceHeight === height && cachedGlowValue === glow) {
                blurred = cachedBlur;
            } else {
                const radius = Math.max(2, Math.floor(width * 0.045));
                // Phase C: threshold bloom — only brights bloom, preserves skin midtones
                const thresh = new Uint8ClampedArray(data.length);
                for(let i=0;i<data.length;i+=4){
                    const lum = (0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2])/255;
                    if(lum > 0.58){
                        const boost = Math.min(1, (lum-0.58)/0.38);
                        // soft threshold + lift
                        thresh[i]= data[i]*0.85 + 255*0.15*boost;
                        thresh[i+1]= data[i+1]*0.85 + 255*0.15*boost;
                        thresh[i+2]= data[i+2]*0.85 + 255*0.15*boost;
                        thresh[i+3]=255;
                    } else {
                        thresh[i]=0; thresh[i+1]=0; thresh[i+2]=0; thresh[i+3]=255;
                    }
                }
                blurred = boxBlurRGB(thresh, width, height, Math.floor(radius));
                cachedBlur = blurred;
                cachedGlowValue = glow;
                cachedSourceWidth = width;
                cachedSourceHeight = height;
            }
        }

        const blendPct = glow / 100;
        const wFactor = warmth / 100;
        const sFactor = sat / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];

            // 1. GLAMOUR GLOW (Soft Bloom via Screen Blend)
            if (blendPct > 0 && blurred) {
                const br = blurred[i], bg = blurred[i + 1], bb = blurred[i + 2];
                // Weight the effect by original pixel luminosity -> creates soft halos mainly on highlights
                const lum = (0.299 * r + 0.587 * g + 0.114 *b) / 255;
                const intensity = blendPct * (0.4 + 0.6 * lum); // Don't let shadows glow too drastically
                
                // Screen Blend
                r = 255 - ((255 - r) * (255 - br * intensity)) / 255;
                g = 255 - ((255 - g) * (255 - bg * intensity)) / 255;
                b = 255 - ((255 - b) * (255 - bb * intensity)) / 255;
            }

            // 2. WARMTH (Color Balance Shift)
            if (wFactor !== 0) {
                if (wFactor > 0) {
                    // Warm: boost red/orange/yellow, cut blue
                    r = r + (255 - r) * wFactor * 0.35;
                    g = g + (255 - g) * wFactor * 0.10;
                    b = b * (1 - wFactor * 0.40);
                } else {
                    // Cool: boost blue/cyan, cut red/yellow
                    const aw = Math.abs(wFactor);
                    r = r * (1 - aw * 0.35);
                    g = g + (255 - g) * aw * 0.15;
                    b = b + (255 - b) * aw * 0.45;
                }
            }

            // 3. SATURATION
            if (sFactor !== 0) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const distFact = 1 + sFactor;
                r = lum + (r - lum) * distFact;
                g = lum + (g - lum) * distFact;
                b = lum + (b - lum) * distFact;
            }

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
    };

})();
