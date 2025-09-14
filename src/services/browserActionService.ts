// Browser Action Service - Handles communication with content script
import { type BrowserActionResult } from './browserActions';
import { validateBrowserAction } from '@/utils/browserActionDefinitions';

export interface BrowserActionRequest {
  function: string;
  params: Record<string, unknown>;
}

class BrowserActionService {
  private static instance: BrowserActionService;

  static getInstance(): BrowserActionService {
    if (!BrowserActionService.instance) {
      BrowserActionService.instance = new BrowserActionService();
    }
    return BrowserActionService.instance;
  }

  async executeBrowserAction(request: BrowserActionRequest): Promise<BrowserActionResult> {
    try {
      // Validate the browser action
      const validation = validateBrowserAction(request);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        return { success: false, error: 'No active tab found' };
      }

      // Check if content script is available
      // try {
      //   await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // } catch (error) {
      //   return { 
      //     success: false, 
      //     error: 'Content script not available. Please refresh the page and try again.' 
      //   };
      // }

      // Send message to content script with timeout
      // const response = await Promise.race([
      //   chrome.tabs.sendMessage(tab.id, {
      //     action: 'browserAction',
      //     function: request.function,
      //     params: request.params
      //   }),
      //   new Promise((_, reject) => 
      //     setTimeout(() => reject(new Error('Action timeout')), 1000)
      //   )
      // ]);

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'browserAction',
        function: request.function,
        params: request.params
      });

      console.log('execute action response', {response})

      return response as BrowserActionResult;
    } catch (error) {
      console.error('Browser action error:', error);
      return { 
        success: false, 
        error: `Failed to execute browser action: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  // Convenience methods for each browser action
  async click(element: string, ref: string, options?: {
    doubleClick?: boolean;
    button?: 'left' | 'right' | 'middle';
    modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
  }): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_click',
      params: {
        element,
        ref,
        ...options
      }
    });
  }

  async evaluate(functionCode: string, element?: string, ref?: string): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_evaluate',
      params: {
        function: functionCode,
        element,
        ref
      }
    });
  }

  async fileUpload(paths: string[]): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_file_upload',
      params: { paths }
    });
  }

  async fillForm(fields: Array<{
    name: string;
    type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
    ref: string;
    value: string | boolean;
  }>): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_fill_form',
      params: { fields }
    });
  }

  async navigate(url: string): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_navigate',
      params: { url }
    });
  }

  async navigateBack(): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_navigate_back',
      params: {}
    });
  }

  async pressKey(key: string): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_press_key',
      params: { key }
    });
  }

  async selectOption(element: string, ref: string, values: string[]): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_select_option',
      params: {
        element,
        ref,
        values
      }
    });
  }

  async snapshot(): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_snapshot',
      params: {}
    });
  }

  async waitFor(options: {
    time?: number;
    text?: string;
    textGone?: string;
  }): Promise<BrowserActionResult> {
    return this.executeBrowserAction({
      function: 'browser_wait_for',
      params: options
    });
  }
}

export default BrowserActionService;
