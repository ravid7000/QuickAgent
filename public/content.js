// Content script for Chrome extension
let chatWindow = null;
let isVisible = true;
let iframe = null;

// Store element references for quick lookup
let elementRefMap = new Map();
let refCounter = 1;

// Helper functions for accessibility tree generation
function getAccessibleRole(element) {
  // Explicit role attribute
  const explicitRole = element.getAttribute("role");
  if (explicitRole) return explicitRole;

  // Implicit roles based on tag and attributes
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute("type");

  const roleMap = {
    a: element.getAttribute("href") ? "link" : "generic",
    button: "button",
    input: getInputRole(element),
    textarea: "textbox",
    select: element.multiple ? "listbox" : "combobox",
    option: "option",
    img: element.getAttribute("alt") !== null ? "img" : "presentation",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    p: "paragraph",
    ul: "list",
    ol: "list",
    li: "listitem",
    table: "table",
    thead: "rowgroup",
    tbody: "rowgroup",
    tfoot: "rowgroup",
    tr: "row",
    td: "cell",
    th: "columnheader",
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    section: "region",
    article: "article",
    form: "form",
    search: "search",
    dialog: "dialog",
    strong: "strong",
    em: "emphasis",
    div: "generic",
    span: "generic",
  };

  return roleMap[tagName] || "generic";
}

function getInputRole(element) {
  const type = element.getAttribute("type") || "text";
  const inputRoleMap = {
    button: "button",
    submit: "button",
    reset: "button",
    checkbox: "checkbox",
    radio: "radio",
    text: "textbox",
    email: "textbox",
    password: "textbox",
    search: "searchbox",
    tel: "textbox",
    url: "textbox",
    number: "spinbutton",
    range: "slider",
    file: "button",
  };
  return inputRoleMap[type] || "textbox";
}

function getAccessibleName(element) {
  // Priority order for accessible name calculation

  // 1. aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => {
        const labelElement = document.getElementById(id);
        return labelElement ? labelElement.textContent.trim() : "";
      })
      .filter(Boolean);
    if (labels.length) return labels.join(" ");
  }

  // 2. aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // 3. Form labels
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.trim();
  }

  // 4. Element-specific naming
  const tagName = element.tagName.toLowerCase();

  if (tagName === "img") {
    return element.getAttribute("alt") || "";
  }

  if (["button", "a"].includes(tagName)) {
    return getDirectTextContent(element);
  }

  if (tagName === "input") {
    const type = element.getAttribute("type");
    if (["button", "submit", "reset"].includes(type)) {
      return element.value || element.getAttribute("value") || "";
    }
    if (element.placeholder) {
      return element.placeholder;
    }
  }

  // 5. Direct text content for certain elements
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p"].includes(tagName)) {
    return getDirectTextContent(element);
  }

  return "";
}

function generateCSSSelector(element) {
  if (!element || element === document.body) return 'body';
  
  const parts = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // Add ID if present
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID should be unique, so we can stop here
    }
    
    // Add classes if present
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add attributes that make the element unique
    const uniqueAttrs = ['data-testid', 'data-cy', 'data-test', 'name', 'type', 'role'];
    for (const attr of uniqueAttrs) {
      const value = current.getAttribute(attr);
      if (value) {
        selector += `[${attr}="${value}"]`;
        break; // One unique attribute is enough
      }
    }
    
    // Add nth-child if needed for uniqueness
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

function getAccessibilityAttributes(element) {
  const attributes = [];

  // ARIA states and properties
  if (element.getAttribute("aria-expanded") === "true")
    attributes.push("[expanded]");
  if (element.getAttribute("aria-expanded") === "false")
    attributes.push("[collapsed]");
  if (element.getAttribute("aria-selected") === "true" || element.selected)
    attributes.push("[selected]");
  if (element.getAttribute("aria-checked") === "true" || element.checked)
    attributes.push("[checked]");
  if (element.getAttribute("aria-pressed") === "true")
    attributes.push("[pressed]");
  if (element.disabled || element.getAttribute("aria-disabled") === "true")
    attributes.push("[disabled]");
  if (element.getAttribute("aria-hidden") === "true")
    attributes.push("[hidden]");
  if (element === document.activeElement) attributes.push("[active]");
  if (element.required) attributes.push("[required]");
  if (element.readOnly) attributes.push("[readonly]");

  // Heading level
  const tagName = element.tagName.toLowerCase();
  if (tagName.match(/^h[1-6]$/)) {
    const level = parseInt(tagName.charAt(1));
    attributes.push(`[level=${level}]`);
  }
  const ariaLevel = element.getAttribute("aria-level");
  if (ariaLevel) {
    attributes.push(`[level=${ariaLevel}]`);
  }

  return attributes;
}

function isHidden(element) {
  if (element.getAttribute("aria-hidden") === "true") return true;
  if (element.hidden) return true;

  const style = getComputedStyle(element);
  if (style.display === "none") return true;
  if (style.visibility === "hidden") return true;
  if (style.opacity === "0") return true;

  return false;
}

