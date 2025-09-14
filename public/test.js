// Playwright-style locator implementation for Chrome extension
// This mimics Playwright's page.locator().click() functionality

class PlaywrightStyleLocator {
  constructor(selector, context = document) {
    this.selector = selector;
    this.context = context;
    this.element = null;
  }

  // Find the element using the selector
  async locate() {
    try {
      // Handle different selector types
      if (this.selector.startsWith('#')) {
        // ID selector
        this.element = this.context.getElementById(this.selector.substring(1));
      } else if (this.selector.startsWith('.')) {
        // Class selector
        this.element = this.context.querySelector(this.selector);
      } else if (this.selector.startsWith('//')) {
        // XPath selector
        const result = this.context.evaluate(
          this.selector,
          this.context,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        this.element = result.singleNodeValue;
      } else {
        // CSS selector (default)
        this.element = this.context.querySelector(this.selector);
      }

      if (!this.element) {
        throw new Error(`Element not found: ${this.selector}`);
      }

      return this.element;
    } catch (error) {
      throw new Error(`Locator failed: ${error.message}`);
    }
  }

  // Click the element
  async click(options = {}) {
    const element = await this.locate();
    
    if (!element) {
      throw new Error(`Cannot click: element not found (${this.selector})`);
    }

    // Check if element is visible and clickable
    if (!this.isElementClickable(element)) {
      throw new Error(`Element is not clickable: ${this.selector}`);
    }

    // Scroll element into view if needed
    if (options.force !== true) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.waitForElementToBeVisible(element);
    }

    // Create and dispatch click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: options.button || 0,
      buttons: 1,
      clientX: element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2,
      clientY: element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2
    });

    // Apply modifiers if specified
    if (options.ctrlKey) clickEvent.ctrlKey = true;
    if (options.shiftKey) clickEvent.shiftKey = true;
    if (options.altKey) clickEvent.altKey = true;
    if (options.metaKey) clickEvent.metaKey = true;

    // Dispatch the event
    element.dispatchEvent(clickEvent);

    // Also trigger any onclick handlers
    if (element.onclick) {
      element.onclick(clickEvent);
    }

    return { success: true, message: `Clicked element: ${this.selector}` };
  }

  // Double click the element
  async dblclick(options = {}) {
    const element = await this.locate();
    
    if (!element) {
      throw new Error(`Cannot double click: element not found (${this.selector})`);
    }

    // Perform two clicks with a small delay
    await this.click(options);
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.click(options);

    return { success: true, message: `Double clicked element: ${this.selector}` };
  }

  // Fill the element with text
  async fill(text, options = {}) {
    const element = await this.locate();
    
    if (!element) {
      throw new Error(`Cannot fill: element not found (${this.selector})`);
    }

    // Check if element is fillable
    if (!this.isElementFillable(element)) {
      throw new Error(`Element is not fillable: ${this.selector}`);
    }

    // Clear existing value
    if (options.clear !== false) {
      element.value = '';
    }

    // Set the new value
    element.value = text;

    // Trigger input events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true, message: `Filled element with: ${text}` };
  }

  // Get text content of the element
  async textContent() {
    const element = await this.locate();
    return element.textContent?.trim() || '';
  }

  // Get inner HTML of the element
  async innerHTML() {
    const element = await this.locate();
    return element.innerHTML;
  }

  // Get outer HTML of the element
  async outerHTML() {
    const element = await this.locate();
    return element.outerHTML;
  }

  // Check if element is visible
  async isVisible() {
    try {
      const element = await this.locate();
      return this.isElementVisible(element);
    } catch {
      return false;
    }
  }

  // Check if element is enabled
  async isEnabled() {
    try {
      const element = await this.locate();
      return !element.disabled && !element.hasAttribute('disabled');
    } catch {
      return false;
    }
  }

  // Wait for element to be visible
  async waitForElementToBeVisible(element, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.isElementVisible(element)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Element did not become visible within ${timeout}ms`);
  }

  // Check if element is clickable
  isElementClickable(element) {
    if (!element) return false;
    
    // Check if element is visible
    if (!this.isElementVisible(element)) return false;
    
    // Check if element is enabled
    if (element.disabled || element.hasAttribute('disabled')) return false;
    
    // Check if element has pointer events
    const style = window.getComputedStyle(element);
    if (style.pointerEvents === 'none') return false;
    
    return true;
  }

  // Check if element is visible
  isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  // Check if element is fillable
  isElementFillable(element) {
    const fillableTags = ['input', 'textarea', 'select'];
    const fillableTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
    
    if (!fillableTags.includes(element.tagName.toLowerCase())) return false;
    
    if (element.tagName.toLowerCase() === 'input') {
      return fillableTypes.includes(element.type?.toLowerCase()) || !element.type;
    }
    
    return true;
  }

  // Get element attributes
  async getAttribute(name) {
    const element = await this.locate();
    return element.getAttribute(name);
  }

  // Set element attributes
  async setAttribute(name, value) {
    const element = await this.locate();
    element.setAttribute(name, value);
    return { success: true, message: `Set attribute ${name} to ${value}` };
  }
}

// Playwright-style page object
class PlaywrightStylePage {
  constructor() {
    this.context = document;
  }

  // Create a locator
  locator(selector) {
    return new PlaywrightStyleLocator(selector, this.context);
  }

  // Navigate to a URL (for testing purposes)
  async goto(url) {
    window.location.href = url;
    return { success: true, message: `Navigated to ${url}` };
  }

  // Get page title
  async title() {
    return document.title;
  }

  // Get page URL
  async url() {
    return window.location.href;
  }

  // Wait for a condition
  async waitFor(condition, options = {}) {
    const timeout = options.timeout || 5000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Wait condition not met within ${timeout}ms`);
  }

  // Wait for selector to be visible
  async waitForSelector(selector, options = {}) {
    return this.waitFor(async () => {
      try {
        const locator = this.locator(selector);
        return await locator.isVisible();
      } catch {
        return false;
      }
    }, options);
  }

  // Take a screenshot (placeholder)
  async screenshot(options = {}) {
    return { success: true, message: 'Screenshot taken (placeholder)' };
  }

  // Evaluate JavaScript
  async evaluate(func, ...args) {
    try {
      const result = func(...args);
      return result;
    } catch (error) {
      throw new Error(`Evaluation failed: ${error.message}`);
    }
  }
}

