class OffCanvasNav {
    constructor(navElement) {
        
        // Find the main navigation elements
        this.nav = navElement;
        this.breakpoint = navElement.getAttribute('data-oc-breakpoint');
        this.menu = navElement.querySelector('[data-oc-menu]');
        this.overlay = navElement.querySelector('[data-oc-overlay]') || document.querySelector('[data-oc-overlay]');
        this.toggleButton = navElement.querySelector('[data-oc-toggle]');
        this.closeButton = navElement.querySelector('[data-oc-close]');
        
        // Track keyboard and focus state
        this.keyboardHandler = null;
        this.previouslyFocusedElement = null;
        this.swipeable = navElement.hasAttribute('data-oc-swipe');

        // Touch/swipe state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchCurrentX = 0;
        this.touchCurrentY = 0;
        this.isDragging = false;
        this.swipeThreshold = 50;
        this.swipeVelocityThreshold = 0.3;
        this.snapThreshold = 0.5;
        
        // Gesture tracking
        this.isGestureInProgress = false;
        this.gestureStartPosition = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        
        // Open/close menu when toggle button is clicked
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggleMenu());
        }
        
        // Close menu when close button is clicked
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.closeMenu());
        }
        
        // Close menu when overlay is clicked
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeMenu());
        }
        
        // Close menu when Escape key is pressed
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isMenuOpen()) {
                this.closeMenu();
            }
        });
        
        // Handle window resize - close menu on desktop, manage accessibility on mobile
        window.addEventListener('resize', () => {
            if (this.isDesktopView()) {
                this.closeMenu();
                this.makeMenuAccessible();
            } else {
                this.updateAccessibilityForCurrentState();
            }
        });
        
        // Setup swipe functionality
        if (this.swipeable) {
            this.setupSwipeListeners();
        }

        // Set initial accessibility state
        this.updateAccessibilityForCurrentState();
    }
    
    getMenuWidth() {
        const menuWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--oc-menu-width'), 10);
        return menuWidth;
    }
    
    isMenuOnRight() {
        return this.menu.classList.contains('oc-nav__menu--right');
    }
    
    setMenuTransform(translateX) {
        const isRight = this.isMenuOnRight();
        const menuWidth = this.getMenuWidth();
        
        // Clamp the translation values for closing only
        if (isRight) {
            translateX = Math.min(0, Math.max(-menuWidth, translateX));
        } else {
            translateX = Math.max(0, Math.min(menuWidth, translateX));
        }
        
        this.menu.style.transform = `translateX(${translateX}px)`;
        
        // Update overlay opacity based on menu position
        if (this.overlay) {
            const progress = Math.abs(translateX) / menuWidth;
            this.overlay.style.opacity = progress;
            this.overlay.style.visibility = progress > 0 ? 'visible' : 'hidden';
        }
    }
    
    resetMenuTransform() {
        this.menu.style.transform = '';
        if (this.overlay) {
            this.overlay.style.opacity = '';
            this.overlay.style.visibility = '';
        }
    }
    
    setupSwipeListeners() {
     
        // Touch events for swipe functionality
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }
    
    handleTouchStart(e) {
        if (!this.isMobileView() || !this.isMenuOpen()) return;
        
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchCurrentX = this.touchStartX;
        this.touchCurrentY = this.touchStartY;
        this.isDragging = false;
        this.isGestureInProgress = false;
        this.swipeStartTime = Date.now();
        this.menu.removeAttribute('inert');
    }
    
    handleTouchMove(e) {
        if (!this.isMobileView() || !this.isMenuOpen()) return;
        
        this.touchCurrentX = e.touches[0].clientX;
        this.touchCurrentY = e.touches[0].clientY;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        const deltaY = this.touchCurrentY - this.touchStartY;

        
        // Check if it's a horizontal swipe (more horizontal than vertical movement)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            const isRight = this.isMenuOnRight();
            
            // Only allow closing gestures
            const isClosingGesture = isRight ? deltaX > 0 : deltaX < 0;
            
            if (isClosingGesture) {
                this.isDragging = true;
                this.isGestureInProgress = true;
                
                // Prevent scrolling when swiping horizontally
                e.preventDefault();
                
                // Calculate the new position for closing
                const menuWidth = this.getMenuWidth();
                let newTranslateX;
                
                if (isRight) {
                    // Right menu: positive deltaX closes (swipe right to close)
                    newTranslateX = -menuWidth + deltaX;
                } else {
                    // Left menu: negative deltaX closes (swipe left to close)
                    newTranslateX = menuWidth + deltaX;
                }
                
                // Apply the transform in real-time
                this.setMenuTransform(newTranslateX);
            }
        }
    }
    
    handleTouchEnd(e) {
        if (!this.isMobileView() || !this.isDragging || !this.isMenuOpen()) return;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        const deltaY = this.touchCurrentY - this.touchStartY;
        const swipeTime = Date.now() - this.swipeStartTime;
        const swipeVelocity = Math.abs(deltaX) / swipeTime;
        
        // Check if it's a valid horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const isRight = this.isMenuOnRight();
            const menuWidth = this.getMenuWidth();
            
            // Calculate how far the menu has been dragged as a percentage
            const dragDistance = Math.abs(deltaX);
            const dragPercentage = dragDistance / menuWidth;
            
            // Determine if we should close based on distance or velocity
            let shouldClose = false;
            
            if (swipeVelocity > this.swipeVelocityThreshold) {
                // Fast swipe - use direction (only allow closing direction)
                if (isRight) {
                    shouldClose = deltaX > 0; // Swipe right to close
                } else {
                    shouldClose = deltaX < 0; // Swipe left to close
                }
            } else {
                // Slow swipe - use position threshold
                shouldClose = dragPercentage > this.snapThreshold;
            }
            
            // Animate to final position
            this.menu.style.transition = 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            if (shouldClose) {
                this.snapToClose();
            } else {
                this.snapToOpen();
            }
            
            // Remove transition after animation
            setTimeout(() => {
                this.menu.style.transition = '';
            }, 300);
        }
        
        this.isDragging = false;
        this.isGestureInProgress = false;
    }
    
    snapToOpen() {
        const isRight = this.isMenuOnRight();
        const menuWidth = this.getMenuWidth();
        
        // Set final transform for open state
        if (isRight) {
            this.setMenuTransform(-menuWidth);
        } else {
            this.setMenuTransform(menuWidth);
        }
        
        // Reset transform after transition
        setTimeout(() => {
            this.resetMenuTransform();
        }, 300);
    }
    
    snapToClose() {
        // Set final transform for closed state
        this.setMenuTransform(0);
        
        // Update classes and accessibility
        this.menu.classList.remove('show');
        if (this.overlay) {
            this.overlay.classList.remove('show');
        }
        
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.closeButton.setAttribute('aria-expanded', 'false');
        
        document.body.style.overflow = '';
        this.updateAccessibilityForCurrentState();
        this.removeKeyboardNavigation();
        
        // Reset transform after transition
        setTimeout(() => {
            this.resetMenuTransform();
        }, 300);
    }
    
    // Mouse event handlers for desktop swipe simulation
    handleMouseStart(e) {
        if (!this.isMobileView() || !this.isMenuOpen()) return;
        
        this.touchStartX = e.clientX;
        this.touchStartY = e.clientY;
        this.touchCurrentX = this.touchStartX;
        this.touchCurrentY = this.touchStartY;
        this.isDragging = false;
        this.isGestureInProgress = false;
        this.swipeStartTime = Date.now();
        this.isMouseDown = true;
    }
    
    handleMouseMove(e) {
        if (!this.isMobileView() || !this.isMouseDown || !this.isMenuOpen()) return;
        
        this.touchCurrentX = e.clientX;
        this.touchCurrentY = e.clientY;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        const deltaY = this.touchCurrentY - this.touchStartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            const isRight = this.isMenuOnRight();
            
            // Only allow closing gestures
            const isClosingGesture = isRight ? deltaX > 0 : deltaX < 0;
            
            if (isClosingGesture) {
                this.isDragging = true;
                this.isGestureInProgress = true;
                
                // Calculate the new position for closing
                const menuWidth = this.getMenuWidth();
                let newTranslateX;
                
                if (isRight) {
                    // Right menu: positive deltaX closes
                    newTranslateX = -menuWidth + deltaX;
                } else {
                    // Left menu: negative deltaX closes
                    newTranslateX = menuWidth + deltaX;
                }
                
                this.setMenuTransform(newTranslateX);
            }
        }
    }
    
    handleMouseEnd(e) {
        if (!this.isMobileView() || !this.isMouseDown) return;
        
        if (this.isDragging) {
            this.handleTouchEnd(e);
        }
        
        this.isMouseDown = false;
        this.isDragging = false;
        this.isGestureInProgress = false;
    }
    
    toggleMenu() {
        if (this.isMenuOpen()) {
            this.toggleButton.setAttribute('aria-expanded', 'false');
            this.closeButton.setAttribute('aria-expanded', 'false');
            this.closeMenu();
        } else {
            this.toggleButton.setAttribute('aria-expanded', 'true');
            this.closeButton.setAttribute('aria-expanded', 'true');
            this.openMenu();
        }
    }
    
    openMenu() {
        this.toggleButton.setAttribute('aria-expanded', 'true');
        this.closeButton.setAttribute('aria-expanded', 'true');
        
        // Fire a custom event after before transition starts
        const showEvent = new CustomEvent('show.offCanvas');
        document.dispatchEvent(showEvent);

        // Show the menu and overlay
        this.menu.classList.add('show');
        
        if (this.overlay) {
            this.overlay.classList.add('show');
        }
        
        // Prevent page scrolling when menu is open
        document.body.style.overflow = 'hidden';
        
        // Handle accessibility and keyboard navigation
        this.updateAccessibilityForCurrentState();
        this.setupKeyboardNavigation();

        // Fire a custom event after transition ends
        this.menu.addEventListener('transitionend', () => {
            const shownEvent = new CustomEvent('shown.offCanvas');
            document.dispatchEvent(shownEvent);
        }, { once: true });
    }
    
    closeMenu() {
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.closeButton.setAttribute('aria-expanded', 'false');

        // Fire a custom event after before transition starts
        const hideEvent = new CustomEvent('hide.offCanvas');
        document.dispatchEvent(hideEvent);
        
        // Hide the menu and overlay
        this.menu.classList.remove('show');
        
        if (this.overlay) {
            this.overlay.classList.remove('show');
        }
        
        // Restore page scrolling
        document.body.style.overflow = '';
        
        // Clean up accessibility and keyboard navigation
        this.updateAccessibilityForCurrentState();
        this.removeKeyboardNavigation();

        // Fire a custom event after transition ends
        this.menu.addEventListener('transitionend', () => {
            const hiddenEvent = new CustomEvent('hidden.offCanvas');
            document.dispatchEvent(hiddenEvent);
        }, { once: true });
    }
    
    isMenuOpen() {
        return this.menu.classList.contains('show');
    }
    
    isDesktopView() {
        return window.matchMedia(`(min-width: ${parseInt(this.breakpoint)}px)`).matches;
    }
    
    isMobileView() {
        return window.matchMedia(`(max-width: ${parseInt(this.breakpoint) - 1}px)`).matches;
    }
    
    isElementVisible(element) {
        const styles = window.getComputedStyle(element);
        return styles.display !== 'none' && 
                styles.visibility !== 'hidden' && 
                element.offsetParent !== null;
    }
    
    getFocusableElements(container) {
        
        // Define what elements can receive focus
        const focusableSelectors = [
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
        
        // Find all focusable elements that are actually visible
        return Array.from(container.querySelectorAll(focusableSelectors.join(',')))
            .filter(element => this.isElementVisible(element) && element.tabIndex >= 0);
    }
    
    setupKeyboardNavigation() {
        
        // Remember what was focused before opening the menu
        this.previouslyFocusedElement = document.activeElement;
        
        // Create keyboard event handler for the menu
        this.keyboardHandler = (event) => {
            
            // Close menu on Escape
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeMenu();
                return;
            }
            
            // Handle Tab navigation to stay within the menu
            if (event.key === 'Tab') {
                const focusableElements = this.getFocusableElements(this.menu);
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                // If no focusable elements, prevent tabbing
                if (focusableElements.length === 0) {
                    event.preventDefault();
                    return;
                }
                
                // Wrap focus from first to last when shift+tabbing
                if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
                // Wrap focus from last to first when tabbing
                else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };
        
        // Attach the keyboard handler to the menu
        this.menu.addEventListener('keydown', this.keyboardHandler);
        
        // Focus the first focusable element in the menu
        const firstFocusableElement = this.getFocusableElements(this.menu)[0];
        if (firstFocusableElement) {
            firstFocusableElement.focus();
        }
    }
    
    removeKeyboardNavigation() {
        
        // Remove the keyboard event handler
        if (this.keyboardHandler) {
            this.menu.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        // Restore focus to the element that was focused before opening the menu
        if (this.previouslyFocusedElement) {
            this.previouslyFocusedElement.focus();
        }
    }
    
    updateAccessibilityForCurrentState() {
        
        // On mobile when menu is open, make it accessible
        // Otherwise, make it inaccessible to screen readers
        if (this.isMenuOpen() && this.isMobileView() || !this.isMobileView()) {
            this.makeMenuAccessible();
        } else {
            this.makeMenuInaccessible();
        }
    }
    
    makeMenuAccessible() {
        this.menu.removeAttribute('inert');
    }
    
    makeMenuInaccessible() {
        this.menu.setAttribute('inert', 'true');
    }
}

// Initialize navigation when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const navigationElements = document.querySelectorAll('.oc-nav');
    navigationElements.forEach(nav => new OffCanvasNav(nav));
});