function isClickable(element) {
  const tagName = element.tagName.toLowerCase();
  const clickableTags = ["a", "button", "input", "select", "textarea"];

  if (clickableTags.includes(tagName)) return true;
  if (element.getAttribute("onclick")) return true;
  if (element.getAttribute("role") === "button") return true;
  if (element.getAttribute("tabindex") === "0") return true;

  const style = getComputedStyle(element);
  if (style.cursor === "pointer") return true;

  return false;
}

function hasDirectTextContent(element) {
  // Check if element has direct text nodes (not from child elements)
  for (let node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      return true;
    }
  }
  return false;
}

function getDirectTextContent(element) {
  let textContent = "";
  for (let node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.textContent;
    }
  }
  return textContent.trim();
}

// Function to generate accessibility tree in YAML format for interactive elements only
function generateAccessibilityTreeYAML(element = document.body, options = {}) {
  const {
    maxDepth = 50,
    includeTextContent = true,
    includeAttributes = true,
  } = options;

  let yamlOutput = "";
  let refCounter = 1;
  const refMap = new Map();

  function getElementRef(element) {
    if (!refMap.has(element)) {
      const ref = `e${refCounter++}`;
      refMap.set(element, ref);
      // Store in global map for quick lookup
      elementRefMap.set(ref, element);
    }
    return refMap.get(element);
  }

  function isInteractiveElement(element) {
    const tagName = element.tagName.toLowerCase();
    const role = getAccessibleRole(element);
    
    // Interactive HTML elements
    const interactiveTags = [
      'button', 'input', 'select', 'textarea', 'a', 'area',
      'details', 'summary', 'dialog', 'menu', 'menuitem'
    ];
    
    // Interactive roles
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
      'listbox', 'option', 'slider', 'spinbutton', 'searchbox',
      'tab', 'tabpanel', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'switch', 'progressbar', 'scrollbar', 'tree', 'treeitem',
      'grid', 'gridcell', 'columnheader', 'rowheader', 'row',
      'cell', 'list', 'listitem', 'tablist', 'tabpanel',
      'dialog', 'alertdialog', 'tooltip', 'toolbar', 'menu',
      'menubar', 'navigation', 'main', 'banner', 'contentinfo',
      'complementary', 'region', 'article', 'section', 'form',
      'search', 'application', 'document', 'presentation'
    ];
    
    // Check if element is interactive by tag
    if (interactiveTags.includes(tagName)) {
      return true;
    }
    
    // Check if element is interactive by role
    if (interactiveRoles.includes(role)) {
      return true;
    }
    
    // Check for interactive attributes
    if (element.getAttribute('onclick') || 
        element.getAttribute('onkeydown') || 
        element.getAttribute('onkeyup') ||
        element.getAttribute('tabindex') !== null) {
      return true;
    }
    
    // Check for clickable elements
    if (isClickable(element)) {
      return true;
    }
    
    return false;
  }

  function isVisible(element) {
    // Check if element is hidden
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.hidden) return false;

    const style = getComputedStyle(element);
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (style.opacity === "0") return false;

    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  function generateYAMLNode(element, depth = 0) {
    if (depth > maxDepth) return "";

    // Only process interactive and visible elements
    if (!isInteractiveElement(element) || !isVisible(element)) {
      // Still process children in case they contain interactive elements
      const children = Array.from(element.children);
      let childOutput = "";
      children.forEach((child) => {
        const childYAML = generateYAMLNode(child, depth);
        if (childYAML) {
          childOutput += childYAML;
        }
      });
      return childOutput;
    }

    const indent = "  ".repeat(depth);
    const role = getAccessibleRole(element);
    const name = getAccessibleName(element);
    const ref = getElementRef(element);

    let nodeOutput = `${indent}- ${role}`;

    // Add name if present
    if (name && name.trim()) {
      nodeOutput += ` "${name.trim()}"`;
    }

    // Add ref attribute
    nodeOutput += ` [ref=${ref}]`;

    // Add CSS selector
    const selector = generateCSSSelector(element);
    if (selector) {
      nodeOutput += ` [selector="${selector}"]`;
    }

    // Add additional attributes
    if (includeAttributes) {
      const attributes = getAccessibilityAttributes(element);
      if (attributes.length > 0) {
        nodeOutput += ` ${attributes.join(" ")}`;
      }
    }

    // Add cursor pointer for clickable elements
    if (isClickable(element)) {
      nodeOutput += ` [cursor=pointer]`;
    }

    nodeOutput += ":\n";

    // Add URL for links
    if (element.tagName === "A" && element.href) {
      nodeOutput += `${indent}  - /url: ${element.href}\n`;
    }

    // Add text content for elements with direct text
    if (includeTextContent && hasDirectTextContent(element)) {
      const textContent = getDirectTextContent(element);
      if (textContent.trim()) {
        nodeOutput += `${indent}  - text: "${textContent.trim()}"\n`;
      }
    }

    // Add value for input elements
    if (element.value !== undefined && element.value !== "") {
      nodeOutput += `${indent}  - value: "${element.value}"\n`;
    }

    // Add placeholder for input elements
    if (element.placeholder) {
      nodeOutput += `${indent}  - placeholder: "${element.placeholder}"\n`;
    }

    // Process children for more interactive elements
    const children = Array.from(element.children);
    children.forEach((child) => {
      const childYAML = generateYAMLNode(child, depth + 1);
      if (childYAML) {
        nodeOutput += childYAML;
      }
    });

    return nodeOutput;
  }


  return generateYAMLNode(element);
}

