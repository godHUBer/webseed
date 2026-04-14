// js/filters/text.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    const offscreenCanvas = document.createElement('canvas');
    const ctx = offscreenCanvas.getContext('2d');

    function buildFontDeclaration(state, baseSize, series, weightOverride) {
        const family = state.customFontFamily && state.customFontFamily.trim()
            ? `'${state.customFontFamily.trim()}', sans-serif`
            : series;
        return `${weightOverride} ${baseSize}px ${family}`;
    }

    window.App.filtersLogic.applyText = function (data, width, height) {
        const state = window.App.state.text;
        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-text';

        if (!state || (!state.enabled && !isToolOpen)) return;
        if (isToolOpen) state.enabled = true;

        if (!state.content || state.opacity <= 0) return;

        // Resize offscreen canvas to match destination
        if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.save();

        // Common transforms
        const cx = state.x * width;
        const cy = state.y * height;
        
        ctx.translate(cx, cy);
        ctx.rotate(state.rotation);
        // Base scale sizing: make scale=1 represent roughly 10% of image height
        const baseSize = height * 0.1; 
        ctx.scale(state.scale, state.scale);

        // Render based on style
        const style = state.styleId || "N1";
        const color = state.color || "#ffffff";
        const inverted = state.inverted;
        const text = state.content;

        // Reset composer
        ctx.globalCompositeOperation = 'source-over';

        if (style.startsWith("N")) {
            // N Series: Plain text
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = style === "N2"
                ? buildFontDeclaration(state, baseSize, "'Inter'", "600")
                : buildFontDeclaration(state, baseSize, "'Oswald'", "500");
            
            if (inverted) {
                // Inverted plain text: Draw a background box, punch out text
                const metrics = ctx.measureText(text);
                const pad = baseSize * 0.2;
                const rw = metrics.width + pad * 2;
                const rh = baseSize + pad * 2;
                
                ctx.fillRect(-rw/2, -rh/2, rw, rh);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillText(text, 0, baseSize * 0.1); 
            } else {
                ctx.fillText(text, 0, baseSize * 0.1); // slight vertical optical correction
            }

        } else if (style.startsWith("L")) {
            // L Series: Lines
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = buildFontDeclaration(state, baseSize, "'Oswald'", "500");
            
            const metrics = ctx.measureText(text);
            const w = metrics.width;
            
            if (inverted) {
                const pad = baseSize * 0.4;
                ctx.fillRect(-w/2 - pad, -baseSize, w + pad*2, baseSize * 2);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillText(text, 0, baseSize * 0.1);
                ctx.lineWidth = baseSize * 0.05;
                ctx.beginPath();
                ctx.moveTo(-w/2, -baseSize * 0.6);
                ctx.lineTo(w/2, -baseSize * 0.6);
                ctx.moveTo(-w/2, baseSize * 0.7);
                ctx.lineTo(w/2, baseSize * 0.7);
                ctx.stroke();
            } else {
                ctx.fillText(text, 0, baseSize * 0.1);
                ctx.lineWidth = baseSize * 0.05;
                ctx.beginPath();
                ctx.moveTo(-w/2, -baseSize * 0.6);
                ctx.lineTo(w/2, -baseSize * 0.6);
                ctx.moveTo(-w/2, baseSize * 0.7);
                ctx.lineTo(w/2, baseSize * 0.7);
                ctx.stroke();
            }

        } else if (style.startsWith("H")) {
            // H Series: Handwritten
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = buildFontDeclaration(state, baseSize * 1.5, "'Caveat'", "700");
            
            if (inverted) {
                const metrics = ctx.measureText(text);
                const pad = baseSize * 0.3;
                const rw = metrics.width + pad * 2;
                const rh = baseSize * 1.5 + pad * 2;
                ctx.fillRect(-rw/2, -rh/2, rw, rh);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillText(text, 0, baseSize * 0.1);
            } else {
                ctx.fillText(text, 0, baseSize * 0.1);
            }

        } else if (style.startsWith("B")) {
            // B Series: Badges
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = style === "B2"
                ? buildFontDeclaration(state, baseSize * 0.5, "'Inter'", "600")
                : buildFontDeclaration(state, baseSize * 0.6, "'Oswald'", "500");
            
            const metrics = ctx.measureText(text);
            const w = metrics.width;
            const r = Math.max(w / 1.5, baseSize * 1.2);

            if (inverted) {
                // Background is transparent, shape outline is solid, text is solid
                ctx.strokeStyle = color;
                ctx.lineWidth = baseSize * 0.1;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.fillStyle = color;
                ctx.fillText(text, 0, baseSize * 0.05);
            } else {
                // Solid badge, text cut out
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillText(text, 0, baseSize * 0.05);
            }
        }

        ctx.restore();

        // Blend onto main image array
        const textData = ctx.getImageData(0, 0, width, height).data;
        const opacity = state.opacity / 100;
        
        for (let i = 0; i < data.length; i += 4) {
            const alpha = textData[i + 3];
            if (alpha > 0) {
                const weight = (alpha / 255) * opacity;
                data[i]     = data[i] * (1 - weight) + textData[i] * weight;
                data[i + 1] = data[i + 1] * (1 - weight) + textData[i + 1] * weight;
                data[i + 2] = data[i + 2] * (1 - weight) + textData[i + 2] * weight;
            }
        }
    };
})();
