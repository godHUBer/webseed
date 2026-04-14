// js/filters/vignette.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let factorCacheKey = '';
    let factorCache = null;

    function getFactorMap(width, height, vignette) {
        const cacheKey = [
            width,
            height,
            vignette.anchor.x.toFixed(4),
            vignette.anchor.y.toFixed(4),
            vignette.anchor.radius.toFixed(4)
        ].join('|');

        if (factorCacheKey === cacheKey && factorCache) {
            return factorCache;
        }

        const factors = new Float32Array(width * height);
        const cx = vignette.anchor.x;
        const cy = vignette.anchor.y;
        const radius = Math.max(0.08, vignette.anchor.radius);
        const featherRadius = Math.max(radius * 0.45, 0.08);
        const aspect = width / height;
        const innerRadius = radius * Math.max(1, aspect);
        const outerRadius = innerRadius + featherRadius;

        let writeIndex = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let dx = (x / width) - cx;
                const dy = (y / height) - cy;
                dx *= aspect;

                const dist = Math.sqrt((dx * dx) + (dy * dy));
                let factor = 1;

                if (dist > innerRadius) {
                    if (dist >= outerRadius) factor = 0;
                    else {
                        const t = (dist - innerRadius) / Math.max(0.0001, outerRadius - innerRadius);
                        factor = 1 - (t * t * (3 - (2 * t)));
                    }
                }

                factors[writeIndex++] = factor;
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

        if (innerStr === 0 && outerStr === 0 && !isToolOpen) return;
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
                
                // Outer brightness
                let outFactor = 1.0 - factor;
                if (outerStr !== 0) {
                    let w = Math.abs(outerStr) * outFactor;
                    if (outerStr > 0) {
                        R = R + (255 - R) * w;
                        G = G + (255 - G) * w;
                        B = B + (255 - B) * w;
                    } else {
                        R = R * (1 - w);
                        G = G * (1 - w);
                        B = B * (1 - w);
                    }
                }

                data[idx] = Math.max(0, Math.min(255, R));
                data[idx+1] = Math.max(0, Math.min(255, G));
                data[idx+2] = Math.max(0, Math.min(255, B));
            }
        }
    };
})();
