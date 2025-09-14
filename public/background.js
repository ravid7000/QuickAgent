// Background script for Chrome extension
console.log("Background script loaded");

// Handle messages from content script and React app
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  if (request.action === "browserAction") {
    // Get the active tab if not provided
    const tab = sender.tab || null;

    if (!tab) {
      // If no tab provided, get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          handleBrowserAction(request, tabs[0])
            .then(sendResponse)
            .catch((error) => {
              console.error("Browser action error:", error);
              sendResponse({
                success: false,
                error: error.message,
              });
            });
        } else {
          sendResponse({
            success: false,
            error: "No active tab found",
          });
        }
      });
    } else {
      handleBrowserAction(request, tab)
        .then(sendResponse)
        .catch((error) => {
          console.error("Browser action error:", error);
          sendResponse({
            success: false,
            error: error.message,
          });
        });
    }
    return true; // Indicates we'll respond asynchronously
  }
});

// Handle browser actions using Chrome native APIs
async function handleBrowserAction(request, tab) {
  const { function: actionName, params } = request;

  try {
    switch (actionName) {
      case "browser_snapshot":
        return await handleSnapshot(tab);

      case "browser_click":
        return await handleClick(tab, params);

      case "browser_navigate":
        return await handleNavigate(tab, params);

      case "browser_navigate_back":
        return await handleNavigateBack(tab);

      case "browser_fill_form":
        return await handleFillForm(tab, params);

      case "browser_select_option":
        return await handleSelectOption(tab, params);

      case "browser_press_key":
        return await handlePressKey(tab, params);

      case "browser_evaluate":
        return await handleEvaluate(tab, params);

      case "browser_wait_for":
        return await handleWaitFor(tab, params);

      case "browser_file_upload":
        return await handleFileUpload(tab, params);

      case "browser_get_by_role":
        return await handleGetByRole(tab, params);

      default:
        throw new Error(`Unknown browser action: ${actionName}`);
    }
  } catch (error) {
    console.error(`Error executing ${actionName}:`, error);
    throw error;
  }
}

async function createSnapshot(tab) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      let elementCache = window.elementCache || new Map();
      let treeCache = window.treeCache || null;

      function traverseDOMTree(element = document.body, level = 0) {
        let refCounter = 1;

        // Clear cache when starting new traversal
        elementCache.clear();

        function processElement(el) {
          // Safety checks
          if (!el || typeof el !== "object" || !el.nodeType) {
            return null;
          }

          // Skip text nodes and other non-element nodes
          if (el.nodeType !== Node.ELEMENT_NODE) {
            return null;
          }

          // Skip non-interactive elements
          const tagName = el.tagName?.toLowerCase();
          if (
            [
              "script",
              "style",
              "meta",
              "link",
              "title",
              "head",
              "noscript",
            ].includes(tagName)
          ) {
            return null;
          }

          // Generate unique reference with simple counter
          const ref = `e${refCounter++}`;

          // Determine if element is clickable
          const clickable = isClickable(el);

          // Get cursor style
          const cursor = getCursorStyle(el);

          // Create element object
          const elementObj = {
            ref: ref,
            type: tagName,
            clickable: clickable,
            cursor: cursor,
            level: level,
            text: getElementText(el),
            attributes: getRelevantAttributes(el),
            xpath: getXPath(el),
            children: [],
          };

          // Cache the element for fast lookup
          elementCache.set(ref, elementObj);

          // Process children
          if (el.children && el.children.length > 0) {
            const children = Array.from(el.children);
            children.forEach((child) => {
              const childElement = processElement(child);
              if (childElement) {
                elementObj.children.push(childElement);
              }
            });
          }

          return elementObj;
        }

        function isClickable(el) {
          const tagName = el.tagName?.toLowerCase();

          // Interactive elements
          if (
            ["button", "a", "input", "select", "textarea", "label"].includes(
              tagName
            )
          ) {
            return true;
          }

          // Elements with click handlers
          if (
            el.onclick ||
            el.getAttribute("onclick") ||
            el.getAttribute("onmousedown") ||
            el.getAttribute("onmouseup") ||
            el.getAttribute("onkeydown") ||
            el.getAttribute("onkeyup")
          ) {
            return true;
          }

          // Elements with tabindex (focusable)
          if (
            el.hasAttribute("tabindex") &&
            el.getAttribute("tabindex") !== "-1"
          ) {
            return true;
          }

          // Elements with role that are interactive
          const role = el.getAttribute("role");
          if (
            role &&
            [
              "button",
              "link",
              "menuitem",
              "tab",
              "option",
              "checkbox",
              "radio",
            ].includes(role)
          ) {
            return true;
          }

          // Elements with cursor pointer
          const computedStyle = window.getComputedStyle(el);
          if (computedStyle.cursor === "pointer") {
            return true;
          }

          // Elements with data attributes indicating interactivity
          if (
            el.hasAttribute("data-testid") ||
            el.hasAttribute("data-cy") ||
            el.hasAttribute("data-test") ||
            el.hasAttribute("data-qa")
          ) {
            return true;
          }

          return false;
        }

        function getCursorStyle(el) {
          try {
            const computedStyle = window.getComputedStyle(el);
            return computedStyle.cursor || "default";
          } catch (e) {
            return "default";
          }
        }

        function getElementText(el) {
          try {
            // Get accessible text content
            const ariaLabel = el.getAttribute("aria-label");
            if (ariaLabel) return ariaLabel.trim();

            const title = el.getAttribute("title");
            if (title) return title.trim();

            const placeholder = el.getAttribute("placeholder");
            if (placeholder) return placeholder.trim();

            const alt = el.getAttribute("alt");
            if (alt) return alt.trim();

            // Get text content, but limit length
            const textContent = el.textContent?.trim();
            if (textContent && textContent.length > 0) {
              return textContent.length > 100
                ? textContent.substring(0, 100) + "..."
                : textContent;
            }

            return "";
          } catch (e) {
            return "";
          }
        }

        function getRelevantAttributes(el) {
          const relevantAttrs = [
            "id",
            "class",
            "type",
            "name",
            "value",
            "href",
            "src",
            "alt",
            "title",
            "aria-label",
            "aria-labelledby",
            "aria-describedby",
            "role",
            "tabindex",
            "data-testid",
            "data-cy",
            "data-test",
            "data-qa",
            "onclick",
            "placeholder",
            "required",
          ];

          const attrs = {};
          relevantAttrs.forEach((attr) => {
            const value = el.getAttribute(attr);
            if (value !== null) {
              attrs[attr] = value;
            }
          });

          return attrs;
        }

        function getXPath(el) {
          try {
            if (el.id) {
              return `//*[@id="${el.id}"]`;
            }

            const path = [];
            let current = el;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let selector = current.nodeName.toLowerCase();

              if (current.id) {
                selector += `[@id="${current.id}"]`;
                path.unshift(selector);
                break;
              } else {
                let sibling = current;
                let nth = 1;

                while ((sibling = sibling.previousElementSibling)) {
                  if (sibling.nodeName.toLowerCase() === selector) {
                    nth++;
                  }
                }

                if (nth !== 1) {
                  selector += `[${nth}]`;
                }
              }

              path.unshift(selector);
              current = current.parentElement;
            }

            return path.length ? `//${path.join("/")}` : "";
          } catch (e) {
            console.error("Error generating XPath:", e);
            return "";
          }
        }

        // Start traversal
        const rootElement = processElement(element);

        // Cache the entire tree for future use
        treeCache = rootElement;

        return rootElement;
      }

      window.elementCache = elementCache;
      window.treeCache = treeCache;

      return traverseDOMTree();
    },
  });
  return results[0]?.result;
}

