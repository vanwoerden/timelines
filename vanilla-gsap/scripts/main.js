import { TimelineDataModel } from './data-model.js';
import { Timeline } from './timeline.js';
import { setupZoomPan } from './zoom-pan.js';
import { setupSaveLoad } from './save-load.js';
import { renderOffTimeline } from './drag-drop.js';
import { setupAutoSave, restoreFromLocalStorage } from './auto-save.js';

// Initialize application
const dataModel = new TimelineDataModel();
const timelineTrack = document.getElementById('timelineTrack');
const timeline = new Timeline(timelineTrack, dataModel);

// Restore from localStorage before initial render
const wasRestored = restoreFromLocalStorage(dataModel, timeline);

// Setup controls
setupZoomPan(timeline);
setupSaveLoad(dataModel, timeline);

// Setup auto-save
const statusLabel = document.getElementById('autoSaveStatus');
setupAutoSave(dataModel, timeline, statusLabel);

// Start date input
const startDateInput = document.getElementById('startDate');
const startDate = dataModel.getStartDate();
startDateInput.value = dataModel.data.timeline.startDate; // Use YYYY-MM-DD format directly

startDateInput.addEventListener('change', (e) => {
    const newDate = new Date(e.target.value);
    dataModel.setStartDate(newDate);
    // Recalculate positions of all blocks and annotations when start date changes
    timeline.recalculatePositions();
    timeline.render();
});

// Clear button
const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', () => {
    // Clear all blocks and annotations
    dataModel.data.timeline.items = [];
    dataModel.data.timeline.annotations = [];
    // Clear selection
    timeline.selectBlock(null);
    // Render to update UI
    timeline.render();
});

// Handle data loaded event
window.addEventListener('timeline:data-loaded', () => {
    timeline.render();
    renderOffTimeline(timeline);
});

// Only do initial render if data wasn't restored (restore already triggers render)
if (!wasRestored) {
    timeline.render();
    renderOffTimeline(timeline);
}

