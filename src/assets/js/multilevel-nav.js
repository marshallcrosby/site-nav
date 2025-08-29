/*!
  * Multilevel nav v4.0.0 Beta
  */

/*
    TODO:
    - Fix focus out of last item in navbar
    - Arrow keys for child menus
    - Fix slide over keyboard trapping if not in a navbar
*/

/* eslint-env es6 */
let mlnCurrent = 1;

// Get browser width with or without scrollbar
const mlnViewport = () => {
    let view = window;
    let viewString = 'inner';

    if (!('innerWidth' in window)) {
        viewString = 'client';
        view = document.documentElement || document.body;
    }

    return {
        width: view[viewString + 'Width'],
        height: view[viewString + 'Height']
    };
}

// Custom event creator helper
const mlnCreateCustomEvent = (name, detail = null) => {
    return new CustomEvent(name, {
        bubbles: true,
        cancelable: true,
        detail: detail
    });
}

// HoverIntent reimplementation (replacing jQuery plugin)
const mlnHoverIntent = (element, options) => {
    const settings = Object.assign({
        sensitivity: 7,
        interval: 100,
        timeout: 0,
        over: () => {},
        out: () => {}
    }, options || {});
    
    let x, y, pX, pY;
    let mouseover = false;
    let timer;
    
    const track = (e) =>{
        x = e.clientX;
        y = e.clientY;
    }
    
    const compare = (e) =>{
        
        // Compare mouse positions to see if mouse has slowed enough
        if (Math.abs(pX - x) + Math.abs(pY - y) < settings.sensitivity) {
            element.removeEventListener('mousemove', track);
            mouseover = true;
            
            if (timer) clearTimeout(timer);
            settings.over.call(element, e);
        } else {
            pX = x;
            pY = y;
            timer = setTimeout(() => compare(e), settings.interval);
        }
    }
    
    const delay = (e) => {
        if (timer) clearTimeout(timer);
        mouseover = false;
        
        if (settings.timeout) {
            timer = setTimeout(() => {
                if (!mouseover) settings.out.call(element, e);
            }, settings.timeout);
        } else {
            settings.out.call(element, e);
        }
    }
    
    const handleMouseOver = (e) => {
        if (timer) clearTimeout(timer);
        
        mouseover = true;
        pX = e.clientX;
        pY = e.clientY;
        
        element.addEventListener('mousemove', track);
        timer = setTimeout(() => compare(e), settings.interval);
    }
    
    const handleMouseOut = (e) =>{
        if (timer) clearTimeout(timer);
        element.removeEventListener('mousemove', track);
        
        if (mouseover) {
            delay(e);
        }
    }
    
    // Attach events
    element.addEventListener('mouseenter', handleMouseOver);
    element.addEventListener('mouseleave', handleMouseOut);
    
    // Return object with cleanup method
    return {
        remove: () => {
            element.removeEventListener('mouseenter', handleMouseOver);
            element.removeEventListener('mouseleave', handleMouseOut);
            element.removeEventListener('mousemove', track);
            if (timer) clearTimeout(timer);
        }
    };
}

// Create resizing event
(() => {
    let windowWidth = window.innerWidth;
    let resizeTO;
    
    window.addEventListener('resize', () => {
        let newWindowWidth = window.innerWidth;
        
        if (windowWidth !== newWindowWidth) {
            if (resizeTO) {
                clearTimeout(resizeTO);
            }
            
            resizeTO = setTimeout(() => {
                window.dispatchEvent(mlnCreateCustomEvent('mlnResizeEnd'));
            }, 150);
        }
        
        windowWidth = newWindowWidth;
    });
})();