const snapshotCache = new Map();

function cacheSnapshotWithRef(snapshot) {
  if (!snapshot) return;

  // Clear existing cache
  snapshotCache.clear();

  // Recursive function to process each element in the tree
  function processElement(element) {
    if (!element || !element.ref) return;

    // Store element in cache
    snapshotCache.set(element.ref, element);

    // Process children recursively
    if (element.children && Array.isArray(element.children)) {
      element.children.forEach((child) => processElement(child));
    }
  }

  // Start processing from the root
  processElement(snapshot);
}

function createAccessibleTree(tree, indent = 0) {
  if (!tree) {
    return "";
  }

  // Check if element is accessible/interactive based on type and properties
  const isAccessible = isElementAccessible(tree);

  const spaces = "  ".repeat(indent);
  const clickableText = tree.clickable ? " [CLICKABLE]" : "";
  const cursorText =
    tree.cursor !== "default" ? ` [cursor: ${tree.cursor}]` : "";
  const textText = tree.text ? ` "${tree.text}"` : "";

  let result = "";

  // Only include the element if it's accessible/interactive
  if (isAccessible) {
    result = `${spaces}- ${tree.type} [ref=${tree.ref}] ${clickableText} ${cursorText}: ${textText}`;
  }

  // Always process children recursively to find accessible elements
  if (tree.children && tree.children.length > 0) {
    for (const child of tree.children) {
      const childResult = createAccessibleTree(child, indent + 1);
      if (childResult) {
        // If current element is not accessible but has accessible children,
        // include it as a container
        if (!isAccessible && result === "") {
          result = `${spaces}- ${tree.type} [ref=${tree.ref}] (container)`;
        }
        result += "\n" + childResult;
      }
    }
  }

  return result;
}

// Helper function to determine if an element is accessible/interactive
function isElementAccessible(element) {
  if (!element || !element.type) {
    return false;
  }

  const tagName = element.type.toLowerCase();

  // Interactive HTML elements
  const interactiveElements = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "label",
    "option",
    "optgroup",
    "fieldset",
    "legend",
    "details",
    "summary",
    "menu",
    "menuitem",
    "menubar",
    "tab",
    "tablist",
    "tabpanel",
    "dialog",
    "progress",
    "meter",
    "slider",
    "range",
  ];

  // Check if it's a known interactive element
  if (interactiveElements.includes(tagName)) {
    return true;
  }

  // Check if it has interactive attributes
  if (element.attributes) {
    const interactiveAttrs = [
      "role",
      "tabindex",
      "onclick",
      "onmousedown",
      "onmouseup",
      "onkeydown",
      "onkeyup",
      "data-testid",
      "data-cy",
      "data-test",
    ];

    if (interactiveAttrs.some((attr) => element.attributes[attr])) {
      return true;
    }
  }

  // Check if it's clickable (has click handlers or cursor pointer)
  if (element.clickable || element.cursor === "pointer") {
    return true;
  }

  // Check if it has meaningful text content
  if (element.text && element.text.trim().length > 0) {
    // For elements with text, consider them accessible if they're not just containers
    const containerElements = [
      "div",
      "span",
      "p",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "main",
      "aside",
    ];
    if (!containerElements.includes(tagName)) {
      return true;
    }
  }

  return false;
}

function findElementFromSnapshot(ref) {
  return snapshotCache.get(ref);
}

// Capture accessibility snapshot of the page
async function handleSnapshot(tab) {
  try {
    const snapshot = await createSnapshot(tab);
    cacheSnapshotWithRef(snapshot);
    const tree = createAccessibleTree(snapshot);

    const yamlTree = tree;

    return {
      success: true,
      data: `Page url: ${tab.url}
Page title: ${tab.title}
Elements: ${yamlTree}`,
    };
  } catch (error) {
    throw new Error(`Snapshot failed: ${error.message}`);
  }
}