// Usage examples
// console.log(generateAccessibilityTreeYAML(document.body, {
//   includeHidden: false,
//   maxDepth: 10,
//   includeTextContent: true,
//   includeAttributes: true
// }));

// Function to generate YAML for a specific element
function generateElementYAML(selector, options = {}) {
  const element = document.querySelector(selector);
  if (!element) {
    console.error(`Element not found: ${selector}`);
    return "";
  }
  return generateAccessibilityTreeYAML(element, options);
}

// Browser Actions Service (simplified version for content script)
class BrowserActionsService {
  static getInstance() {
    if (!this.instance) {
      this.instance = new BrowserActionsService();
    }
    return this.instance;
  }

  // browser_click - Perform click on a web page
  async click(params) {
    try {
      const element = this.getElementByAccessibilityRef(params.ref) || this.getElementByRef(params.ref);
      if (!element) {
        return {
          success: false,
          error: `Element not found: ${params.element}`,
        };
      }

      const event = new MouseEvent(params.doubleClick ? "dblclick" : "click", {
        button: this.getButtonCode(params.button || "left"),
        modifiers: params.modifiers || [],
      });

      element.dispatchEvent(event);
      return {
        success: true,
        data: { action: "click", element: params.element },
      };
    } catch (error) {
      return { success: false, error: `Click failed: ${error}` };
    }
  }

  // browser_evaluate - Evaluate JavaScript expression on page or element using Chrome scripting API
  async evaluate(params) {
    try {
      // Use Chrome scripting API to execute code in the page context
      const results = await chrome.scripting.executeScript({
        target: { tabId: (await chrome.tabs.getCurrent()).id },
        func: (functionCode, elementRef) => {
          try {
            // If elementRef is provided, find the element first
            if (elementRef) {
              const element =
                document.querySelector(`[data-ref="${elementRef}"]`) ||
                document.getElementById(elementRef) ||
                document.querySelector(elementRef);
              if (!element) {
                throw new Error(`Element not found: ${elementRef}`);
              }
              // Execute function with element as parameter using Function constructor
              // This runs in the page context, not content script context
              const func = new Function(
                "element",
                `return (${functionCode})(element)`
              );
              return func(element);
            } else {
              // Execute function in global context
              const func = new Function(`return (${functionCode})()`);
              return func();
            }
          } catch (error) {
            throw new Error(`Evaluation failed: ${error.message}`);
          }
        },
        args: [params.function, params.ref || null],
      });

      if (results && results[0] && results[0].result !== undefined) {
        return { success: true, data: results[0].result };
      } else {
        return { success: false, error: "No result returned from evaluation" };
      }
    } catch (error) {
      return { success: false, error: `Evaluation failed: ${error.message}` };
    }
  }

