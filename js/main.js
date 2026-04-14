// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    if (window.App) {
        window.App.ui.init();
        window.App.canvas.init();
        window.App.exportService.init();

        // Handle window resize dynamically to maintain canvas ratio
        window.addEventListener('resize', () => {
            if (window.App.state.originalImage) {
                window.App.canvas.fitToContainer();
                window.App.canvas.render();
            }
        });
    }
});