// Comprehensive selector resolver - handles any type of selector
function resolveSelector(selector, context = document) {
  if (!selector) {
    throw new Error('Selector is required');
  }

  // Handle different selector types
  if (selector.startsWith('#')) {
    // ID selector
    const id = selector.substring(1);
    return context.getElementById(id);
  } else if (selector.startsWith('.')) {
    // Class selector
    return context.querySelector(selector);
  } else if (selector.startsWith('//') || selector.startsWith('/')) {
    // XPath selector
    const result = context.evaluate(
      selector,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } else if (selector.startsWith('[') && selector.endsWith(']')) {
    // Attribute selector
    return context.querySelector(selector);
  } else if (selector.includes(' ')) {
    // Complex CSS selector (contains spaces)
    return context.querySelector(selector);
  } else if (selector.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
    // Tag name selector
    return context.querySelector(selector);
  } else if (selector.startsWith('text=')) {
    // Text-based selector (Playwright style)
    const text = selector.substring(5);
    const xpath = `//*[contains(text(), "${text}") or contains(@aria-label, "${text}") or contains(@title, "${text}")]`;
    const result = context.evaluate(
      xpath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } else if (selector.startsWith('role=')) {
    // Role-based selector (Playwright style)
    const role = selector.substring(5);
    const xpath = `//*[@role="${role}"]`;
    const result = context.evaluate(
      xpath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } else if (selector.startsWith('data-testid=')) {
    // Data test ID selector
    const testId = selector.substring(12);
    return context.querySelector(`[data-testid="${testId}"]`);
  } else if (selector.startsWith('data-cy=')) {
    // Cypress data-cy selector
    const cyId = selector.substring(8);
    return context.querySelector(`[data-cy="${cyId}"]`);
  } else if (selector.startsWith('data-qa=')) {
    // QA data attribute selector
    const qaId = selector.substring(8);
    return context.querySelector(`[data-qa="${qaId}"]`);
  } else if (selector.startsWith('placeholder=')) {
    // Placeholder selector
    const placeholder = selector.substring(12);
    return context.querySelector(`[placeholder="${placeholder}"]`);
  } else if (selector.startsWith('name=')) {
    // Name attribute selector
    const name = selector.substring(5);
    return context.querySelector(`[name="${name}"]`);
  } else if (selector.startsWith('value=')) {
    // Value attribute selector
    const value = selector.substring(6);
    return context.querySelector(`[value="${value}"]`);
  } else if (selector.startsWith('href=')) {
    // Href attribute selector
    const href = selector.substring(5);
    return context.querySelector(`[href="${href}"]`);
  } else if (selector.startsWith('src=')) {
    // Src attribute selector
    const src = selector.substring(4);
    return context.querySelector(`[src="${src}"]`);
  } else if (selector.startsWith('alt=')) {
    // Alt attribute selector
    const alt = selector.substring(4);
    return context.querySelector(`[alt="${alt}"]`);
  } else if (selector.startsWith('title=')) {
    // Title attribute selector
    const title = selector.substring(6);
    return context.querySelector(`[title="${title}"]`);
  } else if (selector.startsWith('aria-label=')) {
    // ARIA label selector
    const ariaLabel = selector.substring(11);
    return context.querySelector(`[aria-label="${ariaLabel}"]`);
  } else if (selector.startsWith('aria-labelledby=')) {
    // ARIA labelledby selector
    const ariaLabelledby = selector.substring(16);
    return context.querySelector(`[aria-labelledby="${ariaLabelledby}"]`);
  } else if (selector.startsWith('type=')) {
    // Type attribute selector
    const type = selector.substring(5);
    return context.querySelector(`[type="${type}"]`);
  } else if (selector.startsWith('class=')) {
    // Class attribute selector
    const className = selector.substring(6);
    return context.querySelector(`.${className}`);
  } else if (selector.startsWith('id=')) {
    // ID attribute selector
    const id = selector.substring(3);
    return context.querySelector(`#${id}`);
  } else if (selector.startsWith('nth=')) {
    // Nth child selector
    const nth = selector.substring(4);
    return context.querySelector(`:nth-child(${nth})`);
  } else if (selector.startsWith('first=')) {
    // First child selector
    const tag = selector.substring(6);
    return context.querySelector(`${tag}:first-child`);
  } else if (selector.startsWith('last=')) {
    // Last child selector
    const tag = selector.substring(5);
    return context.querySelector(`${tag}:last-child`);
  } else if (selector.startsWith('visible=')) {
    // Visible element selector
    const subSelector = selector.substring(8);
    const elements = context.querySelectorAll(subSelector);
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display !== 'none' && 
          style.visibility !== 'hidden' && 
          style.opacity !== '0' && 
          rect.width > 0 && 
          rect.height > 0) {
        return el;
      }
    }
    return null;
  } else if (selector.startsWith('enabled=')) {
    // Enabled element selector
    const subSelector = selector.substring(8);
    const elements = context.querySelectorAll(subSelector);
    for (const el of elements) {
      if (!el.disabled && !el.hasAttribute('disabled')) {
        return el;
      }
    }
    return null;
  } else if (selector.startsWith('clickable=')) {
    // Clickable element selector
    const subSelector = selector.substring(10);
    const elements = context.querySelectorAll(subSelector);
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display !== 'none' && 
          style.visibility !== 'hidden' && 
          style.opacity !== '0' && 
          rect.width > 0 && 
          rect.height > 0 &&
          !el.disabled && 
          !el.hasAttribute('disabled') &&
          style.pointerEvents !== 'none') {
        return el;
      }
    }
    return null;
  } else {
    // Default CSS selector
    return context.querySelector(selector);
  }
}

// Handle click actions using debugger API
async function handleClick(tab, params) {
  const {
    ref,
    selector,
    doubleClick = false,
    button = "left",
    modifiers = [],
    useDebugger = true,
  } = params;

  try {
    if (useDebugger) {
      return await handleClickWithDebugger(tab, params);
    }

    // Determine the selector to use
    let elementSelector;
    if (selector) {
      // Use provided selector directly
      elementSelector = selector;
    } else if (ref) {
      // Use ref from snapshot
      const base = findElementFromSnapshot(ref);
      if (!base) {
        throw new Error(`Element not found in snapshot: ${ref}`);
      }
      
      // Try different selector strategies based on available attributes
      if (base.attributes?.id) {
        elementSelector = `#${base.attributes.id}`;
      } else if (base.attributes?.class) {
        elementSelector = `.${base.attributes.class.split(' ')[0]}`;
      } else if (base.xpath) {
        elementSelector = base.xpath;
      } else {
        throw new Error(`No valid selector found for ref: ${ref}`);
      }
    } else {
      throw new Error('Either ref or selector must be provided');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (selector, doubleClick, button, modifiers) => {
        // Use the comprehensive selector resolver
        const element = resolveSelector(selector);

        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Apply modifiers
        const modifierKeys = {
          Alt: "altKey",
          Control: "ctrlKey",
          Meta: "metaKey",
          Shift: "shiftKey",
        };

        const eventInit = {
          button: button === "right" ? 2 : button === "middle" ? 1 : 0,
          bubbles: true,
          cancelable: true,
        };

        modifiers.forEach((mod) => {
          if (modifierKeys[mod]) {
            eventInit[modifierKeys[mod]] = true;
          }
        });

        // Create and dispatch click event
        const clickEvent = new MouseEvent(
          doubleClick ? "dblclick" : "click",
          eventInit
        );
        element.dispatchEvent(clickEvent);

        return { success: true, message: `Clicked ${element.tagName} using selector: ${selector}` };
      },
      args: [elementSelector, doubleClick, button, modifiers],
    });

    return results[0].result;
  } catch (error) {
    throw new Error(`Click failed: ${error.message}`);
  }
}

