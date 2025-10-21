/*!
    * Multilevel nav slide over extension v2.0.0.0 Beta
    */

class MultilevelSlideOver {
    keydownHandler = null;
    focusBeforeOffCanvas = null;
    settings = {};
    
    constructor(elements, options = {}) {
        // Default settings
        this.settings = {
            slideTitles: true,
            slideTitleLink: false,
            backButtonSymbol: '&lsaquo;',
            dynamicBackButtonTitle: false,
            offCanvasCloseAllMenus: false,
            ...options
        };
        
        this.init(elements);
    }
    
    init(elements) {
        // Handle string selectors
        if (typeof elements === 'string') {
            elements = document.querySelectorAll(elements);
        }
        
        // Handle single element
        if (elements instanceof HTMLElement) {
            elements = [elements];
        }
        
        // Convert NodeList to array if needed
        if (elements instanceof NodeList) {
            elements = Array.from(elements);
        }
        
        // Process each element
        elements.forEach(element => this.setupElement(element));
        
        // Return the processed elements for chaining
        return elements;
    }
    
    isVisible(el) {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    }
    
    getTabbableElements(container) {
        const tabbableElementsArray = [
            'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
            'textarea:not([disabled])', 'button:not([disabled])', 'iframe', 'object',
            'embed', '[tabindex="0"]', '[contenteditable]'
        ];
        
        return Array.from(container.querySelectorAll(tabbableElementsArray))
            .filter(el => this.isVisible(el) && el.tabIndex >= 0);
    }
    
