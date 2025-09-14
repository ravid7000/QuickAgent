// Browser Actions Service - Implements all browser automation functions
// Based on the definitions in browserActions.md

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ClickParams {
  element: string;
  ref: string;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
}

export interface EvaluateParams {
  function: string;
  element?: string;
  ref?: string;
}

// Chrome scripting API types
interface ChromeScripting {
  executeScript: (options: {
    target: { tabId: number };
    func: (...args: unknown[]) => unknown;
    args?: unknown[];
  }) => Promise<Array<{ result: unknown }>>;
}

interface ChromeAPI {
  tabs: {
    query: (queryInfo: { active: boolean; currentWindow: boolean }) => Promise<Array<{ id?: number }>>;
  };
  scripting: ChromeScripting;
}

export interface FileUploadParams {
  paths: string[];
}

export interface FormField {
  name: string;
  type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
  ref: string;
  value: string | boolean;
}

export interface FillFormParams {
  fields: FormField[];
}

export interface NavigateParams {
  url: string;
}

export interface PressKeyParams {
  key: string;
}

export interface SelectOptionParams {
  element: string;
  ref: string;
  values: string[];
}

export interface WaitForParams {
  time?: number;
  text?: string;
  textGone?: string;
}

class BrowserActionsService {
  private static instance: BrowserActionsService;

  static getInstance(): BrowserActionsService {
    if (!BrowserActionsService.instance) {
      BrowserActionsService.instance = new BrowserActionsService();
    }
    return BrowserActionsService.instance;
  }

  // browser_click - Perform click on a web page
  async click(params: ClickParams): Promise<BrowserActionResult> {
    try {
      const element = this.getElementByRef(params.ref);
      if (!element) {
        return { success: false, error: `Element not found: ${params.element}` };
      }

      const event = new MouseEvent(params.doubleClick ? 'dblclick' : 'click', {
        button: this.getButtonCode(params.button || 'left'),
        ctrlKey: params.modifiers?.includes('Control') || false,
        altKey: params.modifiers?.includes('Alt') || false,
        shiftKey: params.modifiers?.includes('Shift') || false,
        metaKey: params.modifiers?.includes('Meta') || false
      });

      element.dispatchEvent(event);
      return { success: true, data: { action: 'click', element: params.element } };
    } catch (error) {
      return { success: false, error: `Click failed: ${error}` };
    }
  }