// Handle click actions using Chrome Debugger API
async function handleClickWithDebugger(tab, params) {
  const {
    ref,
    selector,
    doubleClick = false,
    button = "left",
    modifiers = [],
  } = params;

  try {
    // Determine the selector to use
    let elementSelector;
    if (selector) {
      // Use provided selector directly
      elementSelector = selector;
    } else if (ref) {
      // Use ref from snapshot
      const base = findElementFromSnapshot(ref);
      if (!base) {
        throw new Error(`Element not found in snapshot: ${ref}`);
      }
      
      // Try different selector strategies based on available attributes
      if (base.attributes?.id) {
        elementSelector = `#${base.attributes.id}`;
      } else if (base.attributes?.class) {
        elementSelector = `.${base.attributes.class.split(' ')[0]}`;
      } else if (base.xpath) {
        elementSelector = base.xpath;
      } else {
        throw new Error(`No valid selector found for ref: ${ref}`);
      }
    } else {
      throw new Error('Either ref or selector must be provided');
    }

    // Get element position using debugger API
    const elementPosition = await getElementPositionWithDebugger(tab, elementSelector);
    if (!elementPosition) {
      throw new Error(`Could not get element position for: ${elementSelector}`);
    }

    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId: tab.id }, "1.3");

    try {
      // Convert button to debugger format
      const debuggerButton = button === "right" ? "right" : button === "middle" ? "middle" : "left";
      
      // Convert modifiers to debugger format
      const debuggerModifiers = {
        alt: modifiers.includes("Alt"),
        ctrl: modifiers.includes("Control"),
        meta: modifiers.includes("Meta"),
        shift: modifiers.includes("Shift"),
      };

      // Perform the click using Input.dispatchMouseEvent
      const clickCommand = {
        type: doubleClick ? "mousePressed" : "mousePressed",
        x: elementPosition.x,
        y: elementPosition.y,
        button: debuggerButton,
        clickCount: doubleClick ? 2 : 1,
        modifiers: debuggerModifiers.alt ? 1 : 0 | 
                  debuggerModifiers.ctrl ? 2 : 0 |
                  debuggerModifiers.meta ? 4 : 0 |
                  debuggerModifiers.shift ? 8 : 0
      };

      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", clickCommand);

      // Release the mouse button
      const releaseCommand = {
        type: "mouseReleased",
        x: elementPosition.x,
        y: elementPosition.y,
        button: debuggerButton,
        clickCount: doubleClick ? 2 : 1,
        modifiers: debuggerModifiers.alt ? 1 : 0 | 
                  debuggerModifiers.ctrl ? 2 : 0 |
                  debuggerModifiers.meta ? 4 : 0 |
                  debuggerModifiers.shift ? 8 : 0
      };

      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", releaseCommand);

      return { 
        success: true, 
        message: `Clicked ${element.type} using debugger API at position (${elementPosition.x}, ${elementPosition.y})` 
      };

    } finally {
      // Detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id });
      } catch (detachError) {
        console.warn("Failed to detach debugger:", detachError);
      }
    }

  } catch (error) {
    // Ensure debugger is detached even if there's an error
    try {
      await chrome.debugger.detach({ tabId: tab.id });
    } catch (detachError) {
      console.warn("Failed to detach debugger after error:", detachError);
    }
    throw new Error(`Debugger click failed: ${error.message}`);
  }
}

// Get element position using debugger API
async function getElementPositionWithDebugger(tab, selector) {
  try {
    // Attach debugger
    await chrome.debugger.attach({ tabId: tab.id }, "1.3");

    try {
      // First, get the document root node
      const documentResult = await chrome.debugger.sendCommand({ tabId: tab.id }, "DOM.getDocument");
      const rootNodeId = documentResult.root.nodeId;

      // Convert selector to XPath if needed
      let xpathQuery = selector;
      if (!selector.startsWith('//') && !selector.startsWith('/')) {
        // Convert CSS selector to XPath
        xpathQuery = await convertSelectorToXPath(tab, selector);
      }

      // Search for the element using XPath
      const searchResult = await chrome.debugger.sendCommand(
        { tabId: tab.id }, 
        "DOM.performSearch", 
        { query: xpathQuery, includeUserAgentShadowDOM: true }
      );

      if (!searchResult.searchId || searchResult.resultCount === 0) {
        throw new Error(`Element not found with selector: ${selector}`);
      }

      // Get the search results
      const searchResults = await chrome.debugger.sendCommand(
        { tabId: tab.id }, 
        "DOM.getSearchResults", 
        { searchId: searchResult.searchId, fromIndex: 0, toIndex: 1 }
      );

      if (!searchResults.nodeIds || searchResults.nodeIds.length === 0) {
        throw new Error(`No node IDs found for selector: ${selector}`);
      }

      const nodeId = searchResults.nodeIds[0];

      // Get the box model for the element
      const boxModel = await chrome.debugger.sendCommand(
        { tabId: tab.id }, 
        "DOM.getBoxModel", 
        { nodeId: nodeId }
      );

      if (!boxModel.model || !boxModel.model.content) {
        throw new Error(`Could not get box model for element`);
      }

      // Calculate center position
      const content = boxModel.model.content;
      const x = Math.round((content[0] + content[2]) / 2); // Average of left and right
      const y = Math.round((content[1] + content[3]) / 2); // Average of top and bottom

      return { x, y };

    } finally {
      // Detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id });
      } catch (detachError) {
        console.warn("Failed to detach debugger in getElementPosition:", detachError);
      }
    }

  } catch (error) {
    // Ensure debugger is detached even if there's an error
    try {
      await chrome.debugger.detach({ tabId: tab.id });
    } catch (detachError) {
      console.warn("Failed to detach debugger after error in getElementPosition:", detachError);
    }
    throw error;
  }
}

