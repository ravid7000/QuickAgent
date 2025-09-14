// Content script for Chrome extension
let chatWindow = null;
let isVisible = true;
let iframe = null;

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
      const element = this.getElementByRef(params.ref);
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
              const element = document.querySelector(`[data-ref="${elementRef}"]`) || 
                            document.getElementById(elementRef) ||
                            document.querySelector(elementRef);
              if (!element) {
                throw new Error(`Element not found: ${elementRef}`);
              }
              // Execute function with element as parameter using Function constructor
              // This runs in the page context, not content script context
              const func = new Function('element', `return (${functionCode})(element)`);
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
        args: [params.function, params.ref || null]
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

  // browser_file_upload - Upload one or multiple files
  async fileUpload(params) {
    try {
      // This would typically require a file input element
      // For now, we'll create a temporary file input
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = params.paths.length > 1;
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      // Note: In a real implementation, you'd need to handle file paths
      // This is a simplified version
      fileInput.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(fileInput);
      }, 100);

      return {
        success: true,
        data: { action: "file_upload", files: params.paths },
      };
    } catch (error) {
      return { success: false, error: `File upload failed: ${error}` };
    }
  }

  // browser_fill_form - Fill multiple form fields
  async fillForm(params) {
    try {
      const results = [];

      for (const field of params.fields) {
        const element = this.getElementByRef(field.ref);
        if (!element) {
          results.push({
            field: field.name,
            success: false,
            error: "Element not found",
          });
          continue;
        }

        try {
          switch (field.type) {
            case "textbox":
              element.value = field.value;
              element.dispatchEvent(new Event("input", { bubbles: true }));
              break;
            case "checkbox":
              element.checked = field.value;
              element.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            case "radio":
              element.checked = true;
              element.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            case "combobox":
              element.value = field.value;
              element.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            case "slider":
              element.value = field.value;
              element.dispatchEvent(new Event("input", { bubbles: true }));
              break;
          }
          results.push({ field: field.name, success: true });
        } catch (fieldError) {
          results.push({
            field: field.name,
            success: false,
            error: fieldError,
          });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: `Form filling failed: ${error}` };
    }
  }

  // browser_navigate - Navigate to a URL
  async navigate(params) {
    try {
      window.location.href = params.url;
      return { success: true, data: { action: "navigate", url: params.url } };
    } catch (error) {
      return { success: false, error: `Navigation failed: ${error}` };
    }
  }

  // browser_navigate_back - Go back to the previous page
  async navigateBack() {
    try {
      window.history.back();
      return { success: true, data: { action: "navigate_back" } };
    } catch (error) {
      return { success: false, error: `Navigate back failed: ${error}` };
    }
  }

  // browser_press_key - Press a key on the keyboard
  async pressKey(params) {
    try {
      const event = new KeyboardEvent("keydown", {
        key: params.key,
        code: this.getKeyCode(params.key),
        bubbles: true,
      });

      document.dispatchEvent(event);

      // Also dispatch keyup
      const keyupEvent = new KeyboardEvent("keyup", {
        key: params.key,
        code: this.getKeyCode(params.key),
        bubbles: true,
      });
      document.dispatchEvent(keyupEvent);

      return { success: true, data: { action: "press_key", key: params.key } };
    } catch (error) {
      return { success: false, error: `Key press failed: ${error}` };
    }
  }

  // browser_select_option - Select an option in a dropdown
  async selectOption(params) {
    try {
      const element = this.getElementByRef(params.ref);
      if (!element) {
        return {
          success: false,
          error: `Element not found: ${params.element}`,
        };
      }

      // Clear existing selections
      Array.from(element.options).forEach((option) => {
        option.selected = false;
      });

      // Select the specified values
      params.values.forEach((value) => {
        const option = Array.from(element.options).find(
          (opt) => opt.value === value || opt.text === value
        );
        if (option) {
          option.selected = true;
        }
      });

      // Trigger change event
      element.dispatchEvent(new Event("change", { bubbles: true }));

      return {
        success: true,
        data: { action: "select_option", values: params.values },
      };
    } catch (error) {
      return { success: false, error: `Select option failed: ${error}` };
    }
  }

  // browser_snapshot - Capture accessibility snapshot of the current page
  async snapshot() {
    try {
      const snapshot = {
        url: window.location.href,
        title: document.title,
        elements:
          this.getAccessibilitySnapshot(document.body),
      };

      return { success: true, data: snapshot };
    } catch (error) {
      return { success: false, error: `Snapshot failed: ${error}` };
    }
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

  getKeyCode(key) {
    // Map common keys to their codes
    const keyMap = {
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      Enter: "Enter",
      Escape: "Escape",
      Tab: "Tab",
      Backspace: "Backspace",
      Delete: "Delete",
      Space: "Space",
    };

    return keyMap[key] || key;
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
  console.log('Content script received message:', request);

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
    console.log('Ping received, responding...');
    sendResponse({ success: true, message: "Content script is ready" });
  }

  // Handle browser actions
  if (request.action === "browserAction") {
    console.log('Processing browser action:', request.function);
    
    // Return true to indicate we'll respond asynchronously
    handleBrowserAction(request).then(sendResponse).catch(error => {
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
      console.log('Taking snapshot...');
      result = await browserActions.snapshot();
      console.log('Snapshot result:', result);
      if (result.success) {
        // Convert to tree string for better LLM understanding
        // const treeString = browserActions.convertSnapshotToTreeString(result.data);
        result.data = JSON.stringify(result.data, null);
        console.log('Tree string generated:', result.data);
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

  console.log('Sending response:', result);
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