    slideOverKeyboardTrap(el) {
        const container = el.closest('.l-off-canvas') || el;
        
        // Save currently focused element to return to it later
        this.focusBeforeOffCanvas = document.activeElement;
        
        this.keydownHandler = (e) => {
            if (e.key === 'Tab') {
                const tabbable = this.getTabbableElements(container);
                const first = tabbable[0];
                const last = tabbable[tabbable.length - 1];
                
                if (tabbable.length === 0) {
                    e.preventDefault();
                    return;
                }
                
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        
        container.addEventListener('keydown', this.keydownHandler);
        
        const initialTabbable = this.getTabbableElements(container)[0];
        
        if (!document.querySelector('.mln__list .active') && initialTabbable) {
            initialTabbable.focus();
        }
    }
    
    removeTrapKeyboardHandlers(el) {
        if (this.keydownHandler) {
            el.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
            // this.focusBeforeOffCanvas.focus();
        }
    }
    
    closeAllChildren(element) {
        if (element.classList.contains('mln--navbar-slide-over')) {
            // Hide all expanded elements
            element.querySelectorAll('[data-mln-hidden="false"]').forEach(el => {
                el.setAttribute('data-mln-hidden', 'true');
                el.classList.remove('mln--height-auto', 'mln__child--overflow-visible');
            });
            
            // Remove visible menu class
            element.querySelectorAll('.mln__visible-menu').forEach(menu => {
                menu.classList.remove('mln__visible-menu');
            });
            
            // Add visible menu class to main list
            const mainList = element.querySelector('.mln__list');
            if (mainList) {
                mainList.classList.add('mln__visible-menu');
            }
            
            // Collapse expanded elements
            element.querySelectorAll('[aria-expanded="true"]').forEach(el => {
                el.setAttribute('aria-expanded', 'false');
                const hasChild = el.closest('.mln__has-child--showing');
                
                if (hasChild) {
                    hasChild.classList.remove('mln__has-child--showing');
                }
            });
            
            // Reset min-height
            element.style.minHeight = '';
        }
    }
    
    setDynamicHeight(element) {
        // Reset inline styles
        element.querySelectorAll('.mln__child__collapse').forEach(el => {
            el.style.minHeight = '';
        });
        
        // Get the last showing has-child element
        const allShowing = element.querySelectorAll('.mln__has-child.mln__has-child--showing');
        const lastShowing = allShowing[allShowing.length - 1] || null;
        
        let parentCollapse = null;
        let latestChildShowing = null;
        
        if (lastShowing) {
            parentCollapse = lastShowing.closest('.mln__child__collapse');
            
            const directCollapse = lastShowing.querySelector(':scope > .mln__child__collapse');
            if (directCollapse) {
                latestChildShowing = directCollapse.querySelector(':scope > .mln__child__collapse__helper');
            }
        }
        
        // Determine element to get height from
        const getHeightFromThis = latestChildShowing || element.querySelector('.mln__list');
        
        // Get height
        const dynamicHeight = getHeightFromThis ? getHeightFromThis.offsetHeight : 0;
        
        // Apply height to nav
        element.style.minHeight = dynamicHeight + 'px';
        
        // Apply height to parent collapse if available
        if (parentCollapse) {
            parentCollapse.style.minHeight = dynamicHeight + 'px';
        }
    }

    setupElement(element) {
        const mlnDataBreakpoint = (element.getAttribute('data-mln-breakpoint')) 
            ? parseInt(element.getAttribute('data-mln-breakpoint')) 
            : undefined;
        
        // Add slide-over controls to each child menu
        const hasChildElements = element.querySelectorAll('.mln__has-child');
        
        hasChildElements.forEach(navEl => {
            const childCollapse = navEl.querySelector('.mln__child__collapse');
            
            if (!childCollapse) return;
            
            const currentMenuId = childCollapse.getAttribute('id');
            const collapseHelper = childCollapse.querySelector('.mln__child__collapse__helper');
            const menuSectionLink = navEl.querySelector('.mln__child-controls > a');
            
            if (!collapseHelper || !menuSectionLink) return;
            
            const menuSectionLabel = menuSectionLink.innerHTML;
            const backButtonSymbol = this.settings.backButtonSymbol ? 
                `<span data-mln-hidden="true">${this.settings.backButtonSymbol}</span> ` : '';
            
            const isNotLinkable = menuSectionLink.getAttribute('data-mln-not-linkable');
            const useMenuText = isNotLinkable || this.settings.dynamicBackButtonTitle;
            const backButtonText = useMenuText ? 
                `${backButtonSymbol}${menuSectionLink.textContent}` : 
                `${backButtonSymbol}Back`;
            
            // Create controls container
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'mln__slide-over-controls';
            collapseHelper.insertBefore(controlsDiv, collapseHelper.firstChild);
            
            // Create back button
            const backBtn = document.createElement('button');
            backBtn.className = 'mln__back-btn';
            backBtn.setAttribute('type', 'button');
            backBtn.setAttribute('aria-controls', currentMenuId);
            backBtn.innerHTML = backButtonText;
            controlsDiv.appendChild(backBtn);
            
            // Build slide title (no link)
            if (this.settings.slideTitles && !this.settings.slideTitleLink) {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'mln__slide-over-title';
                titleSpan.innerHTML = menuSectionLabel;
                controlsDiv.appendChild(titleSpan);
            }
            
            // Build slide title with link
            if (this.settings.slideTitles && this.settings.slideTitleLink) {
                const titleLink = menuSectionLink.cloneNode(true);
                titleLink.classList.add('mln__slide-over-title');
                titleLink.classList.remove('mln__toggle-link');
                titleLink.removeAttribute('role');
                titleLink.removeAttribute('aria-expanded');
                titleLink.removeAttribute('aria-controls');
                
                // Remove toggle indicator if exists
                const toggleIndicator = titleLink.querySelector('.mln__toggle-indicator');
                if (toggleIndicator) {
                    toggleIndicator.remove();
                }
                
                controlsDiv.appendChild(titleLink);
            }
            
            // Add back button click handler
            backBtn.addEventListener('click', () => {
                const toggleElement = navEl.querySelector(
                    `.mln__toggle-btn[aria-controls="${currentMenuId}"], .mln__toggle-link[aria-controls="${currentMenuId}"]`
                );
                
                if (toggleElement) {
                    // Create and dispatch click event
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    
                    toggleElement.dispatchEvent(clickEvent);
                }
            });
        });
        
        // Event listeners for navigation events
        element.addEventListener('show.mln.child', () => {
            if (
                (element.classList.contains('mln--navbar-slide-over') && 
                window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches) || 
                mlnDataBreakpoint === undefined
            ) {
                this.setDynamicHeight(element);
            }
        });
        
        element.addEventListener('hide.mln.child', () => {
            if (
                (element.classList.contains('mln--navbar-slide-over') && 
                window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches) || 
                mlnDataBreakpoint === undefined
            ) {
                this.setDynamicHeight(element);
            }
        });
        
        element.addEventListener('shown.mln.child', () => {
            const showingElements = element.querySelectorAll('.mln__has-child--showing');
            
            if (showingElements.length) {
                const latestNavShowing = showingElements[showingElements.length - 1];
                latestNavShowing.classList.add('mln__has-child--active');
                
                const childCollapse = latestNavShowing.querySelector('.mln__child__collapse');
                
                if (childCollapse) {
                    this.removeTrapKeyboardHandlers(childCollapse);
                    
                    if (
                        element.classList.contains('mln--navbar-slide-over') &&
                        window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches
                    ) {
                        this.slideOverKeyboardTrap(childCollapse);
                    }
                }
            }
        });
        
        // Handle off-canvas close if needed
        if (this.settings.offCanvasCloseAllMenus) {
            const offCanvasToggles = document.querySelectorAll('[data-oc-toggle], [data-oc-close]');
            
            offCanvasToggles.forEach(toggleButton => {
                // Use a one-time listener
                const clickHandler = () => {
                    if (toggleButton.getAttribute('aria-expanded') === 'true') {
                        // Listen for hidden.offCanvas event
                        document.addEventListener('hidden.offCanvas', () => {
                            this.closeAllChildren(element);
                        }, { once: true });
                    }
                };
                
                toggleButton.addEventListener('click', clickHandler);
            });
        }
        
        // Initialize dynamic height
        this.setDynamicHeight(element);
        
        // Handle resize events
        window.addEventListener('mlnResizeEnd', () => {
            if (element.classList.contains('mln--navbar-slide-over') && window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches) {
                const childCollapse = element.closest('.l-off-canvas') || element.querySelector('.mln__child__collapse');
                
                if (childCollapse) {
                    this.removeTrapKeyboardHandlers(childCollapse);
                }
                
                element.style.minHeight = '';
            } else {
                this.setDynamicHeight(element);
            }
        });
    }
}

// Factory function for creating instances
const multilevelNavSlideOver = (selector, options) => {
    const elements = document.querySelectorAll(selector);
    const instances = [];
    
    elements.forEach(element => {
        instances.push(new MultilevelSlideOver(element, options));
    });
    
    return instances;
};

// jQuery integration
if (typeof jQuery !== 'undefined') {
    jQuery.fn.multilevelNavSlideOver = function(options) {
        return this.each(function() {
            new MultilevelSlideOver(this, options);
        });
    };
}
//# sourceMappingURL=multilevel-nav-slide-over.js.map
