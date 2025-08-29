/*!
  * Multilevel nav slide over extension v2.0.0.0 Beta
  */

/* eslint-env es6 */

const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

const getTabbableElements = (container) => {
    const tabbableElementsArray = [
        'a[href]',
        'area[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        'iframe',
        'object',
        'embed',
        '[tabindex="0"]',
        '[contenteditable]'
    ];

    return Array.from(container.querySelectorAll(tabbableElementsArray)).filter(el => isVisible(el) && el.tabIndex >= 0);
}

let keydownHandler = null;

const slideOverKeyboardTrap = (el) => {

    const container = el.closest('.l-off-canvas') || el;
    // const container = el;

    // Save currently focused element to return to it later
    focusBeforeOffCanvas = document.activeElement;

    keydownHandler = (e) => {
        if (e.key === 'Tab') {
            const tabbable = getTabbableElements(container);
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

    container.addEventListener('keydown', keydownHandler);

    const initialTabbable = getTabbableElements(container)[0];
    
    if (!document.querySelector('.mln__list .active') && initialTabbable) {
        initialTabbable.focus();
    }
}

const removeTrapKeyboardHandlers = (el) => {
    if (keydownHandler) {
        el.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
        // focusBeforeOffCanvas.focus();
    }
}

const multilevelSlideOverSetup = (elements, options = {}) => {
    
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

    // Default settings
    const defaults = {
        slideTitles: true,
        slideTitleLink: false,
        backButtonSymbol: '&lsaquo;',
        dynamicBackButtonTitle: false,
        offCanvasCloseAllMenus: false
    };
    
    // Merge defaults with options
    const settings = {...defaults, ...options};
    
    // Process each element
    elements.forEach(element => {
        const mlnDataBreakpoint = (element.getAttribute('data-mln-breakpoint')) ? parseInt(element.getAttribute('data-mln-breakpoint')) : undefined;

        // Function to close all child menus
        const closeAllChildren = () => {
            if (element.classList.contains('mln--navbar-slide-over')) {
                
                // Hide all expanded elements
                const hiddenElements = element.querySelectorAll('[aria-hidden="false"]');
                hiddenElements.forEach(el => {
                    el.setAttribute('aria-hidden', 'true');
                    el.classList.remove('mln--height-auto', 'mln__child--overflow-visible');
                });
                
                // Remove visible menu class
                const visibleMenus = element.querySelectorAll('.mln__visible-menu');
                visibleMenus.forEach(menu => {
                    menu.classList.remove('mln__visible-menu');
                });
                
                // Add visible menu class to main list
                const mainList = element.querySelector('.mln__list');
                if (mainList) {
                    mainList.classList.add('mln__visible-menu');
                }
                
                // Collapse expanded elements
                const expandedElements = element.querySelectorAll('[aria-expanded="true"]');
                expandedElements.forEach(el => {
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
        
        // Set height on certain elements to make the outer nav height the same
        // height as the current viewable slide
        const setDynamicHeight = () => {
            
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
            const backButtonSymbol = settings.backButtonSymbol ? 
                `<span aria-hidden="true">${settings.backButtonSymbol}</span> ` : '';
            
            const isNotLinkable = menuSectionLink.getAttribute('data-mln-not-linkable');
            const useMenuText = isNotLinkable || settings.dynamicBackButtonTitle;
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
            if (settings.slideTitles && !settings.slideTitleLink) {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'mln__slide-over-title';
                titleSpan.innerHTML = menuSectionLabel;
                controlsDiv.appendChild(titleSpan);
            }
            
            // Build slide title with link
            if (settings.slideTitles && settings.slideTitleLink) {
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
                const toggleElement = navEl.querySelector(`.mln__toggle-btn[aria-controls="${currentMenuId}"], .mln__toggle-link[aria-controls="${currentMenuId}"]`);
                
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
                setDynamicHeight();
            }
        });
        
        element.addEventListener('hide.mln.child', () => {
            if (
                (element.classList.contains('mln--navbar-slide-over') && 
                window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches) || 
                mlnDataBreakpoint === undefined
            ) {
                setDynamicHeight();
            }
        });
        
        element.addEventListener('shown.mln.child', () => {
            const showingElements = element.querySelectorAll('.mln__has-child--showing');
            
            if (showingElements.length) {
                const latestNavShowing = showingElements[showingElements.length - 1];
                latestNavShowing.classList.add('mln__has-child--active');
                
                const childCollapse = latestNavShowing.querySelector('.mln__child__collapse');
                
                if (childCollapse) {
                    removeTrapKeyboardHandlers(childCollapse);
                    
                    if (
                        element.classList.contains('mln--navbar-slide-over') &&
                        window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches
                    ) {
                        slideOverKeyboardTrap(childCollapse);
                    }
                }
            }
        });
        
        // Handle off-canvas close if needed
        if (settings.offCanvasCloseAllMenus) {
            const offCanvasToggles = document.querySelectorAll('[data-oc-toggle], [data-oc-close]');
            
            offCanvasToggles.forEach(toggleButton => {
                
                // Use a one-time listener
                const clickHandler = () => {
                    if (toggleButton.getAttribute('aria-expanded') === 'true') {
                        
                        // Listen for hidden.offCanvas event
                        document.addEventListener('hidden.offCanvas', function offCanvasHiddenHandler() {
                            closeAllChildren();
                            document.removeEventListener('hidden.offCanvas', offCanvasHiddenHandler);
                        });
                    }
                };
                
                toggleButton.addEventListener('click', clickHandler);
            });
        }
        
        // Initialize dynamic height
        setDynamicHeight();
        
        // Handle resize events
        window.addEventListener('mlnResizeEnd', () => {
            if (element.classList.contains('mln--navbar-slide-over') && window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches) {
                const childCollapse = element.closest('.l-off-canvas') || element.querySelector('.mln__child__collapse');

                if (childCollapse) {
                    removeTrapKeyboardHandlers(childCollapse);
                }

                element.style.minHeight = '';
            } else {
                setDynamicHeight();
            }
        });
    });
    
    // Return the processed elements for chaining
    return elements;
}

// Helper function to initialize multilevelNavSlideOver on multiple elements
const multilevelNavSlideOver = (selector, options) => {
    const elements = document.querySelectorAll(selector);
    const instances = [];
    
    elements.forEach(element => {
        const instance = multilevelSlideOverSetup(element, options);
        
        if (instance) {
            instances.push(instance);
        }
    });
    
    return instances;
}

// Jquery initialization method using $ or jQuery
if (typeof jQuery !== 'undefined') {
    jQuery.fn.multilevelNavSlideOver = function(options) {
        return this.each(function() {
            multilevelSlideOverSetup(this, options);
        });
    };
}