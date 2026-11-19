// js/filters/frames.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    const frameCanvas = document.createElement('canvas');
    const ctx = frameCanvas.getContext('2d');

    // Utility: Draw rough sketchy rects for Grunge edges
    function drawRoughRect(ctx, x, y, width, height, roughness, steps) {
        ctx.beginPath();
        
        const stepX = width / steps;
        const stepY = height / steps;
        
        // Top edge
        ctx.moveTo(x, y);
        for (let i = 1; i <= steps; i++) {
            ctx.lineTo(x + i * stepX, y + (Math.random() - 0.5) * roughness);
        }
        // Right edge
        for (let i = 1; i <= steps; i++) {
            ctx.lineTo(x + width + (Math.random() - 0.5) * roughness, y + i * stepY);
        }
        // Bottom edge
        for (let i = 1; i <= steps; i++) {
            ctx.lineTo(x + width - i * stepX, y + height + (Math.random() - 0.5) * roughness);
        }
        // Left edge
        for (let i = 1; i <= steps; i++) {
            ctx.lineTo(x + (Math.random() - 0.5) * roughness, y + height - i * stepY);
        }
        ctx.closePath();
    }

    window.App.filtersLogic.applyFrames = function (data, width, height) {
        const state = window.App.state.frames;
        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-frames';

        if (!state || (!state.enabled && !isToolOpen)) return;
        if (isToolOpen) state.enabled = true;

        if (frameCanvas.width !== width || frameCanvas.height !== height) {
            frameCanvas.width = width;
            frameCanvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);

        const styleId = parseInt(state.styleId, 10);
        
        // Base width calculation
        // frameWidth ranges from -100 to 100
        // -100 = 0% margin, 0 = 4% margin, 100 = 12% margin
        let marginFrac = 0.04;
        if (state.frameWidth < 0) {
            marginFrac = 0.04 * (1 + state.frameWidth / 100);
        } else if (state.frameWidth > 0) {
            marginFrac = 0.04 + 0.08 * (state.frameWidth / 100);
        }
        
        const marginX = width * marginFrac;
        const marginY = height * marginFrac;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        if (styleId === 1 || styleId === 2) {
            // ----- CLEAN & MINIMAL -----
            // 1 = White mat, 2 = Black mat
            ctx.fillStyle = styleId === 1 ? '#ffffff' : '#0e0e0e';
            ctx.fillRect(0, 0, width, height);
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillRect(marginX, marginY, width - marginX * 2, height - marginY * 2);

        } else if (styleId === 6 || styleId === 7) {
            // ----- GRUNGE / ORGANIC -----
            // 6 = White rough, 7 = Dark translucent rough
            ctx.fillStyle = styleId === 6 ? '#ffffff' : 'rgba(20,20,20,0.85)';
            ctx.fillRect(0, 0, width, height);
            
            ctx.globalCompositeOperation = 'destination-out';
            // Cutout a rough rect using global random seed mapping (pseudo-random per frame prevents flickering on static render, but since it renders repeatedly we need to fix seed or just let it jitter playfully while dragging)
            const roughness = Math.max(width, height) * 0.008;
            drawRoughRect(ctx, marginX, marginY, width - marginX * 2, height - marginY * 2, roughness, 20);
            ctx.fill();

            // Inner dark/light shadow ring
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = styleId === 6 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            drawRoughRect(ctx, marginX, marginY, width - marginX * 2, height - marginY * 2, roughness * 0.5, 20);
            ctx.stroke();

        } else if (styleId === 13 || styleId === 14) {
            // ----- POLAROID / INSTANT -----
            // 13 = Fresh White, 14 = Aged Grayish
            ctx.fillStyle = styleId === 13 ? '#fafafa' : '#e0ddd8';
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = 'destination-out';
            const topMargin = marginY * 0.8;
            const sideMargin = marginX * 0.8;
            const bottomMargin = Math.max(marginY * 3.5, height * 0.15); // Authentic heavy bottom
            
            ctx.fillRect(sideMargin, topMargin, width - sideMargin * 2, height - topMargin - bottomMargin);

            // Add inner rim 
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(sideMargin, topMargin, width - sideMargin * 2, height - topMargin - bottomMargin);

        } else if (styleId === 19 || styleId === 20) {
            // ----- ARTISTIC / MATTED -----
            // 19 = Dark wood tone, 20 = Light canvas bevel
            const isDark = styleId === 19;
            ctx.fillStyle = isDark ? '#2e2521' : '#f5f0eb';
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = 'destination-out';
            // Add a floating shadow by cutting out a smaller inner box and manually drawing the dropshadow
            const bw = width - marginX * 2;
            const bh = height - marginY * 2;
            ctx.fillRect(marginX, marginY, bw, bh);

            ctx.globalCompositeOperation = 'source-over';
            
            ctx.strokeStyle = isDark ? '#1a1412' : '#ffffff';
            ctx.lineWidth = 4;
            ctx.strokeRect(marginX-2, marginY-2, bw+4, bh+4);
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(marginX-6, marginY-6, bw+12, bh+12);
        } else if (styleId === 3) {
            // Phase C: thin double white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0,0,width,height);
            ctx.globalCompositeOperation='destination-out';
            ctx.fillRect(marginX, marginY, width-marginX*2, height-marginY*2);
            ctx.globalCompositeOperation='source-over';
            ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1;
            ctx.strokeRect(marginX+6, marginY+6, width-marginX*2-12, height-marginY*2-12);
        } else if (styleId === 4) {
            // Phase C: thin black
            ctx.fillStyle='#0a0a0f';
            ctx.fillRect(0,0,width,height);
            ctx.globalCompositeOperation='destination-out';
            ctx.fillRect(marginX, marginY, width-marginX*2, height-marginY*2);
        } else if (styleId === 8) {
            // Phase C: warm canvas bevel + subtle vignette
            ctx.fillStyle='#f5f0eb';
            ctx.fillRect(0,0,width,height);
            ctx.globalCompositeOperation='destination-out';
            ctx.fillRect(marginX, marginY, width-marginX*2, height-marginY*2);
            ctx.globalCompositeOperation='source-over';
            ctx.strokeStyle='rgba(141,110,83,0.18)'; ctx.lineWidth=8;
            ctx.strokeRect(marginX-4, marginY-4, width-marginX*2+8, height-marginY*2+8);
        } else if (styleId === 10) {
            // Phase C: dark film border
            ctx.fillStyle='#0e0e0e';
            ctx.fillRect(0,0,width,height);
            ctx.globalCompositeOperation='destination-out';
            ctx.fillRect(marginX, marginY, width-marginX*2, height-marginY*2);
            ctx.globalCompositeOperation='source-over';
            ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
            ctx.strokeRect(marginX-8, marginY-8, width-marginX*2+16, height-marginY*2+16);
            ctx.setLineDash([]);
        }

        ctx.restore();

        const frameRaster = ctx.getImageData(0, 0, width, height).data;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = frameRaster[i+3];
            if (alpha > 0) {
                const weight = alpha / 255;
                data[i]   = data[i] * (1 - weight) + frameRaster[i] * weight;
                data[i+1] = data[i+1] * (1 - weight) + frameRaster[i+1] * weight;
                data[i+2] = data[i+2] * (1 - weight) + frameRaster[i+2] * weight;
            }
        }
    };
})();