  // browser_file_upload - Upload one or multiple files (delegated to background script)
  async fileUpload(params) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'browser_file_upload',
          paths: params.paths
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      return { success: false, error: `File upload failed: ${error.message}` };
    }
  }

  // browser_fill_form - Fill multiple form fields
  async fillForm(params) {
    try {
      const results = [];

      for (const field of params.fields) {
        try {
          // Try to find element using accessibility ref first, then fallback to regular ref
          let element = this.getElementByAccessibilityRef(field.ref) || this.getElementByRef(field.ref);
          
          if (!element) {
            results.push({
              field: field.name,
              success: false,
              error: "Element not found",
            });
            continue;
          }

          // Use Chrome scripting API for more reliable form filling
          const fieldResult = await this.fillFormField(field, element);
          results.push(fieldResult);
        } catch (fieldError) {
          results.push({
            field: field.name,
            success: false,
            error: fieldError.message || fieldError,
          });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: `Form filling failed: ${error}` };
    }
  }

  // Fill individual form field using Chrome scripting API
  async fillFormField(field, element) {
    try {
      // Get the current tab ID
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;

      // Use Chrome scripting API to execute form filling in the page context
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (fieldData, elementRef) => {
          // Find the element in the page context
          let element = null;
          
          // Try multiple methods to find the element
          if (elementRef) {
            // If we have a direct element reference (from accessibility tree)
            element = elementRef;
          } else {
            // Fallback to selector-based search
            const selectors = [
              `[data-ref="${fieldData.ref}"]`,
              `#${fieldData.ref}`,
              `[id="${fieldData.ref}"]`,
              fieldData.ref // Direct CSS selector
            ];
            
            for (const selector of selectors) {
              try {
                element = document.querySelector(selector);
                if (element) break;
              } catch (e) {
                // Invalid selector, try next
              }
            }
          }

          if (!element) {
            return { success: false, error: "Element not found in page context" };
          }

          try {
            // Focus the element first
            element.focus();

            // Clear existing value
            if (element.value !== undefined) {
              element.value = '';
            }

            // Fill based on field type
            switch (fieldData.type) {
              case "textbox":
                element.value = fieldData.value;
                // Trigger input events
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              case "checkbox":
                element.checked = fieldData.value === true || fieldData.value === 'true';
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              case "radio":
                element.checked = true;
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              case "combobox":
              case "select":
                // For select elements, find the option by value or text
                if (element.tagName.toLowerCase() === 'select') {
                  const options = Array.from(element.options);
                  const option = options.find(opt => 
                    opt.value === fieldData.value || 
                    opt.textContent.trim() === fieldData.value
                  );
                  if (option) {
                    element.value = option.value;
                    element.selectedIndex = option.index;
                  } else {
                    element.value = fieldData.value;
                  }
                } else {
                  element.value = fieldData.value;
                }
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              case "slider":
                element.value = fieldData.value;
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              case "textarea":
                element.value = fieldData.value;
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                break;

              default:
                // Generic input handling
                if (element.value !== undefined) {
                  element.value = fieldData.value;
                  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                }
            }

            // Trigger additional events that might be needed
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

            return { 
              success: true, 
              field: fieldData.name,
              value: fieldData.value,
              elementType: element.tagName.toLowerCase(),
              elementId: element.id || null
            };

          } catch (fillError) {
            return { 
              success: false, 
              error: `Failed to fill field: ${fillError.message}`,
              field: fieldData.name
            };
          }
        },
        args: [field, element]
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        return {
          field: field.name,
          success: false,
          error: "Chrome scripting API failed"
        };
      }

    } catch (error) {
      return {
        field: field.name,
        success: false,
        error: `Chrome API error: ${error.message}`
      };
    }
  }

  // browser_navigate - Navigate to a URL (delegated to background script)
  async navigate(params) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'browser_navigate',
          url: params.url
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      return { success: false, error: `Navigation failed: ${error.message}` };
    }
  }

  // browser_navigate_back - Go back to the previous page (delegated to background script)
  async navigateBack() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'browser_navigate_back'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      return { success: false, error: `Navigate back failed: ${error.message}` };
    }
  }

  // browser_press_key - Press a key on the keyboard (delegated to background script)
  async pressKey(params) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'browser_press_key',
          key: params.key
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      return { success: false, error: `Key press failed: ${error.message}` };
    }
  }

  // browser_select_option - Select an option in a dropdown
  async selectOption(params) {
    try {
      const element = this.getElementByAccessibilityRef(params.ref) || this.getElementByRef(params.ref);
      if (!element) {
        return {
          success: false,
          error: `Element not found: ${params.element}`,
        };
      }

      // Use Chrome scripting API for more reliable option selection
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (selectParams, elementRef) => {
          let element = elementRef;
          
          if (!element) {
            // Fallback to selector-based search
            const selectors = [
              `[data-ref="${selectParams.ref}"]`,
              `#${selectParams.ref}`,
              `[id="${selectParams.ref}"]`,
              selectParams.ref
            ];
            
            for (const selector of selectors) {
              try {
                element = document.querySelector(selector);
                if (element) break;
              } catch (e) {
                // Invalid selector, try next
              }
            }
          }

          if (!element) {
            return { success: false, error: "Element not found in page context" };
          }

          if (element.tagName.toLowerCase() !== 'select') {
            return { success: false, error: "Element is not a select element" };
          }

          try {
            // Focus the element first
            element.focus();

            // Clear existing selections
            Array.from(element.options).forEach((option) => {
              option.selected = false;
            });

            // Select the specified values
            const selectedValues = [];
            selectParams.values.forEach((value) => {
              const option = Array.from(element.options).find(
                (opt) => opt.value === value || opt.textContent.trim() === value
              );
              if (option) {
                option.selected = true;
                selectedValues.push({
                  value: option.value,
                  text: option.textContent.trim()
                });
              }
            });

            // Trigger change event
            element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));

            return {
              success: true,
              action: "select_option",
              values: selectParams.values,
              selectedValues: selectedValues,
              elementType: element.tagName.toLowerCase(),
              elementId: element.id || null
            };

          } catch (selectError) {
            return {
              success: false,
              error: `Failed to select option: ${selectError.message}`,
              element: selectParams.element
            };
          }
        },
        args: [params, element]
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        return {
          success: false,
          error: "Chrome scripting API failed"
        };
      }
    } catch (error) {
      return { success: false, error: `Select option failed: ${error}` };
    }
  }

  // browser_snapshot - Capture accessibility snapshot of the current page
  async snapshot() {
    try {
      let accessibilityTree = null;
      let method = 'custom';

      // Try to get Chrome's accessibility tree first
      try {
        const chromeResult = await this.getChromeAccessibilityTree();
        console.log({chromeResult})
        if (chromeResult.success) {
          accessibilityTree = this.convertChromeTreeToYAML(chromeResult.data);
          method = 'chrome-api';
        }
      } catch (error) {
        console.warn('Chrome accessibility tree not available:', error);
      }

      // Fallback to custom implementation
      if (!accessibilityTree) {
        accessibilityTree = generateAccessibilityTreeYAML(document.body);
        method = 'custom';
      }

      const snapshot = {
        url: window.location.href,
        title: document.title,
        elements: accessibilityTree,
        method: method
      };

      const snapshotYAML = `Page url: ${snapshot.url}
Page title: ${snapshot.title}
Elements: \`\`\`yaml
${snapshot.elements}
\`\`\`
`;

      console.log({snapshotYAML, method});

      return { success: true, data: snapshotYAML };
    } catch (error) {
      return { success: false, error: `Snapshot failed: ${error}` };
    }
  }

  // Get accessibility tree using Chrome Debugger API
  getChromeAccessibilityTree() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getAccessibilityTree'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }

  // Convert Chrome's accessibility tree format to YAML
  convertChromeTreeToYAML(chromeTree) {
    if (!chromeTree || !chromeTree.nodes || chromeTree.nodes.length === 0) {
      return '';
    }

    let yamlOutput = '';
    const nodeMap = new Map();
    let refCounter = 1;
    
    // Create a map for quick node lookup
    chromeTree.nodes.forEach(node => {
      nodeMap.set(node.nodeId, node);
    });

    function convertNode(node, depth = 0) {
      if (!node) return '';
      
      const indent = "  ".repeat(depth);
      const role = node.role?.value || 'unknown';
      const name = node.name?.value || '';
      const description = node.description?.value || '';
      const ref = `e${refCounter++}`;
      
      let yaml = `${indent}- ${role}`;
      
      if (name) {
        yaml += ` "${name}"`;
      }
      
      // Add ref attribute
      yaml += ` [ref=${ref}]`;
      
      // Add DOM information if available
      const properties = [];
      if (description) properties.push(`description="${description}"`);
      if (node.value?.value) properties.push(`value="${node.value.value}"`);
      if (node.checked?.value !== undefined) properties.push(`checked=${node.checked.value}`);
      if (node.selected?.value !== undefined) properties.push(`selected=${node.selected.value}`);
      if (node.disabled?.value !== undefined) properties.push(`disabled=${node.disabled.value}`);
      if (node.focused?.value !== undefined) properties.push(`focused=${node.focused.value}`);
      
      // Add DOM selector if available
      if (node.domInfo && node.domInfo.object) {
        const objectId = node.domInfo.object.objectId;
        if (objectId) {
          properties.push(`selector="[data-chrome-ax-ref=${ref}]"`);
          properties.push(`objectId="${objectId}"`);
        }
      }
      
      // Add additional ARIA properties
      if (node.ariaAttributes) {
        Object.entries(node.ariaAttributes).forEach(([key, value]) => {
          if (value && value.value !== undefined) {
            properties.push(`${key}="${value.value}"`);
          }
        });
      }
      
      if (properties.length > 0) {
        yaml += ` [${properties.join(', ')}]`;
      }
      
      yaml += '\n';
      
      // Process children
      if (node.childIds && node.childIds.length > 0) {
        node.childIds.forEach(childId => {
          const child = nodeMap.get(childId);
          if (child) {
            yaml += convertNode(child, depth + 1);
          }
        });
      }
      
      return yaml;
    }

    // Start with the root node
    const rootNode = chromeTree.nodes[0];
    return convertNode(rootNode);
  }

  // browser_wait_for - Wait for text to appear or disappear or a specified time to pass
  async waitFor(params) {
    try {
      if (params.time) {
        await new Promise((resolve) => setTimeout(resolve, params.time * 1000));
        return { success: true, data: { action: "wait", time: params.time } };
      }

      if (params.text) {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          if (document.body.textContent?.includes(params.text)) {
            return {
              success: true,
              data: { action: "wait_for_text", text: params.text },
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return {
          success: false,
          error: `Text not found within timeout: ${params.text}`,
        };
      }

      if (params.textGone) {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          if (!document.body.textContent?.includes(params.textGone)) {
            return {
              success: true,
              data: { action: "wait_for_text_gone", text: params.textGone },
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return {
          success: false,
          error: `Text still present after timeout: ${params.textGone}`,
        };
      }

      return { success: false, error: "No valid wait parameters provided" };
    } catch (error) {
      return { success: false, error: `Wait failed: ${error}` };
    }
  }

  // Helper methods
  getElementByRef(ref) {
    try {
      // Try to find element by various methods
      let element = document.querySelector(`[data-ref="${ref}"]`);
      if (element) return element;

      element = document.querySelector(`#${ref}`);
      if (element) return element;

      element = document.querySelector(`[id="${ref}"]`);
      if (element) return element;

      // Try to parse as CSS selector
      element = document.querySelector(ref);
      if (element) return element;

      return null;
    } catch (error) {
      console.error("Error finding element:", error);
      return null;
    }
  }

  // Find element by accessibility ref using Chrome Extension APIs
  async getElementByAccessibilityRef(ref) {
    try {
      // Method 1: Try to get element using Chrome Debugger API
      const chromeResult = await this.getElementByChromeAPI(ref);
      if (chromeResult) return chromeResult;

      // Method 2: Fallback to DOM traversal with accessibility tree matching
      return this.getElementByAccessibilityTreeMatch(ref);
    } catch (error) {
      console.error("Error finding element by accessibility ref:", error);
      return null;
    }
  }

  // Get element using Chrome Debugger API
  async getElementByChromeAPI(ref) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getElementByAccessibilityRef',
          ref: ref
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (response.success && response.element) {
        // Convert the remote object to a DOM element
        return this.remoteObjectToElement(response.element);
      }
      return null;
    } catch (error) {
      console.warn('Chrome API method failed:', error);
      return null;
    }
  }

  // Convert Chrome remote object to DOM element
  remoteObjectToElement(remoteObject) {
    try {
      // This is a simplified approach - in practice, you'd need to use
      // chrome.debugger.sendCommand with Runtime.callFunctionOn
      // to execute code in the page context
      return null; // Placeholder - would need more complex implementation
    } catch (error) {
      console.error("Error converting remote object:", error);
      return null;
    }
  }

  // Find element by matching accessibility tree structure
  getElementByAccessibilityTreeMatch(ref) {
    try {
      // Generate accessibility tree and find the ref
      const accessibilityTree = this.generateAccessibilityTreeWithRefs();
      const targetNode = this.findNodeByRef(accessibilityTree, ref);
      
      if (targetNode && targetNode.element) {
        return targetNode.element;
      }
      
      return null;
    } catch (error) {
      console.error("Error in accessibility tree matching:", error);
      return null;
    }
  }

  // Generate accessibility tree with element references for interactive elements only
  generateAccessibilityTreeWithRefs(element = document.body, options = {}) {
    const {
      maxDepth = 50,
    } = options;

    let refCounter = 1;
    const refMap = new Map();

    function getElementRef(element) {
      if (!refMap.has(element)) {
        refMap.set(element, `e${refCounter++}`);
      }
      return refMap.get(element);
    }

    function isInteractiveElement(element) {
      const tagName = element.tagName.toLowerCase();
      const role = getAccessibleRole(element);
      
      // Interactive HTML elements
      const interactiveTags = [
        'button', 'input', 'select', 'textarea', 'a', 'area',
        'details', 'summary', 'dialog', 'menu', 'menuitem'
      ];
      
      // Interactive roles
      const interactiveRoles = [
        'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
        'listbox', 'option', 'slider', 'spinbutton', 'searchbox',
        'tab', 'tabpanel', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
        'switch', 'progressbar', 'scrollbar', 'tree', 'treeitem',
        'grid', 'gridcell', 'columnheader', 'rowheader', 'row',
        'cell', 'list', 'listitem', 'tablist', 'tabpanel',
        'dialog', 'alertdialog', 'tooltip', 'toolbar', 'menu',
        'menubar', 'navigation', 'main', 'banner', 'contentinfo',
        'complementary', 'region', 'article', 'section', 'form',
        'search', 'application', 'document', 'presentation'
      ];
      
      // Check if element is interactive by tag
      if (interactiveTags.includes(tagName)) {
        return true;
      }
      
      // Check if element is interactive by role
      if (interactiveRoles.includes(role)) {
        return true;
      }
      
      // Check for interactive attributes
      if (element.getAttribute('onclick') || 
          element.getAttribute('onkeydown') || 
          element.getAttribute('onkeyup') ||
          element.getAttribute('tabindex') !== null) {
        return true;
      }
      
      // Check for clickable elements
      if (isClickable(element)) {
        return true;
      }
      
      return false;
    }

    function isVisible(element) {
      // Check if element is hidden
      if (element.getAttribute("aria-hidden") === "true") return false;
      if (element.hidden) return false;

      const style = getComputedStyle(element);
      if (style.display === "none") return false;
      if (style.visibility === "hidden") return false;
      if (style.opacity === "0") return false;

      // Check if element has dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;

      return true;
    }

    function generateNode(element, depth = 0) {
      if (depth > maxDepth) return null;

      // Only process interactive and visible elements
      if (!isInteractiveElement(element) || !isVisible(element)) {
        // Still process children in case they contain interactive elements
        const children = [];
        for (const child of element.children) {
          const childNode = generateNode(child, depth);
          if (childNode) {
            children.push(childNode);
          }
        }
        return children.length > 0 ? { children } : null;
      }

      const ref = getElementRef(element);
      const role = getAccessibleRole(element);
      const name = getAccessibleName(element);

      const node = {
        ref: ref,
        role: role,
        name: name,
        element: element,
        children: []
      };

      // Process children
      for (const child of element.children) {
        const childNode = generateNode(child, depth + 1);
        if (childNode) {
          node.children.push(childNode);
        }
      }

      return node;
    }

    return generateNode(element);
  }

  // Find node by ref in the accessibility tree
  findNodeByRef(tree, ref) {
    if (!tree) return null;
    
    if (tree.ref === ref) {
      return tree;
    }

    for (const child of tree.children) {
      const found = this.findNodeByRef(child, ref);
      if (found) return found;
    }

    return null;
  }

  // Enhanced method that tries multiple approaches
  async findElementByRef(ref) {
    try {
      // Method 1: Direct lookup from stored references (fastest)
      let element = elementRefMap.get(ref);
      if (element && document.contains(element)) {
        return element;
      }

      // Method 2: Direct DOM query
      element = this.getElementByRef(ref);
      if (element) return element;

      // Method 3: Accessibility tree matching
      element = this.getElementByAccessibilityTreeMatch(ref);
      if (element) return element;

      // Method 4: Chrome API (if available)
      element = await this.getElementByChromeAPI(ref);
      if (element) return element;

      return null;
    } catch (error) {
      console.error("Error finding element:", error);
      return null;
    }
  }

  // Simple and reliable method to get element by accessibility ref
  getElementByAccessibilityRef(ref) {
    // First try the stored reference map
    let element = elementRefMap.get(ref);
    if (element && document.contains(element)) {
      return element;
    }

    // If not found, regenerate the accessibility tree to rebuild the map
    // This ensures we have the latest element references
    this.generateAccessibilityTreeWithRefs();
    element = elementRefMap.get(ref);
    
    if (element && document.contains(element)) {
      return element;
    }

    return null;
  }

  getButtonCode(button) {
    switch (button) {
      case "left":
        return 0;
      case "middle":
        return 1;
      case "right":
        return 2;
      default:
        return 0;
    }
  }

  getAccessibilitySnapshot(element) {
    const elements = [];

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const el = node;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      const el = node;
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        elements.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().substring(0, 100) || "",
          attributes: {
            id: el.id,
            class: el.className,
            type: el.getAttribute("type"),
            role: el.getAttribute("role"),
            "aria-label": el.getAttribute("aria-label"),
          },
          ref: el.id || `element-${elements.length}`,
        });
      }
    }

    return elements;
  }

  getAccessibilitySnapshotYAML(element) {
    const elements = this.getAccessibilitySnapshot(element);
    const yamlLines = [];

    // Helper function to determine accessible tag using helper functions
    const getAccessibleTag = (el) => {
      // Get the actual DOM element to use with helper functions
      const domElement =
        document.querySelector(`[id="${el.ref}"]`) ||
        document.querySelector(`[data-ref="${el.ref}"]`) ||
        document.querySelector(`[ref="${el.ref}"]`);

      if (!domElement) {
        // Fallback to basic tag checking if element not found
        const accessibleTags = [
          "button",
          "input",
          "select",
          "textarea",
          "a",
          "img",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "nav",
          "main",
          "header",
          "footer",
          "section",
          "article",
          "aside",
          "form",
          "label",
          "fieldset",
          "legend",
          "ul",
          "ol",
          "li",
          "table",
          "tr",
          "td",
          "th",
          "thead",
          "tbody",
          "tfoot",
          "caption",
          "summary",
          "details",
          "dialog",
          "menu",
          "menuitem",
        ];
        return accessibleTags.includes(el.tag) ? el.tag : "generic";
      }

      // Use helper functions for better accessibility detection
      const role = getImplicitRole(domElement) || el.attributes.role;
      const isFocusableElement = isFocusable(domElement);
      const isHiddenElement = isHidden(domElement);

      // Skip hidden elements
      if (isHiddenElement) {
        return null;
      }

      // Use role if available
      if (role) {
        // Map roles back to semantic tags
        const roleToTag = {
          button: "button",
          link: "a",
          textbox: "input",
          checkbox: "input",
          radio: "input",
          combobox: "select",
          heading: el.tag.startsWith("h") ? el.tag : "heading",
          img: "img",
          list: el.tag === "ul" || el.tag === "ol" ? el.tag : "list",
          listitem: "li",
          navigation: "nav",
          main: "main",
          banner: "header",
          contentinfo: "footer",
          complementary: "aside",
          region: "section",
          article: "article",
          form: "form",
          table: "table",
          row: "tr",
          cell: "td",
          columnheader: "th",
          rowgroup:
            el.tag === "thead" || el.tag === "tbody" || el.tag === "tfoot"
              ? el.tag
              : "rowgroup",
        };

        return roleToTag[role] || el.tag;
      }

      // Check for focusable elements that should be shown
      if (isFocusableElement) {
        if (el.tag === "input" && el.attributes.type) {
          return el.attributes.type === "button" ||
            el.attributes.type === "submit" ||
            el.attributes.type === "reset"
            ? "button"
            : "input";
        }
        return el.tag;
      }

      // Check for semantic elements
      const semanticTags = [
        "button",
        "input",
        "select",
        "textarea",
        "a",
        "img",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "nav",
        "main",
        "header",
        "footer",
        "section",
        "article",
        "aside",
        "form",
        "label",
        "fieldset",
        "legend",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "td",
        "th",
        "thead",
        "tbody",
        "tfoot",
        "caption",
        "summary",
        "details",
        "dialog",
        "menu",
        "menuitem",
      ];

      if (semanticTags.includes(el.tag)) {
        return el.tag;
      }

      return "generic";
    };

    // Helper function to get accessible name using helper functions
    const getAccessibleText = (el) => {
      const domElement =
        document.querySelector(`[id="${el.ref}"]`) ||
        document.querySelector(`[data-ref="${el.ref}"]`) ||
        document.querySelector(`[ref="${el.ref}"]`);

      if (domElement) {
        const accessibleName = getAccessibleName(domElement);
        return accessibleName || el.text;
      }

      return el.text;
    };

    // Helper function to build YAML representation
    const buildYAML = (elements, depth = 0) => {
      const indent = "  ".repeat(depth);

      elements.forEach((el, index) => {
        const accessibleTag = getAccessibleTag(el);

        // Skip if element is hidden or generic
        if (!accessibleTag || accessibleTag === "generic") {
          return;
        }

        const accessibleText = getAccessibleText(el);
        const text = accessibleText ? ` "${accessibleText}"` : "";
        const ref = ` [ref=${el.ref}]`;
        const cursor =
          accessibleTag === "button" || accessibleTag === "a"
            ? " [cursor=pointer]"
            : "";
        const href =
          accessibleTag === "a"
            ? el.attributes.href
              ? `\n${indent}  - /url: ${el.attributes.href}`
              : ""
            : "";

        yamlLines.push(
          `${indent}- ${accessibleTag}${text}${ref}${cursor}:${href}`
        );
      });
    };

    buildYAML(elements);
    return yamlLines.join("\n");
  }

  jsonToYAML(jsonData, indentLevel = 0) {
    const indent = "  ".repeat(indentLevel);
    const lines = [];

    if (Array.isArray(jsonData)) {
      jsonData.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          lines.push(`${indent}- `);
          const itemYAML = this.jsonToYAML(item, indentLevel + 1);
          lines.push(itemYAML);
        } else {
          const value = this.formatYAMLValue(item);
          lines.push(`${indent}- ${value}`);
        }
      });
    } else if (typeof jsonData === "object" && jsonData !== null) {
      Object.entries(jsonData).forEach(([key, value], index) => {
        if (typeof value === "object" && value !== null) {
          if (Array.isArray(value)) {
            lines.push(`${indent}${key}:`);
            const arrayYAML = this.jsonToYAML(value, indentLevel + 1);
            lines.push(arrayYAML);
          } else {
            lines.push(`${indent}${key}:`);
            const objectYAML = this.jsonToYAML(value, indentLevel + 1);
            lines.push(objectYAML);
          }
        } else {
          const formattedValue = this.formatYAMLValue(value);
          lines.push(`${indent}${key}: ${formattedValue}`);
        }
      });
    } else {
      const value = this.formatYAMLValue(jsonData);
      lines.push(`${indent}${value}`);
    }

    return lines.join("\n");
  }

  formatYAMLValue(value) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") {
      // Escape quotes and wrap in quotes if needed
      if (
        value.includes('"') ||
        value.includes("\n") ||
        value.includes(":") ||
        value.startsWith(" ")
      ) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (typeof value === "boolean") return value.toString();
    if (typeof value === "number") return value.toString();
    return JSON.stringify(value);
  }
}

