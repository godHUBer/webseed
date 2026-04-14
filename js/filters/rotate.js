(function() {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let straightenState = 0; // The active rotation angle

    window.App.filtersLogic.initRotateUI = function() {
        const rotateBtn = document.getElementById('btn-rotate');
        const bottomBar = document.getElementById('rotate-bottom-bar');
        const closeBtn = document.getElementById('rotate-close');
        const applyBtn = document.getElementById('rotate-apply');
        
        const flipBtn = document.getElementById('rotate-flip');
        const rotate90Btn = document.getElementById('rotate-90-btn');

        const overlay = document.getElementById('rotate-ui-overlay');
        const grid = document.getElementById('rotate-grid');
        const badge = document.getElementById('rotate-angle-badge');
        const container = document.querySelector('.canvas-container');

        if (!rotateBtn || !overlay) return;

        rotateBtn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-rotate') return;
            
            window.App.toolManager.openTool('btn-rotate', {
                show: () => {
                    bottomBar.style.display = 'flex';
                    overlay.style.display = 'block';
                    
                    // Recover straighten state from geometry snapshot
                    straightenState = window.App.state.geometry.straighten || 0;
                    badge.innerText = `Straighten Angle ${straightenState.toFixed(2)}°`;
                },
                hide: () => {
                    bottomBar.style.display = 'none';
                    overlay.style.display = 'none';
                }
            });
        });

        // Tool Commit & Cancel
        if (closeBtn) closeBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn) applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());

        // Basic Flip and 90-Rotations
        if (flipBtn) flipBtn.addEventListener('click', () => {
            window.App.state.geometry.flipX = !window.App.state.geometry.flipX;
            window.App.state.geometry.straightenCache = null;
            window.App.canvas.scheduleRender();
        });
        
        if (rotate90Btn) rotate90Btn.addEventListener('click', () => {
            window.App.state.geometry.rotate = (window.App.state.geometry.rotate + 90) % 360;
            window.App.state.geometry.straightenCache = null;
            window.App.canvas.fitToContainer();
            window.App.canvas.scheduleRender();
        });

        // Swipe Gesture for Straighten Angle
        let isDragging = false;
        let startX = 0;
        let initialAngle = 0;

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-rotate') return;
            if (e.target.closest('#rotate-bottom-bar')) return;

            e.preventDefault();
            isDragging = true;
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            initialAngle = straightenState;
            grid.style.display = 'block'; // Reveal fine grid
            
            // Invalidate OpenCV cache immediately while actively swinging
            window.App.state.geometry.straightenCache = null;
        };

        const onMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const deltaX = currentX - startX;

            // Sensitivity configuration (pixel distance into degree tilt)
            // Approx 100 pixels = 10 degrees
            let newAngle = initialAngle + (deltaX * 0.1);
            
            // Clamp to -45 / +45
            if (newAngle > 45) newAngle = 45;
            if (newAngle < -45) newAngle = -45;

            straightenState = newAngle;
            window.App.state.geometry.straighten = straightenState;
            
            badge.innerText = `Straighten Angle ${straightenState.toFixed(2)}°`;
            window.App.canvas.scheduleRender();
        };

        const onUp = () => {
            if (!isDragging) return;
            isDragging = false;
            grid.style.display = 'none';
            
            // Kick off asynchronous corner synthesis when finger leaves screen!
            if (window.App.canvas.generateCornerFills) {
                window.App.canvas.generateCornerFills(straightenState);
            }
        };

        container.addEventListener('mousedown', onDown);
        container.addEventListener('touchstart', onDown, {passive: false});

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});

        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.App.filtersLogic.initRotateUI();
    });
})();
