/*!
  * Multilevel nav v4.0.0 Beta
  */

/*
    TODO:
    - Fix focus out of last item in navbar
    - Arrow keys for child menus
    - Fix slide over keyboard trapping if not in a navbar
*/

let mlnCurrent = 1;
class MultilevelNav {
    
    // Get browser width with or without scrollbar
    static viewport() {
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
    static createCustomEvent(name, detail = null) {
        return new CustomEvent(name, {
            bubbles: true,
            cancelable: true,
            detail: detail
        });
    }

    // HoverIntent implementation (replacing jQuery plugin)
    static hoverIntent(element, options) {
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
        
        const track = (e) => {
            x = e.clientX;
            y = e.clientY;
        }
        
        const compare = (e) => {
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
        
        const handleMouseOut = (e) => {
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

    // Constructor for MultilevelNav
    constructor(element, options = {}) {
        if (!element) return;
        
        // Store element reference
        this.element = element;
        
        // Setting defaults
        this.settings = Object.assign({
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
        this.mlnParentList = element.querySelector('.mln__list');
        this.mlnExpander = element.querySelector('.mln__expander');
        this.mlnDataBreakpoint = (element.getAttribute('data-mln-breakpoint')) ? parseInt(element.getAttribute('data-mln-breakpoint')) : undefined;
        this.mlnToggleBtnVerbiage = 'Toggle items under';
        this.mlnTransitionEnd = 'transitionend';
        this.body = document.body;
        this.mlnIsPageLoaded = false;
        this.touchDrag = false;
        this.isCurrentMenuFocused = false;
        
        // Setup resize event if it hasn't been set up yet
        if (!window.mlnResizeEventSet) {
            this.setupResizeEvent();
            window.mlnResizeEventSet = true;
        }
        
        // Initialize the navigation
        this.init();
    }
    
    // Sets up the resize event for the window
    setupResizeEvent() {
        let windowWidth = window.innerWidth;
        let resizeTO;
        
        window.addEventListener('resize', () => {
            let newWindowWidth = window.innerWidth;
            
            if (windowWidth !== newWindowWidth) {
                if (resizeTO) {
                    clearTimeout(resizeTO);
                }
                
                resizeTO = setTimeout(() => {
                    window.dispatchEvent(MultilevelNav.createCustomEvent('mlnResizeEnd'));
                }, 150);
            }
            
            windowWidth = newWindowWidth;
        });
    }
    
    // Initialize all navigation components
    init() {
        if (!this.mlnParentList) return;
        
        // Setup expander and add helper divs
        this.setupExpander();
        
        // Add depth classes to list items
        this.setupDepthClasses();
        
        // Set up mega menus
        this.setupMegaMenus();

        // Add mega menu modifier class to top level
        this.setupMegaMenuModifier();

        // Set up child lists
        this.setupChildLists();
        
        // Wrap the parent links in their own div
        this.wrapParentLinks();
        
        // Add toggle buttons to list items with children
        this.addToggleButtons();
        
        // Assign IDs and ARIA attributes
        this.assignIdsAndAria();
        
        // Handle in-page anchor clicks
        this.setupCloseOnAnchorClick();
        
        // Set up whole link expansion if needed
        this.setupWholeLinkExpand();
        
        // Set up button click events
        this.setupToggleButtonEvents();
        
        // Set up hover events if needed
        this.setupHoverEvents();
        
        // Set up keyboard navigation
        this.setupKeyboardNavigation();
        
        // Set up transition events
        this.setupTransitionEvents();
        
        // Setup resize handlers
        this.setupResizeHandlers();
        
        // Perform initial actions
        this.expandActiveItem();
        this.toggleExpander(false);
        this.assignFlowDirection();
        
        // Add loaded class
        this.element.classList.add('mln--js-loaded');
        
        // Trigger initialized event
        this.element.dispatchEvent(MultilevelNav.createCustomEvent('initialized.mln'));
        this.updateVisibleMenu();
        mlnCurrent++;
    }
    
    // Setup expander and add helper divs
    setupExpander() {
        if (this.mlnExpander) {
            // Create helper div
            const helperDiv = document.createElement('div');
            helperDiv.classList.add('mln__expander__helper');
            
            // Move all children to the helper div instead of replacing innerHTML
            while (this.mlnExpander.firstChild) {
                helperDiv.appendChild(this.mlnExpander.firstChild);
            }
            
            // Append the helper div to the expander
            this.mlnExpander.appendChild(helperDiv);
            
            // Set up expand button click handler
            const expanderButton = this.element.querySelector('.mln__expand-btn');
            if (expanderButton) {
                expanderButton.addEventListener('click', () => {
                    this.toggleExpander();
                });
            }
        }
    }
    
    // Add depth class to nested list items
    setupDepthClasses() {
        const nestedLi = this.mlnParentList.querySelectorAll('li:not(.mln__child__mega-menu li)');
        nestedLi.forEach(li => {
            // Count parent li elements to determine level
            let level = 1;
            let parent = li.parentElement;
            
            while (parent && parent !== this.mlnParentList) {
                if (parent.nodeName === 'LI') {
                    level++;
                }
                parent = parent.parentElement;
            }
            
            li.classList.add('mln__level-' + level);
        });
    }
    
    // Find and modify mega menus
    setupMegaMenus() {
        const megaMenus = this.mlnParentList.querySelectorAll('.mln__child__mega-menu');
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
        if (this.settings.navbarMegaMenuBackdrop && !document.querySelector('.mln-backdrop')) {
            const backdrop = document.createElement('div');
            backdrop.classList.add('mln-backdrop');
            this.body.appendChild(backdrop);
        }
    }
    
    // Find and modify child lists
    setupChildLists() {
        const excludedSelector = `.mln__level-${this.settings.excludeLevel} > ul, .mln__level-${this.settings.excludeLevel} > ul ul`;
        const childLists = Array.from(this.mlnParentList.querySelectorAll('ul'));
        const excludedLists = Array.from(this.mlnParentList.querySelectorAll(excludedSelector));
        
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
    }
    
    // Add mega menu modifier class to top level
    setupMegaMenuModifier() {
        const megaMenuElements = this.mlnParentList.querySelectorAll('.mln__child__mega-menu');
        megaMenuElements.forEach(megaMenu => {
            const closestLi = megaMenu.closest('li');
            if (closestLi) {
                closestLi.classList.add('mln__has-child--mega-menu');
            }
        });
    }
    
    // Wrap the parent <a> tag in its own div
    wrapParentLinks() {
        const hasChildElements = this.mlnParentList.querySelectorAll('.mln__has-child');
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
    }
    
    // Add a toggle button to list items with children
    addToggleButtons() {
        const childNavControls = this.mlnParentList.querySelectorAll('.mln__child-controls');
        childNavControls.forEach(control => {
            const parentLink = control.querySelector('a');
            
            if (parentLink) {
                const linkText = parentLink.textContent.trim();
                const ariaLabelValue = this.mlnToggleBtnVerbiage + ' ' + linkText;
                
                const toggleBtn = document.createElement('button');
                toggleBtn.classList.add('mln__toggle-btn');
                toggleBtn.setAttribute('type', 'button');
                toggleBtn.setAttribute('aria-label', ariaLabelValue);
                toggleBtn.innerHTML = this.settings.childMenuTogglerSymbol;
                
                control.appendChild(toggleBtn);
            }
        });
    }
    
    // Assign IDs and attributes to child menu elements
    assignIdsAndAria() {
        
        // Assign IDs and attributes to child collapse elements
        const childCollapse = this.mlnParentList.querySelectorAll('.mln__child__collapse');
        childCollapse.forEach((collapse, index) => {
            const childCollapseId = 'mln' + mlnCurrent + 'ChildCollapse' + (index + 1);
            
            collapse.setAttribute('data-mln-hidden', 'true');
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
        if (this.mlnExpander) {
            const mlnExpanderId = 'mln' + mlnCurrent + 'Expander1';
            
            this.mlnExpander.setAttribute('data-mln-hidden', 'true');
            this.mlnExpander.setAttribute('id', mlnExpanderId);
            
            const expandBtn = this.element.querySelector('.mln__expand-btn');
            if (expandBtn) {
                expandBtn.setAttribute('aria-expanded', 'false');
                expandBtn.setAttribute('aria-controls', mlnExpanderId);
            }
        }
    }
    
    // Setup handlers for in-page anchor clicks
    setupCloseOnAnchorClick() {
        // Close main nav child menu if in-page anchor is clicked
        if (this.settings.menuCloseOnInPageAnchorClick) {
            const anchors = this.element.querySelectorAll('a');
            
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                
                if (!href) return;
                
                const firstChar = href.charAt(0);
                const isPageAnchor = (firstChar === '#');
                
                anchor.addEventListener('click', (e) => {
                    if (
                        isPageAnchor &&
                        !e.target.closest('.mln__toggle-link') &&
                        window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches
                    ) {
                        const showingMenus = this.element.querySelectorAll('.mln__has-child--showing');
                        showingMenus.forEach(menu => {
                            this.toggleChild(menu, 'hide', true);
                        });
                    }
                });
            });
        }
        
        // Close expander if in-page anchor is clicked
        if (this.settings.expanderCloseOnInPageAnchorClick) {
            const anchors = this.element.querySelectorAll('a');
            
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
                        this.toggleExpander('hide');
                    }
                });
            });
        }
    }
    
    // Set up whole link click expansion if needed
    setupWholeLinkExpand() {
        if (!this.settings.wholeLinkToggler && !this.settings.topLevelWholeLinkToggler) {
            return;
        }
        
        let wholeElements = [];
        
        if (this.settings.wholeLinkToggler) {
            wholeElements = Array.from(this.mlnParentList.querySelectorAll('.mln__child-controls > a'));
            this.element.classList.add('mln--whole-link-expand');
        }
        
        if (this.settings.topLevelWholeLinkToggler) {
            // Select only the direct children of mlnParentList that are .mln__has-child
            const topLevelItems = Array.from(this.mlnParentList.children)
                .filter(child => child.classList.contains('mln__has-child'));
            
            wholeElements = topLevelItems
                .map(item => item.querySelector('.mln__child-controls > a'))
                .filter(Boolean);
            
            this.element.classList.remove('mln--whole-link-expand');
            this.element.classList.add('mln--top-level-whole-link-expand');
        }
        
        wholeElements.forEach(wholeElement => {
            const closestHasChild = wholeElement.closest('.mln__has-child');
            const closestToggleBtn = closestHasChild.querySelector('.mln__toggle-btn');
            
            if (!closestToggleBtn) return;
            
            const ariaExpandedValue = closestToggleBtn.getAttribute('aria-expanded');
            const ariaControlsValue = closestToggleBtn.getAttribute('aria-controls');
            
            const toggleIndicator = document.createElement('span');
            toggleIndicator.classList.add('mln__toggle-indicator');
            toggleIndicator.innerHTML = this.settings.childMenuTogglerSymbol;
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
    
    // Set up toggle button click events
    setupToggleButtonEvents() {
        const toggleButtons = this.mlnParentList.querySelectorAll('.mln__toggle-btn, .mln__toggle-link');
        this.touchDrag = false;
        
        // Add touchmove listener for iOS fix
        toggleButtons.forEach(button => {
            button.addEventListener('touchmove', () => {
                this.touchDrag = true;
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
                    !this.touchDrag &&
                    !this.element.querySelector('.mln__has-child--showing.mln__child--transitioning')
                ) {
                    if (
                        window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                        this.settings.autoCloseNavbarMenus === true &&
                        !button.closest('.mln--expand-above-breakpoint') &&
                        button.closest('.mln--navbar')
                    ) {
                        associatedMenu.setAttribute('data-mln-active-status', 'off');
                        siblingShowing.forEach(sibling => {
                            this.toggleChild(sibling, 'hide', true);
                        });
                    }
                    
                    if (hasChildParent.classList.contains('mln__has-child--showing')) {
                        this.toggleChild(button, 'hide', true);
                        associatedMenu.setAttribute('data-mln-active-status', 'off');
                    } else {
                        this.toggleChild(button, 'show', true);
                        associatedMenu.setAttribute('data-mln-active-status', 'on');
                    }
                }
                
                this.touchDrag = false;
            };
            
            button.addEventListener('touchend', handleInteraction);
            button.addEventListener('click', handleInteraction);
        });
    }
    
    // Set up hover events if needed
    setupHoverEvents() {
        if (this.settings.toggleOnClickOnly) {
            return;
        }
        
        const hasChildElements = this.mlnParentList.querySelectorAll('.mln__has-child');
        
        hasChildElements.forEach(hasChild => {
            const associatedMenu = hasChild.querySelector('.mln__child__collapse');
            
            // Hover functions
            const showMenu = () => {
                if (associatedMenu) {
                    associatedMenu.setAttribute('data-mln-active-status', 'on');
                }
                
                if (
                    window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                    hasChild.closest('.mln--navbar')
                ) {
                    this.toggleChild(hasChild, 'show', true);
                }
            };
            
            const hideMenu = () => {
                if (associatedMenu) {
                    associatedMenu.setAttribute('data-mln-active-status', 'off');
                }
                
                if (
                    window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                    associatedMenu && 
                    associatedMenu.getAttribute('data-mln-hidden') === 'false' &&
                    hasChild.closest('.mln--navbar')
                ) {
                    this.toggleChild(hasChild, 'hide', true);
                }
            };
            
            if (this.settings.hoverIntent) {
                // Use hoverIntent implementation
                MultilevelNav.hoverIntent(hasChild, {
                    over: showMenu,
                    timeout: this.settings.hoverIntentTimeout,
                    out: hideMenu
                });
            } else {
                // Use standard hover events
                hasChild.addEventListener('mouseenter', () => {
                    if (
                        window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                        hasChild.closest('.mln--navbar')
                    ) {
                        if (hasChild.classList.contains('mln__has-child--showing')) {
                            if (associatedMenu) {
                                associatedMenu.setAttribute('data-mln-active-status', 'off');
                            }
                            this.toggleChild(hasChild, 'hide', true);
                        } else {
                            if (associatedMenu) {
                                associatedMenu.setAttribute('data-mln-active-status', 'on');
                            }
                            this.toggleChild(hasChild, 'show', true);
                        }
                    }
                });
                
                hasChild.addEventListener('mouseleave', () => {
                    if (
                        window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                        hasChild.closest('.mln--navbar')
                    ) {
                        if (associatedMenu) {
                            associatedMenu.setAttribute('data-mln-active-status', 'off');
                        }
                        this.toggleChild(hasChild, 'hide', true);
                    }
                });
            }
        });
    }
    
    // Set up keyboard navigation
    setupKeyboardNavigation() {
        if (!this.mlnParentList) return;
        
        this.isCurrentMenuFocused = false;
        
        this.mlnParentList.addEventListener('keydown', (e) => {
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
                    this.toggleChild(associatedMenu, 'hide', true);
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
                    const showingItems = this.element.querySelectorAll('.mln__has-child--showing');
                    showingItems.forEach(item => {
                        this.toggleChild(item, 'hide', true);
                    });
                }
                
                if (nextFocusableAnchor) {
                    e.preventDefault();
                    nextFocusableAnchor.focus();
                }
            }
        });
        
        // Close inactive menus when tabbing out of them
        this.mlnParentList.addEventListener('keyup', (e) => {
            const eTarget = e.target;
            
            if (
                !eTarget.closest('.mln__has-child--showing') &&
                window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                this.settings.autoCloseInactiveMenu === true &&
                eTarget.closest('.mln--navbar')
            ) {
                const showingItems = this.element.querySelectorAll('.mln__has-child--showing');
                showingItems.forEach(item => {
                    this.toggleChild(item, 'hide', true);
                });
            }
        });
        
        // Close any menu when leaving currently focused menu parent
        if (!this.settings.keepMenuOpenOnFocusOut) {
            this.mlnParentList.addEventListener('focusout', (e) => {
                setTimeout(() => {
                    if (window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches) {
                        const activeElement = document.activeElement;
                        const nonActiveMenus = Array.from(document.querySelectorAll('.mln--navbar')).filter(
                            menu => !menu.contains(activeElement)
                        );
                        
                        nonActiveMenus.forEach(menu => {
                            const showingItems = menu.querySelectorAll('.mln__has-child--showing');
                            showingItems.forEach(item => {
                                this.toggleChild(item, 'hide', true);
                            });
                        });
                    }
                    
                    this.isCurrentMenuFocused = 
                        document.activeElement.closest('.mln--navbar') && 
                        document.activeElement.closest('.mln__list') ? true : false;

                    if (
                        !this.isCurrentMenuFocused &&
                        window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                        e.type !== 'keydown' &&
                        this.settings.autoCloseNavbarMenus === true &&
                        e.target.closest('.mln--navbar') &&
                        !document.activeElement.closest('.mln__has-child--showing')
                    ) {
                        const showingItems = this.element.querySelectorAll('.mln__has-child--showing');
                        showingItems.forEach(item => {
                            this.toggleChild(item, 'hide', true);
                        });
                    }
                }, 150);
            });
        }
    }
    
    // Setup transition events
    setupTransitionEvents() {
        // Add special class to the current showing menu
        this.element.addEventListener('transition.mln.child', () => {
            const visibleMenus = this.element.querySelectorAll('.mln__visible-menu');
            visibleMenus.forEach(menu => menu.classList.remove('mln__visible-menu'));
        });
        
        // Add event listeners for show/hide/initialize events
        ['hide.mln.child', 'show.mln.child'].forEach(eventName => {
            this.element.addEventListener(eventName, () => {
                this.updateVisibleMenu();
            });
        });
    }
    
    // Setup resize event handlers
    setupResizeHandlers() {
        window.addEventListener('mlnResizeEnd', () => {
            if (
                window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches &&
                this.settings.autoCloseNavbarMenus === true &&
                this.settings.expandActiveItem === false
            ) {
                const showingItems = this.element.querySelectorAll('.mln__has-child--showing');
                showingItems.forEach(item => {
                    this.toggleChild(item, 'hide', false);
                });
                
                if (this.mlnExpander) {
                    this.mlnExpander.style.height = '';
                    this.mlnExpander.classList.remove('mln__expander--showing');
                }
            }
            
            // Run functions after resize
            this.expandActiveItem();
            this.toggleExpander(false);
            this.assignFlowDirection();
        });
    }
    
    // Update which menu is currently visible
    updateVisibleMenu() {
        const showingItems = this.element.querySelectorAll('.mln__has-child--showing');
        
        if (showingItems.length === 0) {
            const mainList = this.element.querySelector('.mln__list');
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
    
    // Show/hide menu(s)
    toggleChild(el, action, animate) {
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
        mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('transition.mln.child'));
        
        // Correct toggler attributes
        mlnChildToggler.setAttribute('aria-expanded', ariaExpandedValue);
        
        // Grab height of inner collapse elements
        const collapseHelper = mlnToggleChildCollapse.querySelector('.mln__child__collapse__helper');
        const collapseHeight = collapseHelper ? collapseHelper.offsetHeight : 0;
        
        // Show collapsible child elements
        if (action === 'show') {
            mlnHasChild.classList.add('mln__has-child--showing');
            
            const mlnAnyShowing = this.element.querySelectorAll('.mln__has-child--showing');
            
            // Add class to body for regular menu backdrop
            if (
                mlnAnyShowing.length && 
                this.element.classList.contains('mln--navbar') &&
                this.settings.navbarMenuBackdrop === true
            ) {
                this.body.classList.add('js-mln-menu-showing');
            }
            
            // Add class to body for mega menu backdrop
            if (
                mlnHasChild.classList.contains('mln__has-child--mega-menu') &&
                this.element.classList.contains('mln--navbar') &&
                this.settings.navbarMegaMenuBackdrop === true
            ) {
                this.body.classList.add('js-mln-mega-menu-showing');
            }
            
            mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('show.mln.child'));
            
            if (animate === true) {
                mlnToggleChildCollapse.classList.add('mln__child--transitioning');
                mlnToggleChildCollapse.style.height = collapseHeight + 'px';
                mlnToggleChildCollapse.setAttribute('data-mln-hidden', ariaHiddenValue);
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnToggleChildCollapse) return;
                    
                    mlnToggleChildCollapse.removeEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                    mlnToggleChildCollapse.style.height = 'auto';
                    mlnToggleChildCollapse.classList.remove('mln__child--transitioning');
                    mlnToggleChildCollapse.style.height = '';
                    
                    if (mlnToggleChildCollapse.getAttribute('data-mln-hidden') === 'false') {
                        mlnToggleChildCollapse.classList.add('mln--height-auto');
                        mlnToggleChildCollapse.classList.add('mln__child--overflow-visible');
                    }
                    
                    mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('shown.mln.child'));
                    mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('transitioned.mln.child'));
                };
                
                mlnToggleChildCollapse.addEventListener(this.mlnTransitionEnd, handleTransitionEnd);
            } else {
                mlnToggleChildCollapse.style.height = 'auto';
                mlnToggleChildCollapse.classList.add('mln--height-auto');
                mlnToggleChildCollapse.setAttribute('data-mln-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.style.height = '';
                mlnToggleChildCollapse.classList.add('mln__child--overflow-visible');
                
                mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('shown.mln.child'));
                mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('transitioned.mln.child'));
            }
        }
        
        // Hide collapsible child elements
        if (action === 'hide') {
            mlnHasChild.classList.remove('mln__has-child--showing');
            
            const mlnAnyShowing = document.querySelectorAll('.mln--navbar .mln__has-child--showing');
            
            if (!mlnAnyShowing.length && document.querySelectorAll('.mln--navbar').length) {
                this.body.classList.remove('js-mln-menu-showing');
            }
            
            if (
                mlnHasChild.classList.contains('mln__has-child--mega-menu') &&
                !document.querySelector('.mln__has-child--mega-menu.mln__has-child--showing') &&
                this.element.classList.contains('mln--navbar')
            ) {
                this.body.classList.remove('js-mln-mega-menu-showing');
            }
            
            mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('hide.mln.child'));
            
            if (animate === true) {
                mlnToggleChildCollapse.style.height = collapseHeight + 'px';
                mlnToggleChildCollapse.style.minHeight = collapseHeight + 'px';
                mlnToggleChildCollapse.classList.remove('mln__child--overflow-visible', 'mln--height-auto');
                mlnToggleChildCollapse.setAttribute('data-mln-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.classList.add('mln__child--transitioning');
                
                // Force a reflow to ensure the initial height is applied before transitioning
                mlnToggleChildCollapse.offsetHeight;
                
                // Set up transition end handler before changing height
                const handleTransitionEnd = (e) => {
                    if (e.target !== mlnToggleChildCollapse) return;
                    
                    mlnToggleChildCollapse.removeEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                    mlnToggleChildCollapse.classList.remove('mln__child--transitioning');
                    mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('hidden.mln.child'));
                    mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('transitioned.mln.child'));
                };
                
                mlnToggleChildCollapse.addEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(mlnToggleChildCollapse.children).forEach(child => {
                    child.addEventListener(this.mlnTransitionEnd, e => e.stopPropagation());
                });
                
                // Trigger the transition by changing height
                mlnToggleChildCollapse.style.height = '';
                mlnToggleChildCollapse.style.minHeight = '';
            } else {
                mlnToggleChildCollapse.classList.remove('mln__child--overflow-visible', 'mln--height-auto');
                mlnToggleChildCollapse.setAttribute('data-mln-hidden', ariaHiddenValue);
                mlnToggleChildCollapse.style.height = '';
                
                mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('hidden.mln.child'));
                mlnHasChild.dispatchEvent(MultilevelNav.createCustomEvent('transitioned.mln.child'));
            }
        }
    }
    
    // Show/hide expander items
    toggleExpander(animate) {
        if (!this.mlnExpander) return;
        
        const collapseHelper = this.mlnExpander.querySelector('.mln__expander__helper');
        
        if (animate !== false && collapseHelper) {
            const collapseHeight = collapseHelper.offsetHeight;
            const expandBtn = this.element.querySelector('.mln__expand-btn');
            
            if (!this.mlnExpander.classList.contains('mln__expander--showing')) {
                this.mlnExpander.dispatchEvent(MultilevelNav.createCustomEvent('showing.mln.expander'));
                
                this.mlnExpander.classList.add('mln__expander--transitioning');
                this.mlnExpander.style.height = collapseHeight + 'px';
                this.mlnExpander.setAttribute('data-mln-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== this.mlnExpander) return;
                    
                    this.mlnExpander.removeEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                    this.mlnExpander.style.height = 'auto';
                    this.mlnExpander.style.height = '';
                    this.mlnExpander.classList.add('mln__expander--showing');
                    this.mlnExpander.classList.remove('mln__expander--transitioning');
                    
                    this.mlnExpander.dispatchEvent(MultilevelNav.createCustomEvent('shown.mln.expander'));
                };
                
                this.mlnExpander.addEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(this.mlnExpander.children).forEach(child => {
                    child.addEventListener(this.mlnTransitionEnd, e => e.stopPropagation());
                });
            } else {
                this.mlnExpander.dispatchEvent(MultilevelNav.createCustomEvent('hiding.mln.expander'));
                
                this.mlnExpander.classList.add('mln__expander--transitioning');
                this.mlnExpander.style.height = collapseHeight + 'px';
                this.mlnExpander.setAttribute('data-mln-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
                
                setTimeout(() => {
                    this.mlnExpander.classList.remove('mln__expander--showing');
                    this.mlnExpander.style.height = '';
                }, 10);
                
                const handleTransitionEnd = (e) => {
                    if (e.target !== this.mlnExpander) return;
                    
                    this.mlnExpander.removeEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                    this.mlnExpander.classList.remove('mln__expander--transitioning');
                    
                    this.mlnExpander.dispatchEvent(MultilevelNav.createCustomEvent('hidden.mln.expander'));
                };
                
                this.mlnExpander.addEventListener(this.mlnTransitionEnd, handleTransitionEnd);
                
                // Prevent bubbling from child transitions
                Array.from(this.mlnExpander.children).forEach(child => {
                    child.addEventListener(this.mlnTransitionEnd, e => e.stopPropagation());
                });
            }
        }
        
        // Adjust attributes without animating the expander menu
        if (animate === false && this.element.closest('.mln--navbar')) {
            const expandBtn = this.element.querySelector('.mln__expand-btn');
            
            if (window.matchMedia(`(max-width: ${this.mlnDataBreakpoint - 1}px)`).matches) {
                this.mlnExpander.classList.remove('mln__expander--showing');
                this.mlnExpander.setAttribute('data-mln-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
            } else {
                this.mlnExpander.setAttribute('data-mln-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
            }
        }
        
        if (animate === false && this.element.classList.contains('mln--expand-above-breakpoint')) {
            const expandBtn = this.element.querySelector('.mln__expand-btn');
            
            if (window.matchMedia(`(max-width: ${this.mlnDataBreakpoint - 1}px)`).matches) {
                this.mlnExpander.classList.remove('mln__expander--showing');
                this.mlnExpander.setAttribute('data-mln-hidden', 'true');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                }
            } else {
                this.mlnExpander.classList.add('mln__expander--showing');
                this.mlnExpander.setAttribute('data-mln-hidden', 'false');
                
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                }
            }
        }
    }
    
    // Assign class to child items that run off the edge of the screen
    assignFlowDirection() {
        if (!this.settings.autoDirection) return;
        
        setTimeout(() => {
            const hasChildElements = this.element.querySelectorAll('.mln__has-child');
            
            hasChildElements.forEach(hasChild => {
                const bodyRect = document.body.getBoundingClientRect();
                const elemRect = hasChild.getBoundingClientRect();
                const mlnToggleChildOffset = (elemRect.left - bodyRect.left) + (hasChild.offsetWidth * 2);
                
                if (mlnToggleChildOffset > MultilevelNav.viewport().width && window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches) {
                    hasChild.classList.add('mln__child--flow-right');
                } else {
                    hasChild.classList.remove('mln__child--flow-right');
                }
            });
        }, 300);
    }
    
    // Keep items and parents with active class expanded on load
    expandActiveItem() {
        if (!this.settings.expandActiveItem) return;
        
        const activeSelector = this.settings.activeSelector;
        const activeItems = this.mlnParentList.querySelectorAll(activeSelector);
        
        activeItems.forEach(activeItem => {
            activeItem.classList.add('mln__has-child--expand-on-load');
            
            // Find all parent .mln__has-child elements and add the expand class
            let parent = activeItem.closest('.mln__has-child');
            while (parent) {
                parent.classList.add('mln__has-child--expand-on-load');
                parent = parent.parentElement.closest('.mln__has-child');
            }
        });
        
        const itemsToExpand = this.mlnParentList.querySelectorAll('.mln__has-child--expand-on-load');
        
        itemsToExpand.forEach(item => {
            if (
                !this.mlnIsPageLoaded || 
                (this.mlnParentList.closest('.mln--navbar') &&
                window.matchMedia(`(max-width: ${this.mlnDataBreakpoint - 1}px)`).matches &&
                !this.mlnIsPageLoaded)
            ) {
                this.toggleChild(item, 'show', false);
            }
            
            if (
                this.mlnParentList.closest('.mln--navbar') &&
                window.matchMedia(`(min-width: ${this.mlnDataBreakpoint}px)`).matches
            ) {
                this.toggleChild(item, 'hide', false);
            }
        });
        
        if (this.settings.offCanvasScrollToActiveItem) {
            const activeItems = this.element.querySelectorAll(this.settings.activeSelector);
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
                this.body.classList.add('js-off-canvas-scrolled');
            }, 2);
        }
        
        this.mlnIsPageLoaded = true;
    }
}

// Helper function to initialize MultilevelNav on multiple elements
const multilevelNav = (selector, options) => {
    const elements = document.querySelectorAll(selector);
    const instances = [];
    
    elements.forEach(element => {
        const instance = new MultilevelNav(element, options);
        if (instance.mlnParentList) {
            instances.push(instance);
        }
    });
    
    return instances;
};

// jQuery integration for multilevelNav
if (typeof jQuery !== 'undefined') {
    jQuery.fn.multilevelNav = function(options) {
        return this.each(function() {
            new MultilevelNav(this, options);
        });
    };
}