// Convert CSS selector to XPath for debugger API
async function convertSelectorToXPath(tab, selector) {
  // Handle different selector types and convert to XPath
  if (selector.startsWith('#')) {
    // ID selector
    const id = selector.substring(1);
    return `//*[@id="${id}"]`;
  } else if (selector.startsWith('.')) {
    // Class selector
    const className = selector.substring(1);
    return `//*[contains(@class, "${className}")]`;
  } else if (selector.startsWith('text=')) {
    // Text-based selector
    const text = selector.substring(5);
    return `//*[contains(text(), "${text}") or contains(@aria-label, "${text}") or contains(@title, "${text}")]`;
  } else if (selector.startsWith('role=')) {
    // Role-based selector
    const role = selector.substring(5);
    return `//*[@role="${role}"]`;
  } else if (selector.startsWith('data-testid=')) {
    // Data test ID selector
    const testId = selector.substring(12);
    return `//*[@data-testid="${testId}"]`;
  } else if (selector.startsWith('data-cy=')) {
    // Cypress data-cy selector
    const cyId = selector.substring(8);
    return `//*[@data-cy="${cyId}"]`;
  } else if (selector.startsWith('data-qa=')) {
    // QA data attribute selector
    const qaId = selector.substring(8);
    return `//*[@data-qa="${qaId}"]`;
  } else if (selector.startsWith('placeholder=')) {
    // Placeholder selector
    const placeholder = selector.substring(12);
    return `//*[@placeholder="${placeholder}"]`;
  } else if (selector.startsWith('name=')) {
    // Name attribute selector
    const name = selector.substring(5);
    return `//*[@name="${name}"]`;
  } else if (selector.startsWith('value=')) {
    // Value attribute selector
    const value = selector.substring(6);
    return `//*[@value="${value}"]`;
  } else if (selector.startsWith('href=')) {
    // Href attribute selector
    const href = selector.substring(5);
    return `//*[@href="${href}"]`;
  } else if (selector.startsWith('src=')) {
    // Src attribute selector
    const src = selector.substring(4);
    return `//*[@src="${src}"]`;
  } else if (selector.startsWith('alt=')) {
    // Alt attribute selector
    const alt = selector.substring(4);
    return `//*[@alt="${alt}"]`;
  } else if (selector.startsWith('title=')) {
    // Title attribute selector
    const title = selector.substring(6);
    return `//*[@title="${title}"]`;
  } else if (selector.startsWith('aria-label=')) {
    // ARIA label selector
    const ariaLabel = selector.substring(11);
    return `//*[@aria-label="${ariaLabel}"]`;
  } else if (selector.startsWith('aria-labelledby=')) {
    // ARIA labelledby selector
    const ariaLabelledby = selector.substring(16);
    return `//*[@aria-labelledby="${ariaLabelledby}"]`;
  } else if (selector.startsWith('type=')) {
    // Type attribute selector
    const type = selector.substring(5);
    return `//*[@type="${type}"]`;
  } else if (selector.startsWith('class=')) {
    // Class attribute selector
    const className = selector.substring(6);
    return `//*[contains(@class, "${className}")]`;
  } else if (selector.startsWith('id=')) {
    // ID attribute selector
    const id = selector.substring(3);
    return `//*[@id="${id}"]`;
  } else if (selector.startsWith('nth=')) {
    // Nth child selector
    const nth = selector.substring(4);
    return `//*[position()=${nth}]`;
  } else if (selector.startsWith('first=')) {
    // First child selector
    const tag = selector.substring(6);
    return `//${tag}[1]`;
  } else if (selector.startsWith('last=')) {
    // Last child selector
    const tag = selector.substring(5);
    return `//${tag}[last()]`;
  } else if (selector.startsWith('visible=')) {
    // Visible element selector - this is complex, use CSS selector
    const subSelector = selector.substring(8);
    return await convertCSSSelectorToXPath(subSelector);
  } else if (selector.startsWith('enabled=')) {
    // Enabled element selector
    const subSelector = selector.substring(8);
    return await convertCSSSelectorToXPath(subSelector);
  } else if (selector.startsWith('clickable=')) {
    // Clickable element selector
    const subSelector = selector.substring(10);
    return await convertCSSSelectorToXPath(subSelector);
  } else {
    // Default CSS selector - convert to XPath
    return await convertCSSSelectorToXPath(selector);
  }
}

// Convert CSS selector to XPath (basic implementation)
async function convertCSSSelectorToXPath(selector) {
  // This is a basic implementation - for complex selectors, you might want to use a library
  // For now, we'll handle simple cases and fall back to the selector as-is for complex ones
  
  if (selector.includes(' ')) {
    // Complex selector with spaces - convert each part
    const parts = selector.split(' ');
    let xpath = '//';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) xpath += '//';
      
      if (part.startsWith('#')) {
        xpath += `*[@id="${part.substring(1)}"]`;
      } else if (part.startsWith('.')) {
        xpath += `*[contains(@class, "${part.substring(1)}")]`;
      } else if (part.startsWith('[') && part.endsWith(']')) {
        const attr = part.substring(1, part.length - 1);
        if (attr.includes('=')) {
          const [name, value] = attr.split('=');
          xpath += `*[@${name}="${value}"]`;
        } else {
          xpath += `*[@${attr}]`;
        }
      } else {
        xpath += part;
      }
    }
    
    return xpath;
  } else {
    // Simple selector
    if (selector.startsWith('#')) {
      return `//*[@id="${selector.substring(1)}"]`;
    } else if (selector.startsWith('.')) {
      return `//*[contains(@class, "${selector.substring(1)}")]`;
    } else if (selector.startsWith('[') && selector.endsWith(']')) {
      const attr = selector.substring(1, selector.length - 1);
      if (attr.includes('=')) {
        const [name, value] = attr.split('=');
        return `//*[@${name}="${value}"]`;
      } else {
        return `//*[@${attr}]`;
      }
    } else {
      return `//${selector}`;
    }
  }
}

// Handle navigation
async function handleNavigate(tab, params) {
  const { url } = params;

  try {
    await chrome.tabs.update(tab.id, { url });
    return { success: true, message: `Navigated to ${url}` };
  } catch (error) {
    throw new Error(`Navigation failed: ${error.message}`);
  }
}

// Handle back navigation
async function handleNavigateBack(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        window.history.back();
      },
    });
    return { success: true, message: "Navigated back" };
  } catch (error) {
    throw new Error(`Back navigation failed: ${error.message}`);
  }
}

