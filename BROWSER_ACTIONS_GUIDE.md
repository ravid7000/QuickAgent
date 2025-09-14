# Browser Actions Implementation Guide

This Chrome extension now supports browser automation through AI chat. The AI can execute various browser actions by including JSON objects in its responses.

## How It Works

1. **AI Response Processing**: When the AI responds with text containing JSON objects that match browser action patterns, the system automatically detects and executes them.

2. **Action Execution**: The browser actions are executed in the content script context, allowing interaction with the current webpage.

3. **Result Feedback**: The JSON objects are replaced with success/failure messages in the chat.

## Available Browser Actions

### 1. Click (`browser_click`)
Click on any element on the page.

```json
{
  "function": "browser_click",
  "params": {
    "element": "Submit button",
    "ref": "submit-btn",
    "doubleClick": false,
    "button": "left",
    "modifiers": ["Control"]
  }
}
```

### 2. Evaluate JavaScript (`browser_evaluate`)
Execute JavaScript code on the page or specific element.

```json
{
  "function": "browser_evaluate",
  "params": {
    "function": "() => document.title",
    "element": "Page title",
    "ref": "document"
  }
}
```

### 3. File Upload (`browser_file_upload`)
Upload files to the page.

```json
{
  "function": "browser_file_upload",
  "params": {
    "paths": ["/path/to/file1.jpg", "/path/to/file2.pdf"]
  }
}
```

### 4. Fill Form (`browser_fill_form`)
Fill multiple form fields at once.

```json
{
  "function": "browser_fill_form",
  "params": {
    "fields": [
      {
        "name": "Email field",
        "type": "textbox",
        "ref": "email-input",
        "value": "user@example.com"
      },
      {
        "name": "Terms checkbox",
        "type": "checkbox",
        "ref": "terms-checkbox",
        "value": true
      }
    ]
  }
}
```

### 5. Navigate (`browser_navigate`)
Navigate to a different URL.

```json
{
  "function": "browser_navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

### 6. Navigate Back (`browser_navigate_back`)
Go back to the previous page.

```json
{
  "function": "browser_navigate_back",
  "params": {}
}
```

### 7. Press Key (`browser_press_key`)
Simulate keyboard input.

```json
{
  "function": "browser_press_key",
  "params": {
    "key": "Enter"
  }
}
```

### 8. Select Option (`browser_select_option`)
Select options in dropdown menus.

```json
{
  "function": "browser_select_option",
  "params": {
    "element": "Country dropdown",
    "ref": "country-select",
    "values": ["US"]
  }
}
```

### 9. Snapshot (`browser_snapshot`)
Capture an accessibility snapshot of the current page.

```json
{
  "function": "browser_snapshot",
  "params": {}
}
```

### 10. Wait For (`browser_wait_for`)
Wait for specific conditions.

```json
{
  "function": "browser_wait_for",
  "params": {
    "time": 5,
    "text": "Loading complete",
    "textGone": "Please wait"
  }
}
```

## Element References

The system supports multiple ways to reference elements:

1. **ID**: `"ref": "my-button"`
2. **CSS Selector**: `"ref": ".submit-button"`
3. **Data Attribute**: `"ref": "data-ref='submit-btn'"`
4. **Generated Reference**: Elements without IDs get auto-generated refs like `element-0`, `element-1`, etc.

## Form Field Types

- `textbox`: Text input fields
- `checkbox`: Checkboxes
- `radio`: Radio buttons
- `combobox`: Dropdown/select elements
- `slider`: Range/slider inputs

## Error Handling

The system includes comprehensive error handling:

- **Validation**: Actions are validated before execution
- **Timeout**: Actions have a 10-second timeout
- **Content Script Check**: Verifies content script is available
- **Element Finding**: Multiple fallback methods for element selection
- **User Feedback**: Clear success/error messages in chat

## Usage Examples

### Example 1: Fill out a contact form
```
User: "Fill out the contact form with my email john@example.com and check the newsletter box"

AI Response: I'll help you fill out the contact form. {"function": "browser_fill_form", "params": {"fields": [{"name": "Email field", "type": "textbox", "ref": "email", "value": "john@example.com"}, {"name": "Newsletter checkbox", "type": "checkbox", "ref": "newsletter", "value": true}]}}
```

### Example 2: Navigate and take a snapshot
```
User: "Go to google.com and take a snapshot of the page"

AI Response: I'll navigate to Google and take a snapshot. {"function": "browser_navigate", "params": {"url": "https://google.com"}} {"function": "browser_snapshot", "params": {}}
```

### Example 3: Click a button and wait
```
User: "Click the submit button and wait for the success message"

AI Response: I'll click submit and wait for confirmation. {"function": "browser_click", "params": {"element": "Submit button", "ref": "submit-btn"}} {"function": "browser_wait_for", "params": {"text": "Success"}}
```

## Technical Implementation

### Files Modified/Created:

1. **`src/services/browserActions.ts`** - TypeScript service with all browser action implementations
2. **`src/services/browserActionService.ts`** - Service for communicating with content script
3. **`src/utils/browserActionDefinitions.ts`** - Action definitions and validation
4. **`public/content.js`** - Updated content script with browser action handlers
5. **`src/components/AIChat.tsx`** - Updated to process and execute browser actions
6. **`public/manifest.json`** - Added scripting permission

### Architecture:

```
AI Chat Component
    ↓
Browser Action Service
    ↓
Chrome Extension API
    ↓
Content Script
    ↓
Browser Actions Service
    ↓
DOM Manipulation
```

## Security Considerations

- Actions are executed in the content script context
- No external network requests are made
- All actions are validated before execution
- Timeout protection prevents hanging operations
- Error handling prevents crashes

## Future Enhancements

- Screenshot capture capability
- More advanced element selection methods
- Action recording and playback
- Batch operation support
- Custom action definitions
