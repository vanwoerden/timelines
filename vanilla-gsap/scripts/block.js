import { setupDragDrop } from './drag-drop.js';
import { setupResize } from './resize.js';
// GSAP is loaded globally via script tag
const gsap = window.gsap;

export class Block {
    constructor(data, timeline) {
        this.data = data;
        this.timeline = timeline;
        this.element = this.createElement();
        this.isEditing = false;
        
        setupDragDrop(this, timeline);
        setupResize(this, timeline);
    }
    
    createElement() {
        const block = document.createElement('div');
        block.className = 'timeline-block';
        block.dataset.id = this.data.id;
        block.dataset.type = 'block';
        
        // Get relative day from absolute date
        const startDate = this.data.startDate || this.timeline.dataModel.getDateFromRelativeDay(this.data.startDay || 0);
        const relativeDay = this.timeline.getRelativeDayFromDate(startDate);
        
        // Calculate width by summing actual day widths from start day
        const width = this.timeline.dayToPixelForDuration(relativeDay, this.data.duration);
        const row = this.data.row || 0;
        const padding = 32; // 2rem padding
        const rowSpacing = this.timeline.config.blockHeight + this.timeline.config.annotationSpace;
        const top = padding + (row * rowSpacing);
        
        block.style.width = `${width}px`;
        block.style.height = `${this.timeline.config.blockHeight}px`;
        block.style.left = `${this.timeline.dayToPixel(relativeDay)}px`;
        block.style.top = `${top}px`;
        block.style.position = 'absolute';
        
        const label = document.createElement('div');
        label.className = 'label';
        // Use non-breaking space if label is empty to maintain clickable area
        label.textContent = this.data.label || '\u00A0';
        block.appendChild(label);
        
        // Add tooltip functionality
        this.setupTooltip(block, label);
        
        // Create badge element
        const badge = document.createElement('div');
        badge.className = 'timeline-block-badge';
        badge.dataset.badgeValue = this.data.badge || 'XD';
        badge.textContent = this.data.badge || 'XD';
        this.updateBadgeStyle(badge, this.data.badge || 'XD');
        block.appendChild(badge);
        
        // Update block badge style based on badge value
        this.updateBlockBadgeStyle(block, this.data.badge || 'XD');
        
        // Add pointerdown handler to cycle through badge values (like resize handle)
        // Use pointerdown instead of click to avoid conflicts with block click handlers
        const self = this;
        const badgePointerDownHandler = function(e) {
            console.log('Badge pointerdown!', e.target, e); // Debug log
            // Stop event propagation to prevent block selection
            e.stopPropagation();
            e.preventDefault();
            
            // Cycle the badge
            self.cycleBadge();
            
            return false; // Additional prevention
        };
        
        // Attach handler immediately - badge is already in DOM (just appended)
        // Use pointerdown like resize handle does
        badge.addEventListener('pointerdown', badgePointerDownHandler);
        
        // Store badge reference and handler for later use
        this.badgeElement = badge;
        this.badgeClickHandler = badgePointerDownHandler;
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        block.appendChild(resizeHandle);
        
        // Click on label to select block and enter edit mode
        label.addEventListener('click', (e) => {
            if (!this.isEditing) {
                // Select the block first
                const blockId = this.data.id;
                this.timeline.selectBlock(blockId);
                // Then enter edit mode with all text selected
                this.startEditing();
                e.stopPropagation();
                e.preventDefault();
            }
        });
        
        // Click on block (but not label) to select
        // Use capture phase to check for badge clicks before other handlers
        block.addEventListener('click', (e) => {
            // First check: Don't handle if clicking on badge
            if (e.target === badge || 
                e.target.classList.contains('timeline-block-badge') ||
                badge.contains(e.target) ||
                e.target.closest('.timeline-block-badge')) {
                // Badge click - don't select block
                return;
            }
        }, true); // Capture phase - check early
        
        // Click on block (but not label) to select - bubble phase
        block.addEventListener('click', (e) => {
            // Don't handle if clicking on label (handled above) or input
            if (e.target === label || e.target.classList.contains('label-input')) {
                return;
            }
            // Don't handle if clicking on resize handle
            if (e.target === resizeHandle) {
                return;
            }
            // Don't handle if clicking on badge (handled above)
            // Check both target and if click originated from badge
            if (e.target === badge || 
                e.target.classList.contains('timeline-block-badge') ||
                badge.contains(e.target) ||
                e.target.closest('.timeline-block-badge')) {
                return;
            }
            // Select the block
            if (!this.isEditing) {
                const blockId = this.data.id;
                this.timeline.selectBlock(blockId);
                e.stopPropagation();
                e.preventDefault();
            }
        });
        
        return block;
    }
    
