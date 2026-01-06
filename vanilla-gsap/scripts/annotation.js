export class Annotation {
    constructor(data, timeline) {
        this.data = data;
        this.timeline = timeline;
        this.element = this.createElement();
        this.isEditing = false;
        this.tooltipElement = null;
    }
    
    createElement() {
        const annotation = document.createElement('div');
        annotation.className = 'annotation';
        annotation.dataset.id = this.data.id;
        annotation.dataset.type = 'annotation';
        
        // Position in reserved space below the row
        // Get relative day from absolute date
        const date = this.data.date || this.timeline.dataModel.getDateFromRelativeDay(this.data.day || 0);
        const relativeDay = this.timeline.getRelativeDayFromDate(date);
        const left = this.timeline.dayToPixel(relativeDay);
        const padding = 32; // 2rem padding
        const rowSpacing = this.timeline.config.blockHeight + this.timeline.config.annotationSpace;
        const blockTop = padding + (this.data.row * rowSpacing);
        // Position annotation so circle center aligns with block bottom (move up by 8px, half of 16px diameter)
        const annotationTop = blockTop + this.timeline.config.blockHeight - 8;
        
        // Only set dynamic positioning inline, all other styles in CSS
        annotation.style.left = `${left}px`;
        annotation.style.top = `${annotationTop}px`;
        
        // Always show display mode (even if text is empty, user can click to edit)
        this.renderDisplayMode(annotation);
        
        return annotation;
    }
    
    renderDisplayMode(container) {
        container.innerHTML = '';
        container.classList.remove('annotation-input-container');
        container.classList.add('annotation-circle');
        
        // Clear tooltip element reference since innerHTML was cleared
        if (this.tooltipElement) {
            this.tooltipElement = null;
        }
        
        // Create circle
        const circle = document.createElement('div');
        circle.className = 'annotation-circle-inner';
        // All styling is handled by CSS - no inline styles needed
        
        container.appendChild(circle);
        
        // Always show tooltip with full text (pass container since this.element may not be set yet)
        // Use requestAnimationFrame to ensure circle is in DOM before showing tooltip
        requestAnimationFrame(() => {
            this.showTooltip(container);
        });
        
        // Click to select and edit
        container.addEventListener('click', (e) => {
            if (!this.isEditing) {
                // Select the annotation first
                const annotationId = this.data.id;
                this.timeline.selectAnnotation(annotationId);
                // Then enter edit mode
                this.startEditing();
                e.stopPropagation();
                e.preventDefault();
            }
        });
    }
    
    renderEditMode(container) {
        container.innerHTML = '';
        container.classList.remove('annotation-circle');
        container.classList.add('annotation-input-container');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'annotation-input';
        input.value = this.data.text || '';
        input.placeholder = '';
        
        container.appendChild(input);
        
        this.isEditing = true;
        
        const finishEditing = () => {
            const newText = input.value.trim();
            if (newText) {
                this.timeline.dataModel.updateItem(this.data.id, { text: newText });
                this.data.text = newText;
                this.renderDisplayMode(container);
                this.isEditing = false;
            } else {
                // Remove annotation if empty
                this.timeline.dataModel.removeAnnotation(this.data.id);
                this.timeline.removeItem(this.data.id);
            }
        };
        
        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEditing();
            } else if (e.key === 'Escape') {
                if (this.data.text && this.data.text.trim()) {
                    // Cancel editing, show display mode
                    this.renderDisplayMode(container);
                    this.isEditing = false;
                } else {
                    // Remove annotation if it was empty
                    this.timeline.dataModel.removeAnnotation(this.data.id);
                    this.timeline.removeItem(this.data.id);
                }
            }
        });
        
        // Use requestAnimationFrame to ensure input is in DOM before focusing
        requestAnimationFrame(() => {
            if (input.parentNode) {
                input.focus();
            }
        });
    }
    
    startEditing() {
        if (this.isEditing) return;
        
        // Verify element exists and is in the DOM
        if (!this.element) {
            console.warn('Annotation startEditing: element not found');
            return;
        }
        
        if (!this.element.parentNode) {
            console.warn('Annotation startEditing: element not in DOM');
            return;
        }
        
        // Keep tooltip visible during editing, but hide it
        this.hideTooltip();
        this.renderEditMode(this.element);
    }
    
    showTooltip(container = null) {
        // Don't show tooltip if text is empty
        if (!this.data.text || !this.data.text.trim()) {
            if (this.tooltipElement) {
                this.tooltipElement.classList.add('hidden');
            }
            return;
        }
        
        // Use provided container or fall back to this.element
        const targetContainer = container || this.element;
        if (!targetContainer) {
            // If neither container nor this.element is available, can't show tooltip
            return;
        }
        
        const fullText = this.data.text.trim();
        
        // Create or update tooltip element
        // Check if tooltip element exists and is still in the DOM
        if (!this.tooltipElement || !this.tooltipElement.parentNode) {
            // Create new tooltip element
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.className = 'annotation-tooltip';
            
            // Position below the annotation (at triangle bottom)
            targetContainer.appendChild(this.tooltipElement);
        }
        
        // Remove hidden class to show tooltip
        this.tooltipElement.classList.remove('hidden');
        
        // Update text content with full text
        this.tooltipElement.textContent = fullText;
        
        // Measure text width to determine if it should be single line or wrap
        // First, add single-line class temporarily to measure the natural width
        this.tooltipElement.classList.remove('multi-line');
        this.tooltipElement.classList.add('single-line');
        
        // Force a reflow to get accurate measurements
        void this.tooltipElement.offsetWidth;
        
        // Measure the actual width
        const textWidth = this.tooltipElement.getBoundingClientRect().width;
        
        // If width < 200px, keep it single line (nowrap)
        // If width >= 200px, allow wrapping (normal) with max-width 200px
        if (textWidth < 200) {
            this.tooltipElement.classList.remove('multi-line');
            this.tooltipElement.classList.add('single-line');
        } else {
            this.tooltipElement.classList.remove('single-line');
            this.tooltipElement.classList.add('multi-line');
        }
    }
    
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.classList.add('hidden');
        }
    }
    
    update(data) {
        this.data = data;
        
        // Get relative day from absolute date
        const date = this.data.date || this.timeline.dataModel.getDateFromRelativeDay(this.data.day || 0);
        const relativeDay = this.timeline.getRelativeDayFromDate(date);
        const left = this.timeline.dayToPixel(relativeDay);
        
        const padding = 32;
        const rowSpacing = this.timeline.config.blockHeight + this.timeline.config.annotationSpace;
        const blockTop = padding + (this.data.row * rowSpacing);
        // Position annotation so circle center aligns with block bottom (move up by 8px, half of 16px diameter)
        const annotationTop = blockTop + this.timeline.config.blockHeight - 8;
        
        const gsap = window.gsap;
        gsap.to(this.element, {
            left: `${left}px`,
            top: `${annotationTop}px`,
            duration: 0.3,
            ease: 'power2.out'
        });
        
        // Re-render if text changed (always show display mode, even if empty)
        if (!this.isEditing) {
            this.renderDisplayMode(this.element);
            // Tooltip will be shown in renderDisplayMode
        }
    }
}

