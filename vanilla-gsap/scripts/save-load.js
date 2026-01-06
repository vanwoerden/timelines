// Font cache for opentype.js
const fontCache = new Map();

/**
 * Extract font URL from @font-face CSS rules
 * @param {string} fontFamily - Font family name
 * @param {string} fontWeight - Font weight
 * @returns {string|null} Font file URL or null if not found
 */
function getFontUrlFromFontFace(fontFamily, fontWeight = '300') {
    // Parse all stylesheets to find @font-face rules
    for (let i = 0; i < document.styleSheets.length; i++) {
        try {
            const sheet = document.styleSheets[i];
            const rules = sheet.cssRules || sheet.rules;
            
            if (!rules) continue;
            
            for (let j = 0; j < rules.length; j++) {
                const rule = rules[j];
                
                if (rule.type === CSSRule.FONT_FACE_RULE) {
                    const fontFace = rule;
                    const ruleFamily = fontFace.style.getPropertyValue('font-family') || fontFace.fontFamily;
                    const ruleWeight = fontFace.style.getPropertyValue('font-weight') || fontFace.fontWeight || '400';
                    
                    // Normalize font family names (remove quotes, handle case)
                    const normalizedRuleFamily = ruleFamily.replace(/['"]/g, '').trim();
                    const normalizedTargetFamily = fontFamily.replace(/['"]/g, '').trim();
                    
                    // Check if font family matches
                    if (normalizedRuleFamily.toLowerCase() === normalizedTargetFamily.toLowerCase() ||
                        normalizedRuleFamily.includes(normalizedTargetFamily) ||
                        normalizedTargetFamily.includes(normalizedRuleFamily)) {
                        
                    // Check if font weight matches (allow some flexibility)
                    const targetWeight = parseInt(fontWeight) || 400;
                    const ruleWeightNum = parseInt(ruleWeight) || 400;
                    
                    // Check for exact match or closest match
                    if (targetWeight === ruleWeightNum) {
                        const src = fontFace.style.getPropertyValue('src') || fontFace.src;
                        if (src) {
                            // Extract URL from src property
                            const urlMatch = src.match(/url\(['"]?([^'"]+)['"]?\)/);
                            if (urlMatch) {
                                return urlMatch[1];
                            }
                        }
                    }
                    }
                }
            }
        } catch (e) {
            // Cross-origin stylesheets may throw errors, skip them
            continue;
        }
    }
    
    return null;
}

/**
 * Get font file path based on font family and weight
 * @param {string} fontFamily - Font family name
 * @param {string} fontWeight - Font weight
 * @returns {string|null} Font file path or null
 */
function getFontFilePath(fontFamily, fontWeight = '300') {
    // Map font weights to file names
    const weightMap = {
        '100': 'PPNeueMontrealMono-Thin.otf',
        '300': 'PPNeueMontrealMono-Book.otf',
        '400': 'PPNeueMontrealMono-Book.otf',
        '500': 'PPNeueMontrealMono-Medium.otf',
        '700': 'PPNeueMontrealMono-Bold.otf',
        'bold': 'PPNeueMontrealMono-Bold.otf',
        'normal': 'PPNeueMontrealMono-Book.otf'
    };
    
    if (fontFamily.includes('PP Neue Montreal') || fontFamily.includes('Montreal')) {
        const fileName = weightMap[fontWeight] || weightMap['300'];
        return `assets/fonts/${fileName}`;
    }
    
    return null;
}

/**
 * Load font using opentype.js
 * @param {string} fontFamily - Font family name
 * @param {string} fontWeight - Font weight
 * @returns {Promise<opentype.Font>} Font object
 */
async function loadFont(fontFamily, fontWeight = '300') {
    const cacheKey = `${fontFamily}-${fontWeight}`;
    
    if (fontCache.has(cacheKey)) {
        return fontCache.get(cacheKey);
    }
    
    if (!window.opentype) {
        throw new Error('opentype.js not available');
    }
    
    try {
        let fontUrl = null;
        
        // First, try to extract URL from @font-face rules
        fontUrl = getFontUrlFromFontFace(fontFamily, fontWeight);
        
        // If not found, try direct file path
        if (!fontUrl) {
            fontUrl = getFontFilePath(fontFamily, fontWeight);
        }
        
        if (!fontUrl) {
            throw new Error(`Font URL not available for ${fontFamily} weight ${fontWeight}`);
        }
        
        const font = await new Promise((resolve, reject) => {
            window.opentype.load(fontUrl, (err, font) => {
                if (err) reject(err);
                else resolve(font);
            });
        });
        
        fontCache.set(cacheKey, font);
        return font;
    } catch (error) {
        console.warn(`Failed to load font ${fontFamily} weight ${fontWeight}:`, error);
        throw error;
    }
}

/**
 * Get text lines from a DOM element by detecting actual line breaks using Range API
 * @param {HTMLElement} element - The element containing the text
 * @returns {Array<{text: string, x: number, y: number, height: number}>} Array of line objects
 */
function getTextLines(element) {
    const lines = [];
    const text = element.textContent || '';
    
    if (!text.trim()) {
        return lines;
    }
    
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const fontSize = parseFloat(style.fontSize) || 14;
    
    // Use Range API to get actual rendered line positions
    const range = document.createRange();
    const textNode = element.firstChild;
    
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        // Fallback: simple word wrapping
        const words = text.split(/\s+/);
        let currentLine = '';
        let currentY = paddingTop;
        const maxWidth = parseFloat(style.width) - paddingLeft - (parseFloat(style.paddingRight) || 0);
        
        // Create temporary element for measuring
        const measureEl = document.createElement('span');
        measureEl.style.position = 'absolute';
        measureEl.style.visibility = 'hidden';
        measureEl.style.whiteSpace = 'nowrap';
        measureEl.style.font = style.font;
        document.body.appendChild(measureEl);
        
        for (const word of words) {
            const testText = currentLine ? currentLine + ' ' + word : word;
            measureEl.textContent = testText;
            const testWidth = measureEl.getBoundingClientRect().width;
            
            if (testWidth > maxWidth && currentLine) {
                lines.push({
                    text: currentLine,
                    x: paddingLeft,
                    y: currentY,
                    height: lineHeight
                });
                currentLine = word;
                currentY += lineHeight;
            } else {
                currentLine = testText;
            }
        }
        
        if (currentLine) {
            lines.push({
                text: currentLine,
                x: paddingLeft,
                y: currentY,
                height: lineHeight
            });
        }
        
        document.body.removeChild(measureEl);
        return lines;
    }
    
    // Try to use Range API for more accurate line detection
    try {
        const textContent = textNode.textContent;
        let charIndex = 0;
        let currentY = paddingTop;
        let lastTop = null;
        let lineStart = 0;
        
        while (charIndex < textContent.length) {
            range.setStart(textNode, charIndex);
            range.setEnd(textNode, charIndex + 1);
            
            const rects = range.getClientRects();
            if (rects.length > 0) {
                const rect = rects[0];
                const elementRect = element.getBoundingClientRect();
                const relativeTop = rect.top - elementRect.top;
                
                if (lastTop !== null && Math.abs(relativeTop - lastTop) > lineHeight / 2) {
                    // New line detected
                    const lineText = textContent.substring(lineStart, charIndex).trim();
                    if (lineText) {
                        lines.push({
                            text: lineText,
                            x: paddingLeft,
                            y: lastTop,
                            height: lineHeight
                        });
                    }
                    lineStart = charIndex;
                    currentY = relativeTop;
                }
                
                lastTop = relativeTop;
            }
            
            charIndex++;
        }
        
        // Add the last line
        const lastLineText = textContent.substring(lineStart).trim();
        if (lastLineText) {
            lines.push({
                text: lastLineText,
                x: paddingLeft,
                y: lastTop !== null ? lastTop : currentY,
                height: lineHeight
            });
        }
    } catch (e) {
        // Fallback to simple word wrapping if Range API fails
        const words = text.split(/\s+/);
        let currentLine = '';
        let currentY = paddingTop;
        const maxWidth = parseFloat(style.width) - paddingLeft - (parseFloat(style.paddingRight) || 0);
        
        const measureEl = document.createElement('span');
        measureEl.style.position = 'absolute';
        measureEl.style.visibility = 'hidden';
        measureEl.style.whiteSpace = 'nowrap';
        measureEl.style.font = style.font;
        document.body.appendChild(measureEl);
        
        for (const word of words) {
            const testText = currentLine ? currentLine + ' ' + word : word;
            measureEl.textContent = testText;
            const testWidth = measureEl.getBoundingClientRect().width;
            
            if (testWidth > maxWidth && currentLine) {
                lines.push({
                    text: currentLine,
                    x: paddingLeft,
                    y: currentY,
                    height: lineHeight
                });
                currentLine = word;
                currentY += lineHeight;
            } else {
                currentLine = testText;
            }
        }
        
        if (currentLine) {
            lines.push({
                text: currentLine,
                x: paddingLeft,
                y: currentY,
                height: lineHeight
            });
        }
        
        document.body.removeChild(measureEl);
    }
    
    return lines;
}

/**
 * Convert text to SVG path using opentype.js
 * @param {string} text - Text to convert
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} fontFamily - Font family name
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontWeight - Font weight
 * @param {string} fillColor - Fill color for the path
 * @returns {Promise<string>} SVG path string
 */
async function textToPath(text, x, y, fontFamily, fontSize, fontWeight = '300', fillColor = 'currentColor') {
    if (!text || text.trim() === '') {
        return '';
    }
    
    try {
        // Normalize font-weight to string
        const normalizedWeight = String(fontWeight);
        const font = await loadFont(fontFamily, normalizedWeight);
        const path = font.getPath(text, x, y, fontSize);
        const pathData = path.toSVG(2); // 2 decimal places
        
        // Extract path data and wrap in a path element with fill color
        const pathMatch = pathData.match(/d="([^"]+)"/);
        if (pathMatch) {
            return `<path d="${pathMatch[1]}" fill="${fillColor}"/>`;
        }
        return pathData.replace(/fill="[^"]*"/, `fill="${fillColor}"`);
    } catch (error) {
        // Fallback: use SVG text element (not a true path, but functional)
        console.warn('Using fallback SVG text for:', text, error);
        return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fillColor}">${text}</text>`;
    }
}

/**
 * Convert multi-line text to SVG paths, handling text wrapping
 * @param {HTMLElement} element - The DOM element containing the text
 * @param {number} baseX - Base X position
 * @param {number} baseY - Base Y position
 * @returns {Promise<string>} SVG group containing all line paths
 */
async function textToPathsMultiLine(element, baseX, baseY) {
    const style = window.getComputedStyle(element);
    const fontFamily = style.fontFamily || 'inherit';
    const fontSize = parseFloat(style.fontSize) || 14;
    const fontWeight = style.fontWeight || '300';
    const textColor = style.color || '#000000';
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.4;
    
    // Get text lines
    const lines = getTextLines(element);
    
    if (lines.length === 0) {
        return '';
    }
    
    // Create paths for each line
    const pathGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineX = baseX + line.x;
        const lineY = baseY + line.y + fontSize; // Adjust for baseline
        
        const pathString = await textToPath(line.text, lineX, lineY, fontFamily, fontSize, fontWeight, textColor);
        if (pathString) {
            const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lineGroup.innerHTML = pathString;
            pathGroup.appendChild(lineGroup);
        }
    }
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(pathGroup);
}