    startEditing() {
        if (this.isEditing) return;
        this.isEditing = true;
        this.isFinishingEdit = false; // Reset flag when starting to edit
        
        const label = this.element.querySelector('.label');
        const input = document.createElement('textarea');
        input.className = 'label-input';
        input.value = this.data.label;
        input.rows = 1;
        
        const finishEditing = () => {
            // Guard against duplicate calls
            if (this.isFinishingEdit) return;
            this.isFinishingEdit = true;
            
            // Check if input still exists and is in the DOM
            if (!input || !input.parentNode) {
                this.isFinishingEdit = false;
                this.isEditing = false;
                return;
            }
            
            const newLabel = input.value.trim();
            this.timeline.dataModel.updateItem(this.data.id, { label: newLabel });
            
            // Create a new label element to replace the input
            const newLabelElement = document.createElement('div');
            newLabelElement.className = 'label';
            // Use non-breaking space if label is empty to maintain clickable area
            newLabelElement.textContent = newLabel || '\u00A0';
            
            // Replace the input with the new label element
            // Check again that input is still in DOM before replacing
            if (input.parentNode) {
                input.replaceWith(newLabelElement);
            } else {
                // Input was already removed, just append the new label
                const labelContainer = this.element.querySelector('.label')?.parentNode || this.element;
                labelContainer.appendChild(newLabelElement);
            }
            
            // Re-attach the click handler and tooltip to the new label
            newLabelElement.addEventListener('click', (e) => {
                if (!this.isEditing) {
                    const blockId = this.data.id;
                    this.timeline.selectBlock(blockId);
                    this.startEditing();
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
            
            // Re-attach tooltip
            this.setupTooltip(this.element, newLabelElement);
            
            this.isEditing = false;
            this.isFinishingEdit = false; // Reset flag after completion
        };
        
        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishEditing();
            } else if (e.key === 'Escape') {
                // Guard against duplicate calls
                if (this.isFinishingEdit) return;
                this.isFinishingEdit = true;
                
                // Check if input still exists and is in the DOM
                if (!input || !input.parentNode) {
                    this.isFinishingEdit = false;
                    this.isEditing = false;
                    return;
                }
                
                // Create a new label element with the original value
                const newLabelElement = document.createElement('div');
                newLabelElement.className = 'label';
                // Use non-breaking space if label is empty to maintain clickable area
                newLabelElement.textContent = this.data.label || '\u00A0';
                
                // Replace the input with the new label element
                // Check again that input is still in DOM before replacing
                if (input.parentNode) {
                    input.replaceWith(newLabelElement);
                } else {
                    // Input was already removed, just append the new label
                    const labelContainer = this.element.querySelector('.label')?.parentNode || this.element;
                    labelContainer.appendChild(newLabelElement);
                }
                
                // Re-attach the click handler and tooltip to the new label
                newLabelElement.addEventListener('click', (e) => {
                    if (!this.isEditing) {
                        const blockId = this.data.id;
                        this.timeline.selectBlock(blockId);
                        this.startEditing();
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
                
                // Re-attach tooltip
                this.setupTooltip(this.element, newLabelElement);
                
                this.isEditing = false;
                this.isFinishingEdit = false; // Reset flag after completion
            }
        });
        
        label.replaceWith(input);
        input.focus();
        input.select();
    }
    
    setupTooltip(block, label) {
        let tooltip = null;
        let tooltipTimeout = null;
        
        const showTooltip = (e) => {
            // Check if label is truncated
            if (label.scrollWidth <= label.offsetWidth) {
                return; // Label is not truncated, no need for tooltip
            }
            
            // Clear any existing timeout
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
            }
            
            // Set timeout for 1 second delay
            tooltipTimeout = setTimeout(() => {
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.className = 'tooltip';
                    tooltip.textContent = this.data.label;
                    document.body.appendChild(tooltip);
                }
                
                // Position tooltip above the block
                const rect = block.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 10}px`;
                tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
                tooltip.classList.add('visible');
            }, 1000);
        };
        
        const hideTooltip = () => {
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            if (tooltip) {
                tooltip.classList.remove('visible');
                // Remove tooltip after transition
                setTimeout(() => {
                    if (tooltip && !tooltip.classList.contains('visible')) {
                        tooltip.remove();
                        tooltip = null;
                    }
                }, 200);
            }
        };
        
        label.addEventListener('mouseenter', showTooltip);
        label.addEventListener('mouseleave', hideTooltip);
        block.addEventListener('mouseleave', hideTooltip);
    }
    
    update(data) {
        this.data = data;
        
        // Get relative day from absolute date
        const startDate = this.data.startDate || this.timeline.dataModel.getDateFromRelativeDay(this.data.startDay || 0);
        const relativeDay = this.timeline.getRelativeDayFromDate(startDate);
        
        // Calculate width by summing actual day widths from start day
        // This correctly handles variable day widths (weekdays vs weekends)
        const width = this.timeline.dayToPixelForDuration(relativeDay, this.data.duration);
        const left = this.timeline.dayToPixel(relativeDay);
        
        const row = this.data.row || 0;
        const padding = 32; // 2rem padding
        const rowSpacing = this.timeline.config.blockHeight + this.timeline.config.annotationSpace;
        const top = padding + (row * rowSpacing);
        
        gsap.to(this.element, {
            width: `${width}px`,
            left: `${left}px`,
            top: `${top}px`,
            duration: 0.3,
            ease: 'power2.out'
        });
        
        const label = this.element.querySelector('.label');
        if (label && !this.isEditing) {
            // Use non-breaking space if label is empty to maintain clickable area
            label.textContent = this.data.label || '\u00A0';
        }
        
        // Update badge if it exists
        const badge = this.element.querySelector('.timeline-block-badge');
        if (badge) {
            const badgeValue = this.data.badge || 'XD';
            badge.dataset.badgeValue = badgeValue;
            badge.textContent = badgeValue;
            this.updateBadgeStyle(badge, badgeValue);
            
            // Update block badge style based on badge value
            this.updateBlockBadgeStyle(this.element, badgeValue);
            
            // Re-attach pointerdown handler if badge was recreated or handler is missing
            // Check if handler is already attached
            if (!this.badgeClickHandler || !badge.hasAttribute('data-handler-attached')) {
                badge.setAttribute('data-handler-attached', 'true');
                
                // Store reference to this for use in handler
                const self = this;
                const badgePointerDownHandler = function(e) {
                    console.log('Badge pointerdown (update)!', e.target); // Debug log
                    // Stop event propagation to prevent block selection
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Cycle the badge
                    self.cycleBadge();
                    
                    return false;
                };
                
                // Attach handler using pointerdown (like resize handle)
                badge.addEventListener('pointerdown', badgePointerDownHandler);
                
                // Store references
                this.badgeElement = badge;
                this.badgeClickHandler = badgePointerDownHandler;
            }
        }
    }
    
    cycleBadge() {
        const currentBadge = this.data.badge || 'XD';
        let nextBadge;
        
        // Cycle: XD → PM → PD → XD
        if (currentBadge === 'XD') {
            nextBadge = 'PM';
        } else if (currentBadge === 'PM') {
            nextBadge = 'PD';
        } else {
            nextBadge = 'XD';
        }
        
        // Update block data
        this.timeline.dataModel.updateItem(this.data.id, { badge: nextBadge });
        this.data.badge = nextBadge;
        
        // Update badge element - use stored reference or query selector
        const badge = this.badgeElement || this.element.querySelector('.timeline-block-badge');
        if (badge) {
            badge.dataset.badgeValue = nextBadge;
            badge.textContent = nextBadge;
            this.updateBadgeStyle(badge, nextBadge);
        } else {
            console.warn('Badge element not found when cycling badge');
        }
        
        // Update block border color based on new badge value
        this.updateBlockBadgeStyle(this.element, nextBadge);
    }
    
    updateBadgeStyle(badgeElement, badgeValue) {
        // Remove existing badge value classes
        badgeElement.classList.remove('badge-xd', 'badge-pm', 'badge-pd');
        
        // Add class for current badge value
        badgeElement.classList.add(`badge-${badgeValue.toLowerCase()}`);
    }
    
    updateBlockBadgeStyle(blockElement, badgeValue) {
        // Remove existing badge value classes
        blockElement.classList.remove('block-badge-xd', 'block-badge-pm', 'block-badge-pd');
        
        // Normalize badge value to lowercase for class name
        const normalizedBadge = (badgeValue || 'XD').toUpperCase();
        
        // Map badge values to CSS class names
        const classMap = {
            'XD': 'block-badge-xd',
            'PM': 'block-badge-pm',
            'PD': 'block-badge-pd'
        };
        
        // Get the class name for this badge value, default to XD if not found
        const badgeClass = classMap[normalizedBadge] || classMap['XD'];
        
        // Add class for current badge value
        blockElement.classList.add(badgeClass);
    }
}

