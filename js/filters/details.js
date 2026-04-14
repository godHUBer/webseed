// js/filters/details.js
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

window.App.filtersLogic.applyDetails = function(data, width, height) {
    const filters = window.App.state.filters;
    const structure = (filters.structure + filters.rawStructure) / 100; // -1 to 1
    const sharpen = filters.sharpen / 100; // -1 to 1

    if (structure === 0 && sharpen === 0) return;

    const src = new Uint8ClampedArray(data);

    // 1. Sharpening (High-pass) or Softening (Box Blur)
    if (sharpen !== 0) {
        const mix = Math.abs(sharpen);
        
        let weightCenter, weightEdge;
        if (sharpen > 0) {
            // Sharpen
            const strength = mix * 1.5;
            weightCenter = 1 + 4 * strength;
            weightEdge = -strength;
        } else {
            // Soften 
            const strength = mix;
            weightCenter = (1 - strength) + strength * 0.2;
            weightEdge = strength * 0.2;
        }

        const w4 = width * 4;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;

                let r = src[i] * weightCenter;
                let g = src[i+1] * weightCenter;
                let b = src[i+2] * weightCenter;

                const t = i - w4;
                const bt = i + w4;
                const l = i - 4;
                const rt = i + 4;

                r += src[t] * weightEdge + src[bt] * weightEdge + src[l] * weightEdge + src[rt] * weightEdge;
                g += src[t+1] * weightEdge + src[bt+1] * weightEdge + src[l+1] * weightEdge + src[rt+1] * weightEdge;
                b += src[t+2] * weightEdge + src[bt+2] * weightEdge + src[l+2] * weightEdge + src[rt+2] * weightEdge;

                data[i] = r;
                data[i+1] = g;
                data[i+2] = b;
            }
        }
    }

    // Refresh src if we mutated data so structure layer operates on the sharpened output
    if (sharpen !== 0) {
        src.set(data);
    }

    // 2. Structure (Local Contrast via Large-Radius Unsharp Mask)
    if (structure !== 0) {
        const radius = Math.max(2, Math.floor(width * 0.015)); 
        const lum = new Float32Array(width * height);
        
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            lum[i] = src[idx] * 0.299 + src[idx+1] * 0.587 + src[idx+2] * 0.114;
        }

        const blur1 = new Float32Array(width * height);
        const blur2 = new Float32Array(width * height);

        // Horizontal moving window box blur
        for (let y = 0; y < height; y++) {
            let sum = 0;
            const offset = y * width;
            for (let i = -radius; i <= radius; i++) {
                const x = Math.max(0, Math.min(width - 1, i));
                sum += lum[offset + x];
            }
            blur1[offset] = sum / (radius * 2 + 1);
            
            for (let x = 1; x < width; x++) {
                const rightX = Math.min(width - 1, x + radius);
                const leftX = Math.max(0, x - radius - 1);
                sum += lum[offset + rightX] - lum[offset + leftX];
                blur1[offset + x] = sum / (radius * 2 + 1);
            }
        }

        // Vertical moving window box blur
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = -radius; i <= radius; i++) {
                const y = Math.max(0, Math.min(height - 1, i));
                sum += blur1[y * width + x];
            }
            blur2[x] = sum / (radius * 2 + 1);
            
            for (let y = 1; y < height; y++) {
                const bottomY = Math.min(height - 1, y + radius);
                const topY = Math.max(0, y - radius - 1);
                sum += blur1[bottomY * width + x] - blur1[topY * width + x];
                blur2[y * width + x] = sum / (radius * 2 + 1);
            }
        }

        // Apply structured difference back to RGB
        const intensity = structure * 2.0; 
        for (let i = 0; i < width * height; i++) {
            const l0 = lum[i];
            const lb = blur2[i];
            const diff = l0 - lb;
            
            // Soften the contrast boost on extreme blacks/whites to prevent artifact clipping
            const midtoneMask = 1.0 - Math.pow(Math.abs(l0 - 128) / 128, 2);
            const boost = diff * intensity * midtoneMask;
            
            const idx = i * 4;
            data[idx] = Math.max(0, Math.min(255, src[idx] + boost));
            data[idx+1] = Math.max(0, Math.min(255, src[idx+1] + boost));
            data[idx+2] = Math.max(0, Math.min(255, src[idx+2] + boost));
        }
    }
};
