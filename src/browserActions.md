- **browser_click**
  - Title: Click
  - Description: Perform click on a web page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `doubleClick` (boolean, optional): Whether to perform a double click instead of a single click
    - `button` (string, optional): Button to click, defaults to left
    - `modifiers` (array, optional): Modifier keys to press
  - Read-only: **false**


- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element
  - Parameters:
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string, optional): Exact target element reference from the page snapshot
  - Read-only: **false**


- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array): The absolute paths to the files to upload. Can be a single file or multiple files.
  - Read-only: **false**


- **browser_fill_form**
  - Title: Fill form
  - Description: Fill multiple form fields
  - Parameters:
    - `fields` (array): Fields to fill in
  - Read-only: **false**



- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
  - Read-only: **false**


- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to the previous page
  - Parameters: None
  - Read-only: **true**



- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
  - Read-only: **false**


- **browser_select_option**
  - Title: Select option
  - Description: Select an option in a dropdown
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
  - Read-only: **false**


- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters: None
  - Read-only: **true**


- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
  - Read-only: **true**