// Handle form filling using debugger API
async function handleFillForm(tab, params) {
  const { fields, useDebugger = true } = params;

  try {
    if (useDebugger) {
      return await handleFillFormWithDebugger(tab, params);
    }

    const fieldsWithXPath = fields.map((field) => {
      const selector = findElementFromSnapshot(field.ref);
      return {
        ...field,
        selector: selector.attributes.id || selector.attributes.class || selector.xpath,
      }
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (fields) => {
        const results = [];

        fields.forEach((field) => {
          const { name, type, ref, value, selector } = field;

          let element = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          )?.singleNodeValue;

          if (!element) {
            results.push({
              field: name,
              success: false,
              error: `Element not found: ${ref}`,
            });
            return;
          }

          try {
            switch (type) {
              case "textbox":
                element.value = value;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                break;

              case "checkbox":
                element.checked = value;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                break;

              case "radio":
                element.checked = value;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                break;

              case "combobox":
                element.value = value;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                break;

              case "slider":
                element.value = value;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                break;

              default:
                element.value = value;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            }

            results.push({ field: name, success: true, value });
          } catch (error) {
            results.push({ field: name, success: false, error: error.message });
          }
        });

        return results;
      },
      args: [fieldsWithXPath],
    });

    return { success: true, data: results[0].result };
  } catch (error) {
    throw new Error(`Form filling failed: ${error.message}`);
  }
}

// Handle form filling using Chrome Debugger API
async function handleFillFormWithDebugger(tab, params) {
  const { fields } = params;

  try {
    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId: tab.id }, "1.3");

    try {
      const results = [];

      for (const field of fields) {
        try {
          const { name, type, ref, value } = field;
          
          // Get element from snapshot
          const element = findElementFromSnapshot(ref);
          if (!element) {
            results.push({
              field: name,
              success: false,
              error: `Element not found in snapshot: ${ref}`,
            });
            continue;
          }

          // Determine selector strategy
          let elementSelector;
          if (element.attributes?.id) {
            elementSelector = `#${element.attributes.id}`;
          } else if (element.attributes?.class) {
            elementSelector = `.${element.attributes.class.split(' ')[0]}`;
          } else if (element.xpath) {
            elementSelector = element.xpath;
          } else {
            results.push({
              field: name,
              success: false,
              error: `No valid selector found for ref: ${ref}`,
            });
            continue;
          }

          // Get element position and focus it
          const elementPosition = await getElementPositionWithDebugger(tab, elementSelector);
          if (!elementPosition) {
            results.push({
              field: name,
              success: false,
              error: `Could not get element position for: ${ref}`,
            });
            continue;
          }

          // Focus the element first
          await chrome.debugger.sendCommand({ tabId: tab.id }, "DOM.focus", {
            nodeId: await getElementNodeId(tab, elementSelector)
          });

          // Clear existing value by selecting all and deleting
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Control",
            code: "ControlLeft",
            modifiers: 2 // Ctrl
          });
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "a",
            code: "KeyA",
            modifiers: 2 // Ctrl
          });
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "a",
            code: "KeyA",
            modifiers: 2 // Ctrl
          });
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Control",
            code: "ControlLeft",
            modifiers: 0
          });

          // Delete selected content
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Delete",
            code: "Delete"
          });
          await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Delete",
            code: "Delete"
          });

          // Handle different field types
          switch (type) {
            case "textbox":
            case "combobox":
            case "slider":
              // Type the new value
              await typeTextWithDebugger(tab, String(value));
              break;

            case "checkbox":
              // Click to toggle checkbox
              await clickElementWithDebugger(tab, elementPosition);
              break;

            case "radio":
              // Click to select radio button
              await clickElementWithDebugger(tab, elementPosition);
              break;

            default:
              // Type the new value
              await typeTextWithDebugger(tab, String(value));
          }

          results.push({ field: name, success: true, value });

        } catch (error) {
          results.push({ 
            field: field.name, 
            success: false, 
            error: error.message 
          });
        }
      }

      return { success: true, data: results };

    } finally {
      // Detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id });
      } catch (detachError) {
        console.warn("Failed to detach debugger in fillForm:", detachError);
      }
    }

  } catch (error) {
    // Ensure debugger is detached even if there's an error
    try {
      await chrome.debugger.detach({ tabId: tab.id });
    } catch (detachError) {
      console.warn("Failed to detach debugger after error in fillForm:", detachError);
    }
    throw new Error(`Debugger form filling failed: ${error.message}`);
  }
}

// Get element node ID for debugger API
async function getElementNodeId(tab, selector) {
  // Convert selector to XPath if needed
  let xpathQuery = selector;
  if (!selector.startsWith('//') && !selector.startsWith('/')) {
    xpathQuery = await convertSelectorToXPath(tab, selector);
  }

  // Search for the element using XPath
  const searchResult = await chrome.debugger.sendCommand(
    { tabId: tab.id }, 
    "DOM.performSearch", 
    { query: xpathQuery, includeUserAgentShadowDOM: true }
  );

  if (!searchResult.searchId || searchResult.resultCount === 0) {
    throw new Error(`Element not found with selector: ${selector}`);
  }

  // Get the search results
  const searchResults = await chrome.debugger.sendCommand(
    { tabId: tab.id }, 
    "DOM.getSearchResults", 
    { searchId: searchResult.searchId, fromIndex: 0, toIndex: 1 }
  );

  if (!searchResults.nodeIds || searchResults.nodeIds.length === 0) {
    throw new Error(`No node IDs found for selector: ${selector}`);
  }

  return searchResults.nodeIds[0];
}

// Type text using debugger API
async function typeTextWithDebugger(tab, text) {
  for (const char of text) {
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
      type: "keyDown",
      key: char,
      code: getKeyCode(char),
      text: char
    });
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: char,
      code: getKeyCode(char),
      text: char
    });
  }
}

// Click element using debugger API
async function clickElementWithDebugger(tab, position) {
  // Mouse down
  await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: position.x,
    y: position.y,
    button: "left",
    clickCount: 1
  });

  // Mouse up
  await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: position.x,
    y: position.y,
    button: "left",
    clickCount: 1
  });
}