// Create the floating chat window
function createChatWindow() {
  if (chatWindow) return;

  // Create container for the React app
  const container = document.createElement("div");
  container.id = "quick-agent-chat-container";

  // Create iframe for React app
  iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("index.html");
  iframe.style.cssText = `
    max-height: 100%;
    max-width: 100%;
    width: 48px;
    height: 48px;
    border: none;
    background: none;
    position: fixed;
    right: 30px;
    bottom: 30px;
    z-index: 9999;
    padding: 0;
    margin: 0;
    overflow: hidden;
  `;

  container.appendChild(iframe);
  document.body.appendChild(container);

  chatWindow = container;
}

// Show the chat window
function showChat() {
  if (!chatWindow) {
    createChatWindow();
  }
  chatWindow.style.display = "flex";
  isVisible = true;
}

// Hide the chat window
function hideChat() {
  if (chatWindow) {
    chatWindow.style.display = "none";
    isVisible = false;
  }
}

// Toggle the chat window
function toggleChat() {
  if (isVisible) {
    hideChat();
  } else {
    showChat();
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "toggleChat") {
    toggleChat();
    sendResponse({ success: true });
  }

  if (request.action === "updateStyles" && request.styles) {
    Object.entries(request.styles).forEach(([key, value]) => {
      iframe.style[key] = value;
    });
  }

  if (request.action === "ping") {
    console.log("Ping received, responding...");
    sendResponse({ success: true, message: "Content script is ready" });
  }

  // Handle browser actions
  if (request.action === "browserAction") {
    console.log("Processing browser action:", request.function);

    // Return true to indicate we'll respond asynchronously
    handleBrowserAction(request)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: `Browser action failed: ${error.message}`,
        });
      });

    return true; // This tells Chrome we'll respond asynchronously
  }
});

