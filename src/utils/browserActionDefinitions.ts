// Browser Action Definitions - Helper for AI to understand available actions
export const BROWSER_ACTION_DEFINITIONS = {
  browser_click: {
    title: "Click",
    description: "Perform click on a web page",
    parameters: {
      element: "string - Human-readable element description",
      ref: "string - Exact target element reference from the page snapshot",
      doubleClick: "boolean (optional) - Whether to perform a double click",
      button: "string (optional) - Button to click, defaults to left",
      modifiers: "array (optional) - Modifier keys to press"
    },
    example: {
      function: "browser_click",
      params: {
        element: "Submit button",
        ref: "submit-btn",
        doubleClick: false,
        button: "left"
      }
    }
  },
  browser_evaluate: {
    title: "Evaluate JavaScript",
    description: "Evaluate JavaScript expression on page or element",
    parameters: {
      function: "string - () => { /* code */ } or (element) => { /* code */ } when element is provided",
      element: "string (optional) - Human-readable element description",
      ref: "string (optional) - Exact target element reference from the page snapshot"
    },
    example: {
      function: "browser_evaluate",
      params: {
        function: "() => document.title",
        element: "Page title",
        ref: "document"
      }
    }
  },
  browser_file_upload: {
    title: "Upload files",
    description: "Upload one or multiple files",
    parameters: {
      paths: "array - The absolute paths to the files to upload"
    },
    example: {
      function: "browser_file_upload",
      params: {
        paths: ["/path/to/file1.jpg", "/path/to/file2.pdf"]
      }
    }
  },
  browser_fill_form: {
    title: "Fill form",
    description: "Fill multiple form fields",
    parameters: {
      fields: "array - Fields to fill in, each with name, type, ref, and value"
    },
    example: {
      function: "browser_fill_form",
      params: {
        fields: [
          {
            name: "Email field",
            type: "textbox",
            ref: "email-input",
            value: "user@example.com"
          },
          {
            name: "Terms checkbox",
            type: "checkbox",
            ref: "terms-checkbox",
            value: true
          }
        ]
      }
    }
  },
  browser_navigate: {
    title: "Navigate to a URL",
    description: "Navigate to a URL",
    parameters: {
      url: "string - The URL to navigate to"
    },
    example: {
      function: "browser_navigate",
      params: {
        url: "https://example.com"
      }
    }
  },
  browser_navigate_back: {
    title: "Go back",
    description: "Go back to the previous page",
    parameters: {},
    example: {
      function: "browser_navigate_back",
      params: {}
    }
  },
  browser_press_key: {
    title: "Press a key",
    description: "Press a key on the keyboard",
    parameters: {
      key: "string - Name of the key to press or a character to generate"
    },
    example: {
      function: "browser_press_key",
      params: {
        key: "Enter"
      }
    }
  },
  browser_select_option: {
    title: "Select option",
    description: "Select an option in a dropdown",
    parameters: {
      element: "string - Human-readable element description",
      ref: "string - Exact target element reference from the page snapshot",
      values: "array - Array of values to select in the dropdown"
    },
    example: {
      function: "browser_select_option",
      params: {
        element: "Country dropdown",
        ref: "country-select",
        values: ["US"]
      }
    }
  },
  browser_snapshot: {
    title: "Page snapshot",
    description: "Capture accessibility snapshot of the current page",
    parameters: {},
    example: {
      function: "browser_snapshot",
      params: {}
    }
  },
  browser_wait_for: {
    title: "Wait for",
    description: "Wait for text to appear or disappear or a specified time to pass",
    parameters: {
      time: "number (optional) - The time to wait in seconds",
      text: "string (optional) - The text to wait for",
      textGone: "string (optional) - The text to wait for to disappear"
    },
    example: {
      function: "browser_wait_for",
      params: {
        time: 5
      }
    }
  }
};

export function getBrowserActionPrompt(): string {
  return `You are an AI assistant with access to browser automation functions. You can interact with web pages by using these functions.

**IMPORTANT LOOP BEHAVIOR:**
- After executing browser actions, the system will automatically call you again with the results
- You can continue the conversation by providing more actions or responses
- To continue the loop, simply provide more browser actions or a response
- To end the loop, provide a final response without any browser actions
- The system will keep calling you until you provide a response without browser actions

**Available Browser Functions:**

${Object.entries(BROWSER_ACTION_DEFINITIONS).map(([key, def]) => `
**${def.title}** (${key})
${def.description}
Parameters: ${JSON.stringify(def.parameters, null, 2)}
Example: ${JSON.stringify(def.example, null, 2)}
`).join('\n')}

Remember to always call browser_snapshot function before executing any other function to get the current state of the page.

**Usage:**
To use these functions, include a JSON object in your response like this:
{"function": "browser_click", "params": {"element": "Submit button", "ref": "submit-btn"}}

The system will automatically execute these actions and replace the JSON with the result, then call you again with the updated context.

**Loop Control:**
- If you want to continue with more actions, include them in your response
- If you want to end the conversation, provide a final response without any browser action JSON objects
- You can mix regular text responses with browser actions
`;
}

export function validateBrowserAction(action: unknown): { valid: boolean; error?: string } {
  if (!action || typeof action !== 'object') {
    return { valid: false, error: 'Action must be an object' };
  }

  const actionObj = action as Record<string, unknown>;
  
  if (!actionObj.function || typeof actionObj.function !== 'string') {
    return { valid: false, error: 'Action must have a function property' };
  }

  if (!actionObj.function.startsWith('browser_')) {
    return { valid: false, error: 'Function must start with "browser_"' };
  }

  if (!BROWSER_ACTION_DEFINITIONS[actionObj.function as keyof typeof BROWSER_ACTION_DEFINITIONS]) {
    return { valid: false, error: `Unknown function: ${actionObj.function}` };
  }

  if (!actionObj.params || typeof actionObj.params !== 'object') {
    return { valid: false, error: 'Action must have a params property' };
  }

  return { valid: true };
}