// Get key code for character
function getKeyCode(char) {
  const keyMap = {
    ' ': 'Space',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Escape': 'Escape',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'F1': 'F1',
    'F2': 'F2',
    'F3': 'F3',
    'F4': 'F4',
    'F5': 'F5',
    'F6': 'F6',
    'F7': 'F7',
    'F8': 'F8',
    'F9': 'F9',
    'F10': 'F10',
    'F11': 'F11',
    'F12': 'F12'
  };

  if (keyMap[char]) {
    return keyMap[char];
  }

  // For regular characters, return the character itself
  return char.length === 1 ? `Key${char.toUpperCase()}` : char;
}

// Handle option selection
async function handleSelectOption(tab, params) {
  const { element, ref, values } = params;

  try {
    const element = findElementFromSnapshot(ref);

    if (!element) {
      throw new Error(`Element not found: ${ref}`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (ref, values) => {
        const selectElement = document.evaluate(
          ref,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        )?.singleNodeValue;

        if (!selectElement) {
          throw new Error(`Select element not found: ${ref}`);
        }

        // Clear existing selections
        Array.from(selectElement.options).forEach((option) => {
          option.selected = false;
        });

        // Select specified values
        values.forEach((value) => {
          const option = Array.from(selectElement.options).find(
            (opt) => opt.value === value || opt.textContent === value
          );
          if (option) {
            option.selected = true;
          }
        });

        // Trigger change event
        selectElement.dispatchEvent(new Event("change", { bubbles: true }));

        return { success: true, selectedValues: values };
      },
      args: [element.xpath, values],
    });

    return results[0].result;
  } catch (error) {
    throw new Error(`Option selection failed: ${error.message}`);
  }
}

// Handle key press
async function handlePressKey(tab, params) {
  const { key } = params;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (key) => {
        const keyEvent = new KeyboardEvent("keydown", {
          key: key,
          code: key,
          bubbles: true,
          cancelable: true,
        });

        document.activeElement?.dispatchEvent(keyEvent);

        const keyUpEvent = new KeyboardEvent("keyup", {
          key: key,
          code: key,
          bubbles: true,
          cancelable: true,
        });

        document.activeElement?.dispatchEvent(keyUpEvent);
      },
      args: [key],
    });

    return { success: true, message: `Pressed key: ${key}` };
  } catch (error) {
    throw new Error(`Key press failed: ${error.message}`);
  }
}

// Handle JavaScript evaluation
async function handleEvaluate(tab, params) {
  const { function: func, element, ref } = params;

  try {
    const element = findElementFromSnapshot(ref);

    if (!element) {
      throw new Error(`Element not found: ${ref}`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (func, element, ref) => {
        let targetElement = null;

        if (ref) {
          targetElement = document.evaluate(
            ref,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          )?.singleNodeValue;
        }

        // Create the function and execute it
        const evalFunc = new Function(
          "element",
          "document",
          "window",
          `return (${func})`
        );
        const result = evalFunc(targetElement, document, window);

        return { success: true, result };
      },
      args: [func, element, element.xpath],
    });

    return results[0].result;
  } catch (error) {
    return `Evaluation failed: ${error.message}`;
  }
}

// Handle wait operations
async function handleWaitFor(tab, params) {
  const { time, text, textGone } = params;

  try {
    if (time) {
      await new Promise((resolve) => setTimeout(resolve, time * 1000));
      return { success: true, message: `Waited for ${time} seconds` };
    }

    if (text || textGone) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (text, textGone) => {
          return new Promise((resolve) => {
            const checkText = () => {
              const pageText =
                document.body.textContent || document.body.innerText || "";

              if (text && pageText.includes(text)) {
                resolve({ success: true, message: `Found text: ${text}` });
                return;
              }

              if (textGone && !pageText.includes(textGone)) {
                resolve({ success: true, message: `Text gone: ${textGone}` });
                return;
              }

              setTimeout(checkText, 100);
            };

            checkText();
          });
        },
        args: [text, textGone],
      });

      return results[0].result;
    }

    return { success: true, message: "Wait completed" };
  } catch (error) {
    throw new Error(`Wait failed: ${error.message}`);
  }
}

