// js/filters/lensblur.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    const sampleCache = new Map();
    let blurCacheKey = '';
    let blurCacheValue = null;

    function extractChannels(data, pixelCount) {
        const r = new Uint8ClampedArray(pixelCount);
        const g = new Uint8ClampedArray(pixelCount);
        const b = new Uint8ClampedArray(pixelCount);

        for (let index = 0; index < pixelCount; index++) {
            const dataIndex = index * 4;
            r[index] = data[dataIndex];
            g[index] = data[dataIndex + 1];
            b[index] = data[dataIndex + 2];
        }

        return { r, g, b };
    }

    function isInsideBokehShape(shapeId, nx, ny, rotRad) {
        if(rotRad){
            const c=Math.cos(rotRad), sn=Math.sin(rotRad);
            const rx = nx*c - ny*sn, ry = nx*sn + ny*c;
            nx=rx; ny=ry;
        }
        const r2 = (nx * nx) + (ny * ny);

        if (shapeId === 1) return r2 <= 1;
        if (shapeId === 2) return r2 <= 1 && r2 >= 0.32;
        if (shapeId === 3) {
            const angle = Math.atan2(ny, nx);
            const radialBound = 0.72 + (0.18 * Math.cos(5 * angle));
            return Math.sqrt(r2) <= radialBound;
        }
        if (shapeId === 4) {
            const angle = Math.atan2(ny, nx);
            const radialBound = 0.45 + (0.38 * Math.abs(Math.cos(4 * angle)));
            return Math.sqrt(r2) <= radialBound;
        }
        if (shapeId === 5) {
            const hx = nx;
            const hy = -ny;
            return Math.pow((hx * hx) + (hy * hy) - 1, 3) - ((hx * hx) * hy * hy * hy) <= 0;
        }
        if (shapeId === 6) return (Math.abs(nx) * 0.86) + (Math.abs(ny) * 0.5) <= 0.95;
        if (shapeId === 7) return Math.max(Math.abs(nx), Math.abs(ny)) <= 0.84;
        if (shapeId === 8) return Math.abs(nx) + Math.abs(ny) <= 1;
        if (shapeId === 9) {
            const angle = Math.atan2(ny, nx);
            const radialBound = 0.55 + (0.22 * Math.sin(6 * angle));
            return Math.sqrt(r2) <= Math.max(0.18, radialBound);
        }
        if (shapeId === 10) {
            const angle = Math.atan2(ny, nx);
            const radialBound = 0.6 + (0.22 * Math.cos(3 * angle));
            return Math.sqrt(r2) <= radialBound;
        }
        return (Math.abs(nx) + (Math.abs(ny) * 0.75)) <= 1;
    }

    function buildBokehSamples(shapeId, radius, rotation) {
        const roundedRadius = Math.max(1, Math.round(radius));
        const rotKey = Math.round((rotation||0)/5)*5;
        const cacheKey = `${shapeId}:${roundedRadius}:${rotKey}`;
        if (sampleCache.has(cacheKey)) return sampleCache.get(cacheKey);
        const rotRad = (rotation||0)*Math.PI/180;

        const candidates = [];

        for (let dy = -roundedRadius; dy <= roundedRadius; dy++) {
            for (let dx = -roundedRadius; dx <= roundedRadius; dx++) {
                const nx = dx / roundedRadius;
                const ny = dy / roundedRadius;
                if (!isInsideBokehShape(shapeId, nx, ny, rotRad)) continue;

                const distance = Math.sqrt((nx * nx) + (ny * ny));
                const edgeWeight = 0.7 + ((1 - Math.min(1, distance)) * 0.3);
                candidates.push({ x: dx, y: dy, w: edgeWeight });
            }
        }

        const targetCount = Math.max(14, Math.min(34, Math.round(12 + (roundedRadius * 1.2))));
        if (candidates.length <= targetCount) {
            sampleCache.set(cacheKey, candidates);
            return candidates;
        }

        const samples = [];
        const step = candidates.length / targetCount;
        for (let sampleIndex = 0; sampleIndex < targetCount; sampleIndex++) {
            samples.push(candidates[Math.floor(sampleIndex * step)]);
        }
        samples.push({ x: 0, y: 0, w: 1 });
        sampleCache.set(cacheKey, samples);
        return samples;
    }

    function buildSourceSignature(data, width, height) {
        const samplePoints = 48;
        const pixelCount = width * height;
        const step = Math.max(1, Math.floor(pixelCount / samplePoints));
        let hash = (width * 73856093) ^ (height * 19349663) ^ data.length;

        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += step) {
            const dataIndex = pixelIndex * 4;
            hash = ((hash << 5) - hash + data[dataIndex]) >>> 0;
            hash = ((hash << 5) - hash + data[dataIndex + 1]) >>> 0;
            hash = ((hash << 5) - hash + data[dataIndex + 2]) >>> 0;
        }

        return hash.toString(16);
    }

    function bokehBlur(data, width, height, radius, shapeId, rotation) {
        const cacheKey = `${width}|${height}|${Math.round(radius)}|${shapeId}|${Math.round((rotation||0)/5)}|${buildSourceSignature(data, width, height)}`;
        if (blurCacheKey === cacheKey && blurCacheValue) {
            return blurCacheValue;
        }

        const pixelCount = width * height;
        const source = extractChannels(data, pixelCount);
        const result = {
            r: new Uint8ClampedArray(pixelCount),
            g: new Uint8ClampedArray(pixelCount),
            b: new Uint8ClampedArray(pixelCount)
        };
        const samples = buildBokehSamples(shapeId, radius, rotation);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                let sumW = 0;

                for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
                    const sample = samples[sampleIndex];
                    const sampleX = Math.max(0, Math.min(width - 1, x + sample.x));
                    const sampleY = Math.max(0, Math.min(height - 1, y + sample.y));
                    const pixelIndex = (sampleY * width) + sampleX;

                    sumR += source.r[pixelIndex] * sample.w;
                    sumG += source.g[pixelIndex] * sample.w;
                    sumB += source.b[pixelIndex] * sample.w;
                    sumW += sample.w;
                }

                const outIndex = (y * width) + x;
                result.r[outIndex] = sumR / sumW;
                result.g[outIndex] = sumG / sumW;
                result.b[outIndex] = sumB / sumW;
            }
        }

        blurCacheKey = cacheKey;
        blurCacheValue = result;
        return result;
    }

    function getFeatherRadius(lensBlur) {
        return 0.05 + ((lensBlur.transition / 100) * 0.28);
    }

    function getLensBlurProtection(lensBlur, dx, dy) {
        const anchor = lensBlur.anchor || {};
        const rot = (anchor.rotation||0) * Math.PI/180;
        if(rot){
            const c=Math.cos(-rot), s=Math.sin(-rot);
            const rx = dx*c - dy*s, ry = dx*s + dy*c;
            dx=rx; dy=ry;
        }
        const focusX = Math.max(0.08, anchor.focusScaleX || anchor.focusScale || 0.24);
        const focusY = Math.max(0.08, anchor.focusScaleY || anchor.focusScale || 0.24);
        const feather = getFeatherRadius(lensBlur);
        const outerX = focusX + feather;
        const outerY = focusY + feather;
        const distance = Math.sqrt((dx * dx) + (dy * dy));

        if (distance < 1e-6) return 1;

        const unitX = dx / distance;
        const unitY = dy / distance;
        const focusRadius = 1 / Math.sqrt(((unitX * unitX) / (focusX * focusX)) + ((unitY * unitY) / (focusY * focusY)));
        const outerRadius = 1 / Math.sqrt(((unitX * unitX) / (outerX * outerX)) + ((unitY * unitY) / (outerY * outerY)));

        if (distance <= focusRadius) return 1;
        if (distance >= outerRadius) return 0;

        const t = (distance - focusRadius) / Math.max(0.0001, outerRadius - focusRadius);
        return 1 - (t * t * (3 - (2 * t)));
    }

    window.App.filtersLogic.applyLensBlur = function (data, width, height) {
        if (window.App.normalizeLensBlurState) window.App.normalizeLensBlurState();
        const lensBlur = window.App.state && window.App.state.lensBlur;
        if (!lensBlur) return;

        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-lens-blur';
        if (!lensBlur.enabled && !isToolOpen) return;
        if (isToolOpen) lensBlur.enabled = true;

        const strength = lensBlur.blurStrength;
        if (strength <= 0) return;

        const radius = 1 + ((strength / 100) * 26);
        const rotation = lensBlur.bokehRotation || 0;
        const blurred = bokehBlur(data, width, height, radius, lensBlur.bokehShape, rotation);
        const centerX = lensBlur.anchor.x;
        const centerY = lensBlur.anchor.y;
        const vigStrength = (lensBlur.vignetteStrength||0)/100; // -1..1
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = (x / width) - centerX;
                const dy = (y / height) - centerY;
                const protection = getLensBlurProtection(lensBlur, dx, dy);
                const dataIndex = (y * width + x) * 4;
                const blurIndex = (y * width) + x;
                let r = (data[dataIndex] * protection) + (blurred.r[blurIndex] * (1 - protection));
                let g = (data[dataIndex + 1] * protection) + (blurred.g[blurIndex] * (1 - protection));
                let b = (data[dataIndex + 2] * protection) + (blurred.b[blurIndex] * (1 - protection));
                if(vigStrength!==0){
                    const vign = 1 - protection; // 0 in focus, 1 outside
                    const w = Math.abs(vigStrength) * vign * vign; // quadratic falloff
                    if(vigStrength<0){ r*=1-w*0.55; g*=1-w*0.55; b*=1-w*0.55; }
                    else { r=r+(255-r)*w*0.45; g=g+(255-g)*w*0.45; b=b+(255-b)*w*0.45; }
                }
                data[dataIndex]=r; data[dataIndex+1]=g; data[dataIndex+2]=b;
            }
        }
    };
})();