// Main multilevel nav function
const multilevelNavSetup = (element, options = {}) => {
    
    if (!element) return;
    
    // Setting defaults
    const settings = Object.assign({
        hoverIntent: false,
        hoverIntentTimeout: 250,
        autoCloseNavbarMenus: true,
        autoDirection: true,
        toggleOnClickOnly: false,
        expandActiveItem: false,
        offCanvasScrollToActiveItem: false,
        wholeLinkToggler: false,
        topLevelWholeLinkToggler: false,
        navbarMenuBackdrop: false,
        navbarMegaMenuBackdrop: false,
        activeSelector: '.active',
        menuCloseOnInPageAnchorClick: false,
        expanderCloseOnInPageAnchorClick: false,
        autoCloseInactiveMenu: true,
        excludeLevel: '-1',
        childMenuTogglerSymbol: '<span class="mln__toggle-btn__chevron"></span>',
        keepMenuOpenOnFocusOut: false
    }, options || {});

    // Element selectors
    const mlnParentList = element.querySelector('.mln__list');
    const mlnExpander = element.querySelector('.mln__expander');
    const mlnDataBreakpoint = (element.getAttribute('data-mln-breakpoint')) ? parseInt(element.getAttribute('data-mln-breakpoint')) : undefined;
    const mlnToggleBtnVerbiage = 'Toggle items under';
    const mlnTransitionEnd = 'transitionend';
    const body = document.body;
    let mlnIsPageLoaded = false;

    // Show/hide menu(s)
    const mlnToggleChild = (el, action, animate) => {
        let mlnHasChild;
        
        // Handle different input types (element, event, or jQuery-like object)
        if (el instanceof Element) {
            mlnHasChild = el.closest('.mln__has-child');
        } else if (el && el.target) {
            mlnHasChild = el.target.closest('.mln__has-child');
        } else if (el && el.closest) {
            mlnHasChild = el.closest('.mln__has-child');
        } else {
            return;
        }
        
        if (!mlnHasChild) return;
        
        const mlnChildToggler = mlnHasChild.querySelector('.mln__toggle-btn, .mln__toggle-link');
        const mlnToggleChildCollapse = mlnHasChild.querySelector(':scope > .mln__child__collapse');
        
        if (!mlnChildToggler || !mlnToggleChildCollapse) return;
        
        let ariaExpandedValue;
        let ariaHiddenValue;
        
        // Figure out what aria values to use
        if (action === 'show') {
            ariaExpandedValue = 'true';
            ariaHiddenValue = 'false';
        } else if (action === 'hide' || action === undefined) {
            ariaExpandedValue = 'false';
            ariaHiddenValue = 'true';
        }
        
        // Trigger transition event
        mlnHasChild.dispatchEvent(mlnCreateCustomEvent('transition.mln.child'));
        
        // Correct toggler attributes
        mlnChildToggler.setAttribute('aria-expanded', ariaExpandedValue);
        
        // Grab height of inner collapse elements
        const collapseHelper = mlnToggleChildCollapse.querySelector('.mln__child__collapse__helper');
        const collapseHeight = collapseHelper ? collapseHelper.offsetHeight : 0;
        
        // Show collapsible child elements
        if (action === 'show') {
            mlnHasChild.classList.add('mln__has-child--showing');
            
            const mlnAnyShowing = element.querySelectorAll('.mln__has-child--showing');
            
            // Add class to body for regular menu backdrop
            if (
                mlnAnyShowing.length && 
                element.classList.contains('mln--navbar') &&
                settings.navbarMenuBackdrop === true
            ) {
                body.classList.add('js-mln-menu-showing');
            }
            
            // Add class to body for mega menu backdrop
            if (
                mlnHasChild.classList.contains('mln__has-child--mega-menu') &&
                element.classList.contains('mln--navbar') &&
                settings.navbarMegaMenuBackdrop === true
            ) {
                body.classList.add('js-mln-mega-menu-showing');
            }
            
            mlnHasChild.dispatchEvent(mlnCreateCustomEvent('show.mln.child'));
            
            if (animate === true) {
                mlnToggleChildCollapse.classList.add('mln__child--transitioning');
                mlnToggleChildCollapse.style.height = collapseHeight + 'px';
                mlnToggleChildCollapse.setAttribute('aria-hidden', ariaHiddenValue);
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnToggleChildCollapse) return;
                    
                    mlnToggleChildCollapse.removeEventListener(mlnTransitionEnd, handleTransitionEnd);
                    mlnToggleChildCollapse.style.height = 'auto';
                    mlnToggleChildCollapse.classList.remove('mln__child--transitioning');
                    mlnToggleChildCollapse.style.height = '';
                    
                    if (mlnToggleChildCollapse.getAttribute('aria-hidden') === 'false') {
                        mlnToggleChildCollapse.classList.add('mln--height-auto');
                        mlnToggleChildCollapse.classList.add('mln__child--overflow-visible');
                    }
                    
                    mlnHasChild.dispatchEvent(mlnCreateCustomEvent('shown.mln.child'));
                    mlnHasChild.dispatchEvent(mlnCreateCustomEvent('transitioned.mln.child'));
                };
                
                mlnToggleChildCollapse.addEventListener(mlnTransitionEnd, handleTransitionEnd);
            } else {
                mlnToggleChildCollapse.style.height = 'auto';
                mlnToggleChildCollapse.classList.add('mln--height-auto');
                mlnToggleChildCollapse.setAttribute('aria-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.style.height = '';
                mlnToggleChildCollapse.classList.add('mln__child--overflow-visible');
                
                mlnHasChild.dispatchEvent(mlnCreateCustomEvent('shown.mln.child'));
                mlnHasChild.dispatchEvent(mlnCreateCustomEvent('transitioned.mln.child'));
            }
        }
        
        // Hide collapsible child elements
        if (action === 'hide') {
            mlnHasChild.classList.remove('mln__has-child--showing');
            
            const mlnAnyShowing = document.querySelectorAll('.mln--navbar .mln__has-child--showing');
            
            if (!mlnAnyShowing.length && document.querySelectorAll('.mln--navbar').length) {
                body.classList.remove('js-mln-menu-showing');
            }
            
            if (
                mlnHasChild.classList.contains('mln__has-child--mega-menu') &&
                !document.querySelector('.mln__has-child--mega-menu.mln__has-child--showing') &&
                element.classList.contains('mln--navbar')
            ) {
                body.classList.remove('js-mln-mega-menu-showing');
            }
            
            mlnHasChild.dispatchEvent(mlnCreateCustomEvent('hide.mln.child'));
            
            if (animate === true) {
                mlnToggleChildCollapse.style.height = collapseHeight + 'px';
                mlnToggleChildCollapse.style.minHeight = collapseHeight + 'px';
                mlnToggleChildCollapse.classList.remove('mln__child--overflow-visible', 'mln--height-auto');
                mlnToggleChildCollapse.setAttribute('aria-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.classList.add('mln__child--transitioning');
                
                // Force a reflow to ensure the initial height is applied before transitioning
                mlnToggleChildCollapse.offsetHeight;
                
                // Set up transition end handler before changing height
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnToggleChildCollapse) return;
                    
                    mlnToggleChildCollapse.removeEventListener(mlnTransitionEnd, handleTransitionEnd);
                    mlnToggleChildCollapse.classList.remove('mln__child--transitioning');
                    mlnHasChild.dispatchEvent(mlnCreateCustomEvent('hidden.mln.child'));
                    mlnHasChild.dispatchEvent(mlnCreateCustomEvent('transitioned.mln.child'));
                };
                
                mlnToggleChildCollapse.addEventListener(mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(mlnToggleChildCollapse.children).forEach(child => {
                    child.addEventListener(mlnTransitionEnd, e => e.stopPropagation());
                });
                
                // Trigger the transition by changing height
                mlnToggleChildCollapse.style.height = '';
                mlnToggleChildCollapse.style.minHeight = '';
            } else {
                mlnToggleChildCollapse.classList.remove('mln__child--overflow-visible', 'mln--height-auto');
                mlnToggleChildCollapse.setAttribute('aria-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.style.height = '';
                
                mlnHasChild.dispatchEvent(mlnCreateCustomEvent('hidden.mln.child'));
                mlnHasChild.dispatchEvent(mlnCreateCustomEvent('transitioned.mln.child'));
            }
        }
    }
    
    // Show/hide expander items
    const mlnToggleExpander = (animate) => {
        if (!mlnExpander) return;
        
        const collapseHelper = mlnExpander.querySelector('.mln__expander__helper');
        
        if (animate !== false && collapseHelper) {
            const collapseHeight = collapseHelper.offsetHeight;
            const expandBtn = element.querySelector('.mln__expand-btn');
            
            if (!mlnExpander.classList.contains('mln__expander--showing')) {
                mlnExpander.dispatchEvent(mlnCreateCustomEvent('showing.mln.expander'));
                
                mlnExpander.classList.add('mln__expander--transitioning');
                mlnExpander.style.height = collapseHeight + 'px';
                mlnExpander.setAttribute('aria-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnExpander) return;
                    
                    mlnExpander.removeEventListener(mlnTransitionEnd, handleTransitionEnd);
                    mlnExpander.style.height = 'auto';
                    mlnExpander.style.height = '';
                    mlnExpander.classList.add('mln__expander--showing');
                    mlnExpander.classList.remove('mln__expander--transitioning');
                    
                    mlnExpander.dispatchEvent(mlnCreateCustomEvent('shown.mln.expander'));
                };
                
                mlnExpander.addEventListener(mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(mlnExpander.children).forEach(child => {
                    child.addEventListener(mlnTransitionEnd, e => e.stopPropagation());
                });
            } else {
                mlnExpander.dispatchEvent(mlnCreateCustomEvent('hiding.mln.expander'));
                
                mlnExpander.classList.add('mln__expander--transitioning');
                mlnExpander.style.height = collapseHeight + 'px';
                mlnExpander.setAttribute('aria-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
                
                setTimeout(() => {
                    mlnExpander.classList.remove('mln__expander--showing');
                    mlnExpander.style.height = '';
                }, 10);
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnExpander) return;
                    
                    mlnExpander.removeEventListener(mlnTransitionEnd, handleTransitionEnd);
                    mlnExpander.classList.remove('mln__expander--transitioning');
                    
                    mlnExpander.dispatchEvent(mlnCreateCustomEvent('hidden.mln.expander'));
                };
                
                mlnExpander.addEventListener(mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(mlnExpander.children).forEach(child => {
                    child.addEventListener(mlnTransitionEnd, e => e.stopPropagation());
                });
            }
        }
        
        // Adjust attributes without animating the expander menu
        if (animate === false && element.closest('.mln--navbar')) {
            const expandBtn = element.querySelector('.mln__expand-btn');
            
            if (window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches) {
                mlnExpander.classList.remove('mln__expander--showing');
                mlnExpander.setAttribute('aria-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
            } else {
                mlnExpander.setAttribute('aria-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
            }
        }
        
        if (animate === false && element.classList.contains('mln--expand-above-breakpoint')) {
            const expandBtn = element.querySelector('.mln__expand-btn');
            
            if (window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches) {
                mlnExpander.classList.remove('mln__expander--showing');
                mlnExpander.setAttribute('aria-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
            } else {
                mlnExpander.classList.add('mln__expander--showing');
                mlnExpander.setAttribute('aria-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
            }
        }
    }
    
    // Assign class to child items that run off the edge of the screen
    const assignFlowDirection = () => {
        if (!settings.autoDirection) return;
        
        setTimeout(() => {
            const hasChildElements = element.querySelectorAll('.mln__has-child');
            
            hasChildElements.forEach(hasChild => {
                const bodyRect = document.body.getBoundingClientRect();
                const elemRect = hasChild.getBoundingClientRect();
                const mlnToggleChildOffset = (elemRect.left - bodyRect.left) + (hasChild.offsetWidth * 2);
                
                if (mlnToggleChildOffset > mlnViewport().width && window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches) {
                    hasChild.classList.add('mln__child--flow-right');
                } else {
                    hasChild.classList.remove('mln__child--flow-right');
                }
            });
        }, 300);
    }
    
    // Keep items and parents with active class expanded on load
    const expandActiveItem = () => {
        if (!settings.expandActiveItem) return;
        
        const activeSelector = settings.activeSelector;
        const activeItems = mlnParentList.querySelectorAll(activeSelector);
        
        activeItems.forEach(activeItem => {
            activeItem.classList.add('mln__has-child--expand-on-load');
            
            // Find all parent .mln__has-child elements and add the expand class
            let parent = activeItem.closest('.mln__has-child');
            while (parent) {
                parent.classList.add('mln__has-child--expand-on-load');
                parent = parent.parentElement.closest('.mln__has-child');
            }
        });
        
        const itemsToExpand = mlnParentList.querySelectorAll('.mln__has-child--expand-on-load');
        
        itemsToExpand.forEach(item => {
            if (
                !mlnIsPageLoaded || 
                (mlnParentList.closest('.mln--navbar') &&
                window.matchMedia(`(max-width: ${mlnDataBreakpoint - 1}px)`).matches &&
                !mlnIsPageLoaded)
            ) {
                mlnToggleChild(item, 'show', false);
            }
            
            if (
                mlnParentList.closest('.mln--navbar') &&
                window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches
            ) {
                mlnToggleChild(item, 'hide', false);
            }
        });
        
        if (settings.offCanvasScrollToActiveItem) {
            const activeItems = element.querySelectorAll(settings.activeSelector);
            const lastActiveItem = activeItems[activeItems.length - 1];
            
            if (lastActiveItem) {
                const scrollToLoc = lastActiveItem.getBoundingClientRect().top;
                const offCanvasArea = document.getElementById('offCanvasArea');
                
                if (offCanvasArea) {
                    offCanvasArea.scrollTo({
                        top: scrollToLoc,
                        behavior: 'auto'
                    });
                }
            }
            
            setTimeout(() => {
                body.classList.add('js-off-canvas-scrolled');
            }, 2);
        }
        
        mlnIsPageLoaded = true;
    }
    
    // Start modifying the DOM - only proceed if we have the parent list
    if (!mlnParentList) return;
    
    // Add helper div inside expander
    if (mlnExpander) {

        // Create helper div
        const helperDiv = document.createElement('div');
        helperDiv.classList.add('mln__expander__helper');
        
        // Move all children to the helper div instead of replacing innerHTML
        while (mlnExpander.firstChild) {
            helperDiv.appendChild(mlnExpander.firstChild);
        }
        
        // Append the helper div to the expander
        mlnExpander.appendChild(helperDiv);
    }
    
    // Open/close menu expander
    const expanderButton = element.querySelector('.mln__expand-btn');
    if (expanderButton) {
        expanderButton.addEventListener('click', () => {
            mlnToggleExpander();
        });
    }
    
    // Add depth class to nested list items
    const nestedLi = mlnParentList.querySelectorAll('li:not(.mln__child__mega-menu li)');
    nestedLi.forEach(li => {
        
        // Count parent li elements to determine level
        let level = 1;
        let parent = li.parentElement;
        
        while (parent && parent !== mlnParentList) {
            if (parent.nodeName === 'LI') {
                level++;
            }
            parent = parent.parentElement;
        }
        
        li.classList.add('mln__level-' + level);
    });
    
    // Find and modify mega menus
    const megaMenus = mlnParentList.querySelectorAll('.mln__child__mega-menu');
    megaMenus.forEach(megaMenu => {
        const collapseDiv = document.createElement('div');
        collapseDiv.classList.add('mln__child__collapse');
        collapseDiv.setAttribute('tabindex', '-1');
        
        const helperDiv = document.createElement('div');
        helperDiv.classList.add('mln__child__collapse__helper');
        
        // Insert the wrapper structure before the mega menu
        megaMenu.parentNode.insertBefore(collapseDiv, megaMenu);
        collapseDiv.appendChild(helperDiv);
        helperDiv.appendChild(megaMenu);
        
        // Find closest li and add the has-child class
        const parentLi = collapseDiv.closest('li');
        if (parentLi) {
            parentLi.classList.add('mln__has-child');
        }
    });
    
    // Add mega menu backdrop
    if (settings.navbarMegaMenuBackdrop && !document.querySelector('.mln-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.classList.add('mln-backdrop');
        body.appendChild(backdrop);
    }
    
    // Find and modify child lists
    const excludedSelector = `.mln__level-${settings.excludeLevel} > ul, .mln__level-${settings.excludeLevel} > ul ul`;
    const childLists = Array.from(mlnParentList.querySelectorAll('ul'));
    const excludedLists = Array.from(mlnParentList.querySelectorAll(excludedSelector));
    
    // Filter out excluded lists
    const listsToProcess = childLists.filter(list => !excludedLists.includes(list));
   
    listsToProcess.forEach(parentList => {
        const existingCollapse = parentList.parentNode.querySelector('.mln__child__collapse');
        
        if (existingCollapse) {
            
            // If there's already a collapse element, move the list to its helper
            const parentCollapse = parentList.parentNode.querySelector('.mln__child__collapse__helper');
            
            if (parentCollapse) {
                parentList.classList.add('mln__child__list');
                parentCollapse.insertBefore(parentList, parentCollapse.firstChild);
            }
        } else if (!parentList.closest('.mln__child__mega-menu')) {
            
            // Create new collapse structure
            parentList.classList.add('mln__child__list');
            
            const collapseDiv = document.createElement('div');
            collapseDiv.classList.add('mln__child__collapse');
            collapseDiv.setAttribute('tabindex', '-1');
            
            const helperDiv = document.createElement('div');
            helperDiv.classList.add('mln__child__collapse__helper');
            
            // Insert the wrapper structure before the list
            parentList.parentNode.insertBefore(collapseDiv, parentList);
            collapseDiv.appendChild(helperDiv);
            helperDiv.appendChild(parentList);
            
            // Find closest li and add the has-child class
            const parentLi = collapseDiv.closest('li');
            if (parentLi) {
                parentLi.classList.add('mln__has-child');
            }
        }
    });
    
    // Add mega menu modifier class to top level
    const megaMenuElements = mlnParentList.querySelectorAll('.mln__child__mega-menu');
    megaMenuElements.forEach(megaMenu => {
        const closestLi = megaMenu.closest('li');
        if (closestLi) {
            closestLi.classList.add('mln__has-child--mega-menu');
        }
    });
    
    // Wrap the parent <a> tag in it's own div
    const hasChildElements = mlnParentList.querySelectorAll('.mln__has-child');
    hasChildElements.forEach(hasChild => {
        const directLink = Array.from(hasChild.children).find(child => 
            child.tagName === 'A'
        );
        
        if (directLink) {
            const controlsDiv = document.createElement('div');
            controlsDiv.classList.add('mln__child-controls');
            
            // Insert wrapper before the link
            directLink.parentNode.insertBefore(controlsDiv, directLink);
            
            // Move link into wrapper
            controlsDiv.appendChild(directLink);
        }
    });
    
    // Add a toggle button to list items with children
    const childNavControls = mlnParentList.querySelectorAll('.mln__child-controls');
    childNavControls.forEach(control => {
        const parentLink = control.querySelector('a');
        
        if (parentLink) {
            const linkText = parentLink.textContent.trim();
            const ariaLabelValue = mlnToggleBtnVerbiage + ' ' + linkText;
            
            const toggleBtn = document.createElement('button');
            toggleBtn.classList.add('mln__toggle-btn');
            toggleBtn.setAttribute('type', 'button');
            toggleBtn.setAttribute('aria-label', ariaLabelValue);
            toggleBtn.innerHTML = settings.childMenuTogglerSymbol;
            
            control.appendChild(toggleBtn);
        }
    });
    
    // Assign IDs and attributes to child menu elements
    const childCollapse = mlnParentList.querySelectorAll('.mln__child__collapse');
    childCollapse.forEach((collapse, index) => {
        const childCollapseId = 'mln' + mlnCurrent + 'ChildCollapse' + (index + 1);
        
        collapse.setAttribute('aria-hidden', 'true');
        collapse.setAttribute('data-mln-active-status', 'off');
        collapse.setAttribute('id', childCollapseId);
        
        const parentLi = collapse.closest('li');
        if (parentLi) {
            const toggleBtn = parentLi.querySelector('.mln__toggle-btn');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.setAttribute('aria-controls', childCollapseId);
            }
        }
    });
    
    // Assign IDs and aria attributes to expander elements
    if (mlnExpander) {
        const mlnExpanderId = 'mln' + mlnCurrent + 'Expander1';
        
        mlnExpander.setAttribute('aria-hidden', 'true');
        mlnExpander.setAttribute('id', mlnExpanderId);
        
        const expandBtn = element.querySelector('.mln__expand-btn');
        if (expandBtn) {
            expandBtn.setAttribute('aria-expanded', 'false');
            expandBtn.setAttribute('aria-controls', mlnExpanderId);
        }
    }
    
    // Close main nav child menu if in page anchor is clicked
    if (settings.menuCloseOnInPageAnchorClick) {
        const anchors = element.querySelectorAll('a');
        
        anchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            
            if (!href) return;
            
            const firstChar = href.charAt(0);
            const isPageAnchor = (firstChar === '#');
            
            anchor.addEventListener('click', (e) => {
                if (
                    isPageAnchor &&
                    !e.target.closest('.mln__toggle-link') &&
                    window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches
                ) {
                    const showingMenus = element.querySelectorAll('.mln__has-child--showing');
                    showingMenus.forEach(menu => {
                        mlnToggleChild(menu, 'hide', true);
                    });
                }
            });
        });
    }
    
    // Close expander if in page anchor is clicked
    if (settings.expanderCloseOnInPageAnchorClick) {
        const anchors = element.querySelectorAll('a');
        
        anchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            
            if (!href) return;
            
            const firstChar = href.charAt(0);
            const isPageAnchor = (firstChar === '#');
            
            anchor.addEventListener('click', (e) => {
                if (
                    isPageAnchor &&
                    !e.target.closest('.mln__toggle-link')
                ) {
                    mlnToggleExpander('hide');
                }
            });
        });
    }
    
    // Whole link click expand and/or top level whole link expand
    if (settings.wholeLinkToggler || settings.topLevelWholeLinkToggler) {
        let wholeElements = [];
        
        if (settings.wholeLinkToggler) {
            wholeElements = Array.from(mlnParentList.querySelectorAll('.mln__child-controls > a'));
            element.classList.add('mln--whole-link-expand');
        }
        
        if (settings.topLevelWholeLinkToggler) {
            
            // Select only the direct children of mlnParentList that are .mln__has-child
            const topLevelItems = Array.from(mlnParentList.children)
                .filter(child => child.classList.contains('mln__has-child'));
            
            wholeElements = topLevelItems
                .map(item => item.querySelector('.mln__child-controls > a'))
                .filter(Boolean);
            
            element.classList.remove('mln--whole-link-expand');
            element.classList.add('mln--top-level-whole-link-expand');
        }
        
        wholeElements.forEach(wholeElement => {
            const closestHasChild = wholeElement.closest('.mln__has-child');
            const closestToggleBtn = closestHasChild.querySelector('.mln__toggle-btn');
            
            if (!closestToggleBtn) return;
            
            const ariaExpandedValue = closestToggleBtn.getAttribute('aria-expanded');
            const ariaControlsValue = closestToggleBtn.getAttribute('aria-controls');
            
            const toggleIndicator = document.createElement('span');
            toggleIndicator.classList.add('mln__toggle-indicator');
            toggleIndicator.innerHTML = settings.childMenuTogglerSymbol;
            wholeElement.appendChild(toggleIndicator);
            
            wholeElement.classList.add('mln__toggle-link');
            wholeElement.setAttribute('role', 'button');
            wholeElement.setAttribute('aria-expanded', ariaExpandedValue);
            wholeElement.setAttribute('aria-controls', ariaControlsValue);
            
            wholeElement.addEventListener('click', (e) => {
                wholeElement.focus();
                e.preventDefault();
            });
            
            // Remove the original toggle button
            closestToggleBtn.remove();
        });
    }
    
    // Toggle-button click
    const toggleButtons = mlnParentList.querySelectorAll('.mln__toggle-btn, .mln__toggle-link');
    let touchDrag = false;
    
    // Add touchmove listener for iOS fix
    toggleButtons.forEach(button => {
        button.addEventListener('touchmove', () => {
            touchDrag = true;
        }, { passive: true });
    });
    
    // Handle click and touch events
    toggleButtons.forEach(button => {
        const handleInteraction = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const hasChildParent = button.closest('.mln__has-child');
            if (!hasChildParent) return;
            
            const associatedMenu = hasChildParent.querySelector('.mln__child__collapse');
            if (!associatedMenu) return;
            
            // Find sibling elements that are showing
            const siblingShowing = Array.from(
                hasChildParent.parentElement.querySelectorAll('.mln__has-child--showing')
            ).filter(el => el !== hasChildParent);
            
            if (
                (e.type === 'click' || e.type === 'touchend') &&
                !touchDrag &&
                !element.querySelector('.mln__has-child--showing.mln__child--transitioning')
            ) {
                if (
                    window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                    settings.autoCloseNavbarMenus === true &&
                    !button.closest('.mln--expand-above-breakpoint') &&
                    button.closest('.mln--navbar')
                ) {
                    associatedMenu.setAttribute('data-mln-active-status', 'off');
                    siblingShowing.forEach(sibling => {
                        mlnToggleChild(sibling, 'hide', true);
                    });
                }
                
                if (hasChildParent.classList.contains('mln__has-child--showing')) {
                    mlnToggleChild(button, 'hide', true);
                    associatedMenu.setAttribute('data-mln-active-status', 'off');
                } else {
                    mlnToggleChild(button, 'show', true);
                    associatedMenu.setAttribute('data-mln-active-status', 'on');
                }
            }
            
            touchDrag = false;
        };
        
        button.addEventListener('touchend', handleInteraction);
        button.addEventListener('click', handleInteraction);
    });
    
    // Show/hide child menus with hoverIntent or just regular hover
    if (!settings.toggleOnClickOnly) {
        hasChildElements.forEach(hasChild => {
            const associatedMenu = hasChild.querySelector('.mln__child__collapse');
            
            // Hover functions
            const showMenu = () => {
                if (associatedMenu) {
                    associatedMenu.setAttribute('data-mln-active-status', 'on');
                }
                
                if (
                    window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                    hasChild.closest('.mln--navbar')
                ) {
                    mlnToggleChild(hasChild, 'show', true);
                }
            };
            
            const hideMenu = () => {
                if (associatedMenu) {
                    associatedMenu.setAttribute('data-mln-active-status', 'off');
                }
                
                if (
                    window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                    associatedMenu && 
                    associatedMenu.getAttribute('aria-hidden') === 'false' &&
                    hasChild.closest('.mln--navbar')
                ) {
                    mlnToggleChild(hasChild, 'hide', true);
                }
            };
            
            if (settings.hoverIntent) {
                
                // Use hoverIntent implementation
                mlnHoverIntent(hasChild, {
                    over: showMenu,
                    timeout: settings.hoverIntentTimeout,
                    out: hideMenu
                });
            } else {
                
                // Use standard hover events
                hasChild.addEventListener('mouseenter', () => {
                    if (
                        window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                        hasChild.closest('.mln--navbar')
                    ) {
                        if (hasChild.classList.contains('mln__has-child--showing')) {
                            if (associatedMenu) {
                                associatedMenu.setAttribute('data-mln-active-status', 'off');
                            }
                            mlnToggleChild(hasChild, 'hide', true);
                        } else {
                            if (associatedMenu) {
                                associatedMenu.setAttribute('data-mln-active-status', 'on');
                            }
                            mlnToggleChild(hasChild, 'show', true);
                        }
                    }
                });
                
                hasChild.addEventListener('mouseleave', () => {
                    if (
                        window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                        hasChild.closest('.mln--navbar')
                    ) {
                        if (associatedMenu) {
                            associatedMenu.setAttribute('data-mln-active-status', 'off');
                        }
                        mlnToggleChild(hasChild, 'hide', true);
                    }
                });
            }
        });
    }
    
    // Keyboarding
    if (mlnParentList) {
        let isCurrentMenuFocused;
        
        mlnParentList.addEventListener('keydown', (e) => {
            const pressedKeyCode = e.keyCode;
            const eTarget = e.target;
            
            // Escape key pressed (keyCode 27)
            if (pressedKeyCode === 27) {
                const associatedMenu = eTarget.closest('.mln__has-child--showing');
                
                if (associatedMenu) {
                    
                    // Find and focus the toggle button
                    const toggleButton = associatedMenu.querySelector('.mln__toggle-btn, .mln__toggle-link');
                    
                    if (toggleButton) {
                        toggleButton.focus();
                    }
                    
                    // Hide the menu
                    mlnToggleChild(associatedMenu, 'hide', true);
                }
            }
            
            // Tab key pressed (keyCode 9)
            if (
                pressedKeyCode === 9 &&
                eTarget.getAttribute('aria-expanded') === 'false' &&
                eTarget.parentNode.nextElementSibling &&
                eTarget.parentNode.nextElementSibling.classList.contains('mln__child__collapse') &&
                eTarget.parentNode.nextElementSibling.classList.contains('mln__child--transitioning')
            ) {
                
                // Find the next focusable anchor
                let nextFocusableAnchor = null;
                const nextItem = eTarget.closest('.mln__has-child').nextElementSibling;
                
                if (nextItem) {
                    nextFocusableAnchor = nextItem.querySelector('a');
                }
                
                if (!nextFocusableAnchor) {
                    const nextTopLevel = eTarget.closest('.mln__level-1').nextElementSibling;
                    
                    if (nextTopLevel) {
                        nextFocusableAnchor = nextTopLevel.querySelector('a');
                    }
                    
                    // Close all showing menus
                    const showingItems = element.querySelectorAll('.mln__has-child--showing');
                    showingItems.forEach(item => {
                        mlnToggleChild(item, 'hide', true);
                    });
                }
                
                if (nextFocusableAnchor) {
                    e.preventDefault();
                    nextFocusableAnchor.focus();
                }
            }
        });
        
        // Close inactive menus when tabbing out of them
        mlnParentList.addEventListener('keyup', (e) => {
            const eTarget = e.target;
            
            if (
                !eTarget.closest('.mln__has-child--showing') &&
                window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                settings.autoCloseInactiveMenu === true &&
                eTarget.closest('.mln--navbar')
            ) {
                const showingItems = element.querySelectorAll('.mln__has-child--showing');
                showingItems.forEach(item => {
                    mlnToggleChild(item, 'hide', true);
                });
            }
        });
        
        // Close any menu when leaving currently focused menu parent
        if (!settings.keepMenuOpenOnFocusOut) {
            mlnParentList.addEventListener('focusout', (e) => {
                setTimeout(() => {
                    if (window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches) {
                        const activeElement = document.activeElement;
                        const nonActiveMenus = Array.from(document.querySelectorAll('.mln--navbar')).filter(
                            menu => !menu.contains(activeElement)
                        );
                        
                        nonActiveMenus.forEach(menu => {
                            const showingItems = menu.querySelectorAll('.mln__has-child--showing');
                            showingItems.forEach(item => {
                                mlnToggleChild(item, 'hide', true);
                            });
                        });
                    }
                    
                    isCurrentMenuFocused = 
                        document.activeElement.closest('.mln--navbar') && 
                        document.activeElement.closest('.mln__list') ? true : false;

                    if (
                        !isCurrentMenuFocused &&
                        window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
                        e.type !== 'keydown' &&
                        settings.autoCloseNavbarMenus === true &&
                        e.target.closest('.mln--navbar') &&
                        !document.activeElement.closest('.mln__has-child--showing')
                    ) {
                        const showingItems = element.querySelectorAll('.mln__has-child--showing');
                        showingItems.forEach(item => {
                            mlnToggleChild(item, 'hide', true);
                        });
                    }
                }, 150);
            });
        }
    }
    
    // Add special class to the current showing menu
    element.addEventListener('transition.mln.child', () => {
        const visibleMenus = element.querySelectorAll('.mln__visible-menu');
        visibleMenus.forEach(menu => menu.classList.remove('mln__visible-menu'));
    });
    
    // Add event listeners for show/hide/initialize events
    ['hide.mln.child', 'show.mln.child'].forEach(eventName => {
        element.addEventListener(eventName, () => {
            updateVisibleMenu();
        });
    });
    
    const updateVisibleMenu = () => {
        const showingItems = element.querySelectorAll('.mln__has-child--showing');
        
        if (showingItems.length === 0) {
            const mainList = element.querySelector('.mln__list');
            if (mainList) {
                mainList.classList.add('mln__visible-menu');
            }
        } else {
            const lastShowing = showingItems[showingItems.length - 1];
            if (lastShowing) {
                lastShowing.classList.add('mln__visible-menu');
            }
        }
    }
    
    // Handle resize end events
    window.addEventListener('mlnResizeEnd', () => {
        if (
            window.matchMedia(`(min-width: ${mlnDataBreakpoint}px)`).matches &&
            settings.autoCloseNavbarMenus === true &&
            settings.expandActiveItem === false
        ) {
            const showingItems = element.querySelectorAll('.mln__has-child--showing');
            showingItems.forEach(item => {
                mlnToggleChild(item, 'hide', false);
            });
            
            if (mlnExpander) {
                mlnExpander.style.height = '';
                mlnExpander.classList.remove('mln__expander--showing');
            }
        }
        
        // Run functions after resize
        expandActiveItem();
        mlnToggleExpander(false);
        assignFlowDirection();
    });
    
    // Run functions on load
    expandActiveItem();
    mlnToggleExpander(false);
    assignFlowDirection();
    
    // Add loaded class
    element.classList.add('mln--js-loaded');
    
    // Trigger initialized event
    element.dispatchEvent(mlnCreateCustomEvent('initialized.mln'));
    updateVisibleMenu();
    mlnCurrent++;
    
    // Return API for programmatic control
    return {
        element: element,
        toggleChild: mlnToggleChild,
        toggleExpander: mlnToggleExpander,
        assignFlowDirection: assignFlowDirection,
        expandActiveItem: expandActiveItem
    };
}

// Helper function to initialize multilevelNav on multiple elements
const multilevelNav = (selector, options) => {
    const elements = document.querySelectorAll(selector);
    const instances = [];
    
    elements.forEach(element => {
        const instance = multilevelNavSetup(element, options);
        if (instance) {
            instances.push(instance);
        }
    });
    
    return instances;
}

// Jquery initialization method using $ or jQuery
if (typeof jQuery !== 'undefined') {
    jQuery.fn.multilevelNav = function(options) {
        return this.each(function() {
            multilevelNavSetup(this, options);
        });
    };
}