// Create global page instance
const page = new PlaywrightStylePage();

// Example usage and test functions
async function testPlaywrightStyleLocator() {
  console.log('Testing Playwright-style locator implementation...');
  
  try {
    // Test 1: Basic click
    console.log('Test 1: Basic click');
    await page.locator('#react-select-3-input').click();
    console.log('✅ Click successful');
    
    // Test 2: Fill input
    console.log('Test 2: Fill input');
    await page.locator('#react-select-3-input').fill('test value');
    console.log('✅ Fill successful');
    
    // Test 3: Get text content
    console.log('Test 3: Get text content');
    const text = await page.locator('#react-select-3-input').textContent();
    console.log('✅ Text content:', text);
    
    // Test 4: Check visibility
    console.log('Test 4: Check visibility');
    const isVisible = await page.locator('#react-select-3-input').isVisible();
    console.log('✅ Is visible:', isVisible);
    
    // Test 5: Wait for selector
    console.log('Test 5: Wait for selector');
    await page.waitForSelector('#react-select-3-input');
    console.log('✅ Wait for selector successful');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlaywrightStylePage, PlaywrightStyleLocator, page };
}

// Make available globally
window.PlaywrightStylePage = PlaywrightStylePage;
window.PlaywrightStyleLocator = PlaywrightStyleLocator;
window.page = page;
window.testPlaywrightStyleLocator = testPlaywrightStyleLocator;

console.log('Playwright-style locator implementation loaded!');
console.log('Usage: page.locator("#react-select-3-input").click()');
console.log('Run: testPlaywrightStyleLocator() to test the implementation');