  // browser_evaluate - Evaluate JavaScript expression on page or element using Chrome scripting API
  async evaluate(params: EvaluateParams): Promise<BrowserActionResult> {
    try {
      // Get current tab ID
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return { success: false, error: "No active tab found" };
      }

      // Use Chrome scripting API to execute code in the page context
      const results = await (chrome as unknown as ChromeAPI).scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (functionCode: unknown, elementRef: unknown) => {
          const funcCode = functionCode as string;
          const elementRefStr = elementRef as string | null;
          try {
            // If elementRef is provided, find the element first
            if (elementRefStr) {
              const element = document.querySelector(`[data-ref="${elementRefStr}"]`) || 
                            document.getElementById(elementRefStr) ||
                            document.querySelector(elementRefStr);
              if (!element) {
                throw new Error(`Element not found: ${elementRefStr}`);
              }
              // Execute function with element as parameter using Function constructor
              // This runs in the page context, not content script context
              const func = new Function('element', `return (${funcCode})(element)`);
              return func(element);
            } else {
              // Execute function in global context
              const func = new Function(`return (${funcCode})()`);
              return func();
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Evaluation failed: ${errorMessage}`);
          }
        },
        args: [params.function, params.ref || null]
      });

      if (results && results[0] && results[0].result !== undefined) {
        return { success: true, data: results[0].result };
      } else {
        return { success: false, error: "No result returned from evaluation" };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Evaluation failed: ${errorMessage}` };
    }
  }

  // browser_file_upload - Upload one or multiple files
  async fileUpload(params: FileUploadParams): Promise<BrowserActionResult> {
    try {
      // This would typically require a file input element
      // For now, we'll create a temporary file input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = params.paths.length > 1;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      // Note: In a real implementation, you'd need to handle file paths
      // This is a simplified version
      fileInput.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(fileInput);
      }, 100);

      return { success: true, data: { action: 'file_upload', files: params.paths } };
    } catch (error) {
      return { success: false, error: `File upload failed: ${error}` };
    }
  }

  // browser_fill_form - Fill multiple form fields
  async fillForm(params: FillFormParams): Promise<BrowserActionResult> {
    try {
      const results = [];
      
      for (const field of params.fields) {
        const element = this.getElementByRef(field.ref);
        if (!element) {
          results.push({ field: field.name, success: false, error: 'Element not found' });
          continue;
        }

        try {
          switch (field.type) {
            case 'textbox':
              (element as HTMLInputElement).value = field.value as string;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              break;
            case 'checkbox':
              (element as HTMLInputElement).checked = field.value as boolean;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            case 'radio':
              (element as HTMLInputElement).checked = true;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            case 'combobox':
              (element as HTMLSelectElement).value = field.value as string;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            case 'slider':
              (element as HTMLInputElement).value = field.value as string;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              break;
          }
          results.push({ field: field.name, success: true });
        } catch (fieldError) {
          results.push({ field: field.name, success: false, error: fieldError });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: `Form filling failed: ${error}` };
    }
  }

  // browser_navigate - Navigate to a URL
  async navigate(params: NavigateParams): Promise<BrowserActionResult> {
    try {
      window.location.href = params.url;
      return { success: true, data: { action: 'navigate', url: params.url } };
    } catch (error) {
      return { success: false, error: `Navigation failed: ${error}` };
    }
  }

  // browser_navigate_back - Go back to the previous page
  async navigateBack(): Promise<BrowserActionResult> {
    try {
      window.history.back();
      return { success: true, data: { action: 'navigate_back' } };
    } catch (error) {
      return { success: false, error: `Navigate back failed: ${error}` };
    }
  }

  // browser_press_key - Press a key on the keyboard
  async pressKey(params: PressKeyParams): Promise<BrowserActionResult> {
    try {
      const event = new KeyboardEvent('keydown', {
        key: params.key,
        code: this.getKeyCode(params.key),
        bubbles: true
      });
      
      document.dispatchEvent(event);
      
      // Also dispatch keyup
      const keyupEvent = new KeyboardEvent('keyup', {
        key: params.key,
        code: this.getKeyCode(params.key),
        bubbles: true
      });
      document.dispatchEvent(keyupEvent);

      return { success: true, data: { action: 'press_key', key: params.key } };
    } catch (error) {
      return { success: false, error: `Key press failed: ${error}` };
    }
  }

  // browser_select_option - Select an option in a dropdown
  async selectOption(params: SelectOptionParams): Promise<BrowserActionResult> {
    try {
      const element = this.getElementByRef(params.ref);
      if (!element) {
        return { success: false, error: `Element not found: ${params.element}` };
      }

      const selectElement = element as HTMLSelectElement;
      
      // Clear existing selections
      Array.from(selectElement.options).forEach(option => {
        option.selected = false;
      });

      // Select the specified values
      params.values.forEach(value => {
        const option = Array.from(selectElement.options).find(opt => 
          opt.value === value || opt.text === value
        );
        if (option) {
          option.selected = true;
        }
      });

      // Trigger change event
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, data: { action: 'select_option', values: params.values } };
    } catch (error) {
      return { success: false, error: `Select option failed: ${error}` };
    }
  }

  // browser_snapshot - Capture accessibility snapshot of the current page
  async snapshot(): Promise<BrowserActionResult> {
    try {
      const snapshot = {
        url: window.location.href,
        title: document.title,
        elements: this.getAccessibilitySnapshot(document.body)
      };

      return { success: true, data: snapshot };
    } catch (error) {
      return { success: false, error: `Snapshot failed: ${error}` };
    }
  }

  // browser_wait_for - Wait for text to appear or disappear or a specified time to pass
  async waitFor(params: WaitForParams): Promise<BrowserActionResult> {
    try {
      if (params.time) {
        await new Promise(resolve => setTimeout(resolve, (params.time || 0) * 1000));
        return { success: true, data: { action: 'wait', time: params.time } };
      }

      if (params.text) {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          if (document.body.textContent?.includes(params.text)) {
            return { success: true, data: { action: 'wait_for_text', text: params.text } };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { success: false, error: `Text not found within timeout: ${params.text}` };
      }

      if (params.textGone) {
        const maxWait = 10000; // 10 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          if (!document.body.textContent?.includes(params.textGone)) {
            return { success: true, data: { action: 'wait_for_text_gone', text: params.textGone } };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { success: false, error: `Text still present after timeout: ${params.textGone}` };
      }

      return { success: false, error: 'No valid wait parameters provided' };
    } catch (error) {
      return { success: false, error: `Wait failed: ${error}` };
    }
  }

  // Helper methods
  private getElementByRef(ref: string): Element | null {
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
      console.error('Error finding element:', error);
      return null;
    }
  }

  private getButtonCode(button: string): number {
    switch (button) {
      case 'left': return 0;
      case 'middle': return 1;
      case 'right': return 2;
      default: return 0;
    }
  }

  private getKeyCode(key: string): string {
    // Map common keys to their codes
    const keyMap: { [key: string]: string } = {
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Space': 'Space'
    };
    
    return keyMap[key] || key;
  }

  private getAccessibilitySnapshot(element: Element): Array<{
    tag: string;
    text: string;
    attributes: Record<string, string | null>;
    position: { x: number; y: number; width: number; height: number };
    ref: string;
  }> {
    const elements: Array<{
      tag: string;
      text: string;
      attributes: Record<string, string | null>;
      position: { x: number; y: number; width: number; height: number };
      ref: string;
    }> = [];
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const el = node as Element;
          if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node as Element;
      const rect = el.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        elements.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().substring(0, 100) || '',
          attributes: {
            id: el.id,
            class: el.className,
            type: el.getAttribute('type'),
            role: el.getAttribute('role'),
            'aria-label': el.getAttribute('aria-label')
          },
          position: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          ref: el.id || `element-${elements.length}`
        });
      }
    }

    return elements;
  }
}

export default BrowserActionsService;
