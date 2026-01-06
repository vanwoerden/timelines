// Auto-save functionality for timeline editor
const STORAGE_KEY = 'timeline-autosave';
const SAVE_DELAY = 2000; // 2 seconds

let saveTimeout = null;
let hasPendingChanges = false;
let isSaving = false;
let statusLabelElement = null;
let dataModel = null;
let timeline = null;
let currentStatusText = ''; // Track current text for animation

/**
 * Update the status label based on current state
 */
function updateStatus() {
    if (!statusLabelElement) return;
    
    // Determine new text
    let newText = '';
    if (isSaving) {
        newText = 'Saving changes...';
    } else if (!hasPendingChanges) {
        newText = 'All changes saved to localStorage';
    } else {
        newText = '';
    }
    
    // If text hasn't changed, no need to animate
    if (currentStatusText === newText) {
        return;
    }
    
    const gsap = window.gsap;
    const oldText = currentStatusText;
    currentStatusText = newText;
    
    // If going from text to empty, just fade out
    if (oldText && !newText) {
        gsap.to(statusLabelElement, {
            opacity: 0,
            duration: 0.2,
            ease: 'power2.out',
            onComplete: () => {
                statusLabelElement.textContent = '';
            }
        });
        return;
    }
    
    // If going from empty to text, fade in
    if (!oldText && newText) {
        statusLabelElement.textContent = newText;
        gsap.fromTo(statusLabelElement, 
            { opacity: 0, y: -5 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
        );
        return;
    }
    
    // If text is changing, fade out old, then fade in new
    if (oldText && newText) {
        gsap.to(statusLabelElement, {
            opacity: 0,
            y: -5,
            duration: 0.2,
            ease: 'power2.in',
            onComplete: () => {
                statusLabelElement.textContent = newText;
                gsap.fromTo(statusLabelElement,
                    { opacity: 0, y: 5 },
                    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
                );
            }
        });
    }
}

/**
 * Schedule a save operation with debounce
 */
function scheduleSave() {
    // Clear any existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Mark that there are pending changes
    hasPendingChanges = true;
    updateStatus();
    
    // Set new timeout to save after 5 seconds of inactivity
    saveTimeout = setTimeout(() => {
        saveToLocalStorage();
    }, SAVE_DELAY);
}

/**
 * Save current state to localStorage
 */
function saveToLocalStorage() {
    if (!dataModel) return;
    
    try {
        isSaving = true;
        updateStatus();
        
        const json = dataModel.toJSON();
        localStorage.setItem(STORAGE_KEY, json);
        
        // Mark save as complete
        isSaving = false;
        hasPendingChanges = false;
        updateStatus();
        
        console.log('Timeline state saved to localStorage');
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
        isSaving = false;
        // Keep hasPendingChanges as true since save failed
        updateStatus();
    }
}

/**
 * Restore saved state from localStorage
 */
export function restoreFromLocalStorage(model, tl) {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) {
            return false;
        }
        
        if (model.fromJSON(savedData)) {
            console.log('Timeline state restored from localStorage');
            // Trigger render if timeline is provided
            if (tl) {
                tl.render();
            }
            return true;
        } else {
            console.error('Failed to parse saved timeline data');
            return false;
        }
    } catch (error) {
        console.error('Failed to restore from localStorage:', error);
        return false;
    }
}

/**
 * Setup auto-save functionality
 */
export function setupAutoSave(model, tl, statusElement) {
    dataModel = model;
    timeline = tl;
    statusLabelElement = statusElement;
    
    // Initialize status
    hasPendingChanges = false;
    isSaving = false;
    currentStatusText = ''; // Reset tracked text
    
    // Set initial opacity for animations
    if (statusLabelElement && window.gsap) {
        const gsap = window.gsap;
        gsap.set(statusLabelElement, { opacity: 1, y: 0 });
    }
    
    updateStatus();
    
    // Subscribe to data model changes
    if (dataModel && typeof dataModel.onChange === 'function') {
        dataModel.onChange(() => {
            scheduleSave();
        });
    }
}