/**
 * Export timeline to SVG
 * @param {Timeline} timeline - Timeline instance
 * @param {TimelineDataModel} dataModel - Data model instance
 */
async function exportToSVG(timeline, dataModel) {
    const container = timeline.container;
    const padding = 40; // Padding around content
    
    // First, collect all blocks and annotations to calculate bounding box
    const items = [];
    for (const [id, item] of timeline.items) {
        if (item.data && (item.data.type === 'block' || item.data.type === 'annotation')) {
            const el = item.element;
            const left = parseFloat(el.style.left) || 0;
            const top = parseFloat(el.style.top) || 0;
            const width = parseFloat(el.style.width) || 0;
            const height = parseFloat(el.style.height) || 0;
            
            if (item.data.type === 'block') {
                items.push({
                    type: 'block',
                    left: left,
                    top: top,
                    right: left + width,
                    bottom: top + height,
                    element: el,
                    item: item
                });
            } else if (item.data.type === 'annotation') {
                // For annotations, account for circle size and tooltip
                const circleEl = el.querySelector('.annotation-circle-inner');
                const circleSize = circleEl ? (parseFloat(window.getComputedStyle(circleEl).width) || 16) : 16;
                const tooltipEl = el.querySelector('.annotation-tooltip');
                let tooltipHeight = 0;
                if (tooltipEl && !tooltipEl.classList.contains('hidden') && tooltipEl.textContent) {
                    tooltipHeight = parseFloat(window.getComputedStyle(tooltipEl).height) || 0;
                }
                
                items.push({
                    type: 'annotation',
                    left: left - circleSize / 2,
                    top: top,
                    right: left + circleSize / 2,
                    bottom: top + circleSize + tooltipHeight,
                    element: el,
                    item: item
                });
            }
        }
    }
    
    // Calculate bounding box
    if (items.length === 0) {
        // No items, export empty SVG with minimal size
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '100');
        svg.setAttribute('height', '100');
        svg.setAttribute('viewBox', '0 0 100 100');
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', '100');
        bgRect.setAttribute('height', '100');
        bgRect.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#0f0f0f');
        svg.appendChild(bgRect);
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-${Date.now()}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }
    
    const minX = Math.min(...items.map(i => i.left)) - padding;
    const minY = Math.min(...items.map(i => i.top)) - padding;
    const maxX = Math.max(...items.map(i => i.right)) + padding;
    const maxY = Math.max(...items.map(i => i.bottom)) + padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Set background
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', width);
    bgRect.setAttribute('height', height);
    bgRect.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#0f0f0f');
    svg.appendChild(bgRect);
    
    // Create groups for organization
    const gridlinesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridlinesGroup.setAttribute('id', 'gridlines');
    const blocksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    blocksGroup.setAttribute('id', 'blocks');
    const annotationsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    annotationsGroup.setAttribute('id', 'annotations');
    const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelsGroup.setAttribute('id', 'labels');
    
    // Export gridlines (horizontal) - only within bounding box
    const gridlineColor = getComputedStyle(document.documentElement).getPropertyValue('--gridline-color').trim() || '#2b2929';
    const rowSpacing = timeline.config.blockHeight + timeline.config.annotationSpace;
    const timelinePadding = 32;
    
    // Find the first gridline that's within or before our bounding box
    let startY = timelinePadding;
    while (startY < minY) {
        startY += rowSpacing;
    }
    // Adjust to relative coordinates
    const relativeStartY = startY - minY;
    
    let currentY = relativeStartY;
    while (currentY < height) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', currentY);
        line.setAttribute('x2', width);
        line.setAttribute('y2', currentY);
        line.setAttribute('stroke', gridlineColor);
        line.setAttribute('stroke-width', '1');
        gridlinesGroup.appendChild(line);
        currentY += rowSpacing;
    }
    
    // Export vertical gridlines - only within bounding box
    const { startDay, endDay } = timeline.getExtendedDayRange();
    for (let day = startDay; day <= endDay; day++) {
        const x = timeline.dayToPixel(day);
        if (x >= minX && x <= maxX) {
            const relativeX = x - minX;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', relativeX);
            line.setAttribute('y1', '0');
            line.setAttribute('x2', relativeX);
            line.setAttribute('y2', height);
            line.setAttribute('stroke', gridlineColor);
            line.setAttribute('stroke-width', '1');
            gridlinesGroup.appendChild(line);
        }
    }
    
    svg.appendChild(gridlinesGroup);
    
    // Export blocks
    for (const [id, item] of timeline.items) {
        if (item.data && item.data.type === 'block') {
            const blockEl = item.element;
            const left = parseFloat(blockEl.style.left) || 0;
            const top = parseFloat(blockEl.style.top) || 0;
            const blockWidth = parseFloat(blockEl.style.width) || 0;
            const blockHeight = parseFloat(blockEl.style.height) || 0;
            
            // Adjust positions relative to bounding box
            const relativeLeft = left - minX;
            const relativeTop = top - minY;
            
            // Get computed styles
            const computedStyle = window.getComputedStyle(blockEl);
            const bgColor = computedStyle.backgroundColor || 'rgba(0, 0, 0, 0.25)';
            const borderColor = computedStyle.borderColor || '#3a3e3c';
            
            // Create block rect
            const blockRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            blockRect.setAttribute('x', relativeLeft);
            blockRect.setAttribute('y', relativeTop);
            blockRect.setAttribute('width', blockWidth);
            blockRect.setAttribute('height', blockHeight);
            blockRect.setAttribute('fill', bgColor);
            blockRect.setAttribute('stroke', borderColor);
            blockRect.setAttribute('stroke-width', '1');
            blocksGroup.appendChild(blockRect);
            
            // Export label text with exact styling
            const labelEl = blockEl.querySelector('.label');
            if (labelEl && labelEl.textContent && labelEl.textContent !== '\u00A0') {
                const labelStyle = window.getComputedStyle(labelEl);
                const blockStyle = window.getComputedStyle(blockEl);
                
                // Get exact padding from block element (not label, as padding is on the block)
                const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                
                // Get exact font properties from label
                const fontFamily = labelStyle.fontFamily || 'inherit';
                const fontSize = parseFloat(labelStyle.fontSize) || 14;
                const fontWeight = labelStyle.fontWeight || '500';
                const textColor = labelStyle.color || '#ffffff';
                
                // Use multi-line text conversion to handle wrapping
                const labelX = relativeLeft + blockPaddingLeft;
                const labelY = relativeTop + blockPaddingTop;
                
                const textPaths = await textToPathsMultiLine(labelEl, labelX, labelY);
                if (textPaths) {
                    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    textEl.innerHTML = textPaths;
                    blocksGroup.appendChild(textEl);
                }
            }
            
            // Export badge text with exact styling
            const badgeEl = blockEl.querySelector('.timeline-block-badge');
            if (badgeEl && badgeEl.textContent) {
                const badgeStyle = window.getComputedStyle(badgeEl);
                const badgeText = badgeEl.textContent;
                
                // Get exact positioning - badge is positioned absolutely at top-right
                const badgePaddingTop = parseFloat(badgeStyle.paddingTop) || 2;
                const badgePaddingLeft = parseFloat(badgeStyle.paddingLeft) || 3;
                const badgeWidth = badgeEl.getBoundingClientRect().width || 0;
                
                const badgeX = relativeLeft + blockWidth - badgeWidth + badgePaddingLeft;
                const badgeY = relativeTop + badgePaddingTop;
                
                const fontFamily = badgeStyle.fontFamily || 'inherit';
                const fontSize = parseFloat(badgeStyle.fontSize) || 11;
                const fontWeight = badgeStyle.fontWeight || '300';
                const textColor = badgeStyle.color || '#a0a0a0';
                
                const badgePath = await textToPath(badgeText, badgeX, badgeY + fontSize, fontFamily, fontSize, fontWeight, textColor);
                if (badgePath) {
                    const badgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    badgeGroup.innerHTML = badgePath;
                    blocksGroup.appendChild(badgeGroup);
                }
            }
        }
    }
    
    svg.appendChild(blocksGroup);
    
    // Export annotations
    for (const [id, item] of timeline.items) {
        if (item.data && item.data.type === 'annotation') {
            const annotationEl = item.element;
            const left = parseFloat(annotationEl.style.left) || 0;
            const top = parseFloat(annotationEl.style.top) || 0;
            
            // Adjust positions relative to bounding box
            const relativeLeft = left - minX;
            const relativeTop = top - minY;
            
            // Annotation circle
            const circleEl = annotationEl.querySelector('.annotation-circle-inner');
            if (circleEl) {
                const circleStyle = window.getComputedStyle(circleEl);
                const circleSize = parseFloat(circleStyle.width) || 16;
                const circleX = relativeLeft; // Already centered due to transform
                const circleY = relativeTop + (circleSize / 2);
                const fillColor = circleStyle.backgroundColor || '#191a1a';
                const strokeColor = circleStyle.borderColor || '#a0a0a0';
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', circleX);
                circle.setAttribute('cy', circleY);
                circle.setAttribute('r', circleSize / 2);
                circle.setAttribute('fill', fillColor);
                circle.setAttribute('stroke', strokeColor);
                circle.setAttribute('stroke-width', '1');
                annotationsGroup.appendChild(circle);
            }
            
            // Annotation tooltip text with exact styling
            const tooltipEl = annotationEl.querySelector('.annotation-tooltip');
            if (tooltipEl && !tooltipEl.classList.contains('hidden') && tooltipEl.textContent) {
                const tooltipStyle = window.getComputedStyle(tooltipEl);
                const circleEl = annotationEl.querySelector('.annotation-circle-inner');
                const circleSize = circleEl ? (parseFloat(window.getComputedStyle(circleEl).width) || 16) : 16;
                
                // Get exact padding
                const tooltipPaddingTop = parseFloat(tooltipStyle.paddingTop) || 6;
                const tooltipPaddingLeft = parseFloat(tooltipStyle.paddingLeft) || 10;
                
                // Tooltip is positioned below the circle (16px) and centered
                const tooltipX = relativeLeft;
                const tooltipY = relativeTop + circleSize + tooltipPaddingTop;
                
                const fontFamily = tooltipStyle.fontFamily || 'inherit';
                const fontSize = parseFloat(tooltipStyle.fontSize) || 12;
                const fontWeight = tooltipStyle.fontWeight || '300';
                const textColor = tooltipStyle.color || '#f1f1f1';
                
                // Check if tooltip is multi-line
                const isMultiLine = tooltipEl.classList.contains('multi-line') || 
                                   tooltipStyle.whiteSpace === 'normal';
                
                if (isMultiLine) {
                    // Use multi-line conversion for wrapped text
                    const textPaths = await textToPathsMultiLine(tooltipEl, tooltipX, tooltipY);
                    if (textPaths) {
                        const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        tooltipGroup.innerHTML = textPaths;
                        // Center the group
                        const bbox = tooltipGroup.getBBox();
                        tooltipGroup.setAttribute('transform', `translate(${-bbox.width / 2}, 0)`);
                        annotationsGroup.appendChild(tooltipGroup);
                    }
                } else {
                    // Single line tooltip
                    const tooltipText = tooltipEl.textContent;
                    const tooltipPath = await textToPath(tooltipText, tooltipX, tooltipY + fontSize, fontFamily, fontSize, fontWeight, textColor);
                    if (tooltipPath) {
                        const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        tooltipGroup.innerHTML = tooltipPath;
                        const pathNode = tooltipGroup.querySelector('path');
                        if (pathNode) {
                            // Center the path by adjusting transform
                            const bbox = pathNode.getBBox();
                            pathNode.setAttribute('transform', `translate(${-bbox.width / 2}, 0)`);
                        }
                        const textNode = tooltipGroup.querySelector('text');
                        if (textNode) {
                            textNode.setAttribute('text-anchor', 'middle');
                        }
                        annotationsGroup.appendChild(tooltipGroup);
                    }
                }
            }
        }
    }
    
    svg.appendChild(annotationsGroup);
    
    // Export date labels - only those within bounding box
    for (const [day, labelEl] of timeline.dateLabelMap) {
        if (labelEl && labelEl.style.opacity !== '0') {
            const labelStyle = window.getComputedStyle(labelEl);
            const labelText = labelEl.textContent;
            const left = parseFloat(labelEl.style.left) || 0;
            const top = parseFloat(labelEl.style.top) || 8;
            
            // Only include labels within the bounding box
            if (left >= minX && left <= maxX && top >= minY && top <= maxY) {
                const relativeLeft = left - minX;
                const relativeTop = top - minY;
                const fontFamily = labelStyle.fontFamily || 'inherit';
                const fontSize = parseFloat(labelStyle.fontSize) || 10;
                const textColor = labelStyle.color || '#a0a0a0';
                
                const labelPath = await textToPath(labelText, relativeLeft, relativeTop + parseFloat(fontSize), fontFamily, fontSize, '300', textColor);
                if (labelPath) {
                    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    labelGroup.innerHTML = labelPath;
                    const pathNode = labelGroup.querySelector('path');
                    if (pathNode) {
                        // Path elements don't have text-anchor, but we can adjust positioning if needed
                    }
                    const textNode = labelGroup.querySelector('text');
                    if (textNode) {
                        textNode.setAttribute('text-anchor', 'middle');
                    }
                    labelsGroup.appendChild(labelGroup);
                }
            }
        }
    }
    
    svg.appendChild(labelsGroup);
    
    // Convert SVG to string and download
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function setupSaveLoad(dataModel, timeline) {
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    const splitDropdownBtn = document.getElementById('splitDropdownBtn');
    const splitDropdownMenu = document.getElementById('splitDropdownMenu');
    const fileInput = document.getElementById('fileInput');
    
    // Split button dropdown toggle
    if (splitDropdownBtn && splitDropdownMenu) {
        splitDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            splitDropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!splitDropdownBtn.contains(e.target) && !splitDropdownMenu.contains(e.target)) {
                splitDropdownMenu.classList.remove('show');
            }
        });
        
        // Close dropdown when clicking a menu item
        const menuItems = splitDropdownMenu.querySelectorAll('.split-dropdown-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                splitDropdownMenu.classList.remove('show');
            });
        });
    }
    
    // SVG export
    if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', async () => {
            await exportToSVG(timeline, dataModel);
        });
    }
    
    saveBtn.addEventListener('click', () => {
        const json = dataModel.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    loadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const json = event.target.result;
            if (dataModel.fromJSON(json)) {
                // Trigger re-render
                const event = new CustomEvent('timeline:data-loaded');
                window.dispatchEvent(event);
            } else {
                alert('Failed to load timeline. Please check the file format.');
            }
        };
        reader.readAsText(file);
        
        // Reset input
        fileInput.value = '';
    });
}

