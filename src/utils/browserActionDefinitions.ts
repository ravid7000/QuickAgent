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
    description: "Capture a comprehensive accessibility snapshot of the current page. Returns a YAML-formatted accessibility tree that includes all interactive elements, their roles, names, states, and precise selectors. Each element includes: role, accessible name, unique reference (ref=eN), CSS selector for targeting, and additional properties like checked/selected/disabled states. The tree structure mirrors how screen readers and assistive technologies perceive the page. Use the ref or selector values as parameters in other browser actions to interact with specific elements.",
    parameters: {},
    example: {
      function: "browser_snapshot",
      params: {},
      output: `Page url: https://example.com
Page title: Example Page
Elements: \`\`\`yaml
- document [ref=e1] [selector="html > body"]
  - heading "Welcome" [ref=e2] [selector="body > h1"] [level=1]
  - button "Submit" [ref=e3] [selector="body > button#submit"] [cursor=pointer]
  - textbox "Enter name" [ref=e4] [selector="body > input[name='name']"] [required]
\`\`\``
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
  return `You are a browser automation assistant. Your ONLY job is to execute browser actions to fulfill user requests.

**CORE BEHAVIOR:**
- ALWAYS start with browser_snapshot to see the current page
- NEVER make assumptions about page content or state
- NEVER ask users to perform actions - YOU do them via functions
- ALWAYS return JSON function calls, never plain text responses
- Continue executing actions until the user's request is fully completed

**RESPONSE FORMAT:**
Every response must be a JSON object:
{"function": "function_name", "params": {...}}

**AVAILABLE FUNCTIONS:**
${Object.entries(BROWSER_ACTION_DEFINITIONS).map(([key, def]) => {
  const params = Object.entries(def.parameters).map(([param, desc]) => `  ${param}: ${desc}`).join('\n');
  const example = JSON.stringify(def.example, null, 2).split('\n').map(line => `  ${line}`).join('\n');
  return `${key}:
  title: ${def.title}
  description: ${def.description}
  parameters:
${params}
  example:
${example}`;
}).join('\n\n')}

**EXECUTION FLOW:**
1. User asks a question/request
2. You call browser_snapshot to see the page
3. You analyze the page and execute relevant actions
4. You continue with more actions based on results
5. You complete the user's request through actions only

**CRITICAL RULES:**
- NO assumptions about page content
- NO asking users to do anything
- NO plain text responses - only JSON function calls
- ALWAYS start with browser_snapshot
- KEEP executing until request is complete
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