async function handleBrowserAction(request) {
  const browserActions = BrowserActionsService.getInstance();
  let result;

  switch (request.function) {
    case "browser_click":
      result = await browserActions.click(request.params);
      break;
    case "browser_evaluate":
      result = await browserActions.evaluate(request.params);
      break;
    case "browser_file_upload":
      result = await browserActions.fileUpload(request.params);
      break;
    case "browser_fill_form":
      result = await browserActions.fillForm(request.params);
      break;
    case "browser_navigate":
      result = await browserActions.navigate(request.params);
      break;
    case "browser_navigate_back":
      result = await browserActions.navigateBack();
      break;
    case "browser_press_key":
      result = await browserActions.pressKey(request.params);
      break;
    case "browser_select_option":
      result = await browserActions.selectOption(request.params);
      break;
    case "browser_snapshot":
      console.log("Taking snapshot...");
      result = await browserActions.snapshot();
      console.log("Snapshot result:", result);
      if (result.success) {
        // Convert to tree string for better LLM understanding
        // const treeString = browserActions.convertSnapshotToTreeString(result.data);
        result.data = JSON.stringify(result.data, null);
        console.log("Tree string generated:", result.data);
      }
      break;
    case "browser_wait_for":
      result = await browserActions.waitFor(request.params);
      break;
    default:
      result = {
        success: false,
        error: `Unknown browser action: ${request.function}`,
      };
  }

  console.log("Sending response:", result);
  return result;
}

// Keyboard shortcut listener (Ctrl+Shift+A)
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key === "A") {
    event.preventDefault();
    toggleChat();
  }
});

// Initialize
createChatWindow();