// Handle file upload
async function handleFileUpload(tab, params) {
  const { paths } = params;

  try {
    // Note: File upload via Chrome extension is limited
    // This is a placeholder implementation
    return {
      success: false,
      error:
        "File upload not directly supported via Chrome extension APIs. Use browser_fill_form with file input elements instead.",
    };
  } catch (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
}

// Handle get by role - find elements by their accessible role and return HTML
async function handleGetByRole(tab, params) {
  const { role, name, options = {} } = params;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (role, name, options) => {
        function getByRole(targetRole, targetName = null, opts = {}) {
          // Get all elements with the specified role
          const elements = document.querySelectorAll(`[role="${targetRole}"]`);

          // If no role attribute, try to find elements by tag name that have implicit roles
          const implicitRoleElements = getElementsByImplicitRole(targetRole);
          const allElements = [...elements, ...implicitRoleElements];

          // Filter by name if provided
          let filteredElements = allElements;
          if (targetName) {
            filteredElements = allElements.filter((el) => {
              const accessibleName = getAccessibleName(el);
              return (
                accessibleName &&
                accessibleName.toLowerCase().includes(targetName.toLowerCase())
              );
            });
          }

          // Apply additional filters from options
          if (opts.hidden === false) {
            filteredElements = filteredElements.filter((el) => {
              const style = window.getComputedStyle(el);
              return style.display !== "none" && style.visibility !== "hidden";
            });
          }

          if (opts.selected !== undefined) {
            filteredElements = filteredElements.filter((el) => {
              return (
                el.getAttribute("aria-selected") === String(opts.selected) ||
                el.selected === opts.selected
              );
            });
          }

          if (opts.checked !== undefined) {
            filteredElements = filteredElements.filter((el) => {
              return (
                el.getAttribute("aria-checked") === String(opts.checked) ||
                el.checked === opts.selected
              );
            });
          }

          // Return HTML of matching elements
          return filteredElements.map((el) => ({
            html: el.outerHTML,
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute("role") || getImplicitRole(el),
            name: getAccessibleName(el),
            id: el.id,
            className: el.className,
            textContent: el.textContent?.trim(),
            attributes: getRelevantAttributes(el),
          }));
        }

        function getElementsByImplicitRole(role) {
          const roleMap = {
            button: ["button"],
            link: ["a"],
            textbox: [
              'input[type="text"]',
              'input[type="email"]',
              'input[type="password"]',
              'input[type="search"]',
              'input[type="tel"]',
              'input[type="url"]',
              "textarea",
            ],
            checkbox: ['input[type="checkbox"]'],
            radio: ['input[type="radio"]'],
            combobox: ["select"],
            listbox: ["select[multiple]"],
            option: ["option"],
            heading: ["h1", "h2", "h3", "h4", "h5", "h6"],
            img: ["img"],
            list: ["ul", "ol"],
            listitem: ["li"],
            table: ["table"],
            row: ["tr"],
            cell: ["td", "th"],
            columnheader: ["th"],
            rowheader: ['th[scope="row"]'],
            grid: ['table[role="grid"]'],
            gridcell: ['td[role="gridcell"]'],
            menuitem: ["menuitem"],
            menubar: ["menubar"],
            menu: ["menu"],
            tab: ['[role="tab"]'],
            tablist: ['[role="tablist"]'],
            tabpanel: ['[role="tabpanel"]'],
            dialog: ["dialog", '[role="dialog"]'],
            alertdialog: ['[role="alertdialog"]'],
            alert: ['[role="alert"]'],
            status: ['[role="status"]'],
            log: ['[role="log"]'],
            marquee: ["marquee"],
            timer: ['[role="timer"]'],
            progressbar: ["progress", '[role="progressbar"]'],
            slider: ['input[type="range"]', '[role="slider"]'],
            spinbutton: ['input[type="number"]', '[role="spinbutton"]'],
            switch: ['[role="switch"]'],
            separator: ["hr", '[role="separator"]'],
            toolbar: ['[role="toolbar"]'],
            tooltip: ['[role="tooltip"]'],
            tree: ['[role="tree"]'],
            treeitem: ['[role="treeitem"]'],
            treegrid: ['[role="treegrid"]'],
            banner: ["header", '[role="banner"]'],
            complementary: ["aside", '[role="complementary"]'],
            contentinfo: ["footer", '[role="contentinfo"]'],
            main: ["main", '[role="main"]'],
            navigation: ["nav", '[role="navigation"]'],
            search: ['[role="search"]'],
            form: ["form"],
            group: ["fieldset", '[role="group"]'],
            region: ["section", '[role="region"]'],
            article: ["article"],
            section: ["section"],
            note: ['[role="note"]'],
            definition: ['[role="definition"]'],
            term: ['[role="term"]'],
            math: ['[role="math"]'],
            figure: ["figure", '[role="figure"]'],
            img: ["img"],
            presentation: ['[role="presentation"]'],
            none: ['[role="none"]'],
            text: [
              "span",
              "div",
              "p",
              "span",
              "em",
              "strong",
              "small",
              "mark",
              "del",
              "ins",
              "sub",
              "sup",
            ],
          };

          const selectors = roleMap[role] || [];
          const elements = [];

          selectors.forEach((selector) => {
            try {
              const found = document.querySelectorAll(selector);
              elements.push(...Array.from(found));
            } catch (e) {
              // Invalid selector, skip
            }
          });

          return elements;
        }

        function getImplicitRole(element) {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();

          if (tagName === "button") return "button";
          if (tagName === "a" && element.href) return "link";
          if (tagName === "input") {
            if (type === "checkbox") return "checkbox";
            if (type === "radio") return "radio";
            if (
              ["text", "email", "password", "search", "tel", "url"].includes(
                type
              )
            )
              return "textbox";
            if (type === "number") return "spinbutton";
            if (type === "range") return "slider";
          }
          if (tagName === "textarea") return "textbox";
          if (tagName === "select")
            return element.multiple ? "listbox" : "combobox";
          if (tagName === "option") return "option";
          if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName))
            return "heading";
          if (tagName === "img") return "img";
          if (tagName === "ul" || tagName === "ol") return "list";
          if (tagName === "li") return "listitem";
          if (tagName === "table") return "table";
          if (tagName === "tr") return "row";
          if (tagName === "td") return "cell";
          if (tagName === "th") return "columnheader";
          if (tagName === "dialog") return "dialog";
          if (tagName === "progress") return "progressbar";
          if (tagName === "hr") return "separator";
          if (tagName === "header") return "banner";
          if (tagName === "footer") return "contentinfo";
          if (tagName === "main") return "main";
          if (tagName === "nav") return "navigation";
          if (tagName === "form") return "form";
          if (tagName === "fieldset") return "group";
          if (tagName === "section") return "region";
          if (tagName === "article") return "article";
          if (tagName === "figure") return "figure";

          return null;
        }

        function getAccessibleName(element) {
          // Check aria-label first
          const ariaLabel = element.getAttribute("aria-label");
          if (ariaLabel) return ariaLabel.trim();

          // Check aria-labelledby
          const labelledBy = element.getAttribute("aria-labelledby");
          if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) return labelElement.textContent?.trim() || "";
          }

          // Check title attribute
          const title = element.getAttribute("title");
          if (title) return title.trim();

          // Check alt attribute for images
          const alt = element.getAttribute("alt");
          if (alt) return alt.trim();

          // Check placeholder for inputs
          const placeholder = element.getAttribute("placeholder");
          if (placeholder) return placeholder.trim();

          // Check value for inputs
          const value = element.value;
          if (value) return value.trim();

          // Check text content
          const textContent = element.textContent?.trim();
          if (textContent) return textContent;

          return "";
        }

        function getRelevantAttributes(element) {
          const relevantAttrs = [
            "id",
            "class",
            "type",
            "name",
            "value",
            "href",
            "src",
            "alt",
            "title",
            "aria-label",
            "aria-labelledby",
            "aria-describedby",
            "aria-expanded",
            "aria-selected",
            "aria-checked",
            "aria-pressed",
            "aria-disabled",
            "aria-hidden",
            "aria-required",
            "aria-invalid",
            "role",
            "tabindex",
            "data-testid",
            "data-cy",
            "data-test",
            "data-qa",
          ];

          const attrs = {};
          relevantAttrs.forEach((attr) => {
            const value = element.getAttribute(attr);
            if (value !== null) {
              attrs[attr] = value;
            }
          });

          return attrs;
        }

        return getByRole(role, name, options);
      },
      args: [role, name, options],
    });

    return {
      success: true,
      data: {
        elements: results[0].result,
        count: results[0].result.length,
        role: role,
        name: name || null,
      },
    };
  } catch (error) {
    throw new Error(`Get by role failed: ${error.message}`);
  }
}
