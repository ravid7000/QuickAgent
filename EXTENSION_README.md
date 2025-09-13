# Quick Agent AI Chat - Chrome Extension

A Chrome extension that provides an AI chat assistant as a floating window on any website.

## Features

- 🤖 AI chat assistant that appears as a hovering window
- 🎯 Works on any website without interfering with page functionality
- ⌨️ Keyboard shortcut: `Ctrl+Shift+A` to toggle the chat
- 🎨 Modern, responsive UI with Tailwind CSS
- 🔒 Secure content script implementation

## Installation

### Development Build

1. **Build the extension:**
   ```bash
   npm run build:extension
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

3. **Test the extension:**
   - Visit any website
   - Click the extension icon in the toolbar, or
   - Use the keyboard shortcut `Ctrl+Shift+A`

## Usage

### Toggle the Chat
- **Extension Icon**: Click the Quick Agent icon in the Chrome toolbar
- **Keyboard Shortcut**: Press `Ctrl+Shift+A` on any page
- **Close Button**: Click the × button in the chat window header

### Chat Features
- Ask questions and get AI responses
- The chat window floats above page content
- Responsive design that works on different screen sizes
- Clean, modern interface that doesn't interfere with the website

## File Structure

```
dist/                          # Built extension files
├── manifest.json             # Extension manifest
├── popup.html                # Extension popup
├── popup.js                  # Popup functionality
├── content.js                # Content script for floating window
├── content.css               # Content script styles
├── index.html                # Main React app
└── assets/                   # Built React assets

public/                       # Source files for extension
├── manifest.json             # Extension configuration
├── popup.html                # Popup interface
├── popup.js                  # Popup logic
├── content.js                # Content script
└── content.css               # Content script styles
```

## Development

### Building
```bash
# Build React app and copy extension files
npm run build:extension

# Or build separately
npm run build
node build-extension.js
```

### Development Server
```bash
# Run React app in development mode
npm run dev
```

## Technical Details

### Content Script
- Injects a floating iframe containing the React app
- Positioned fixed in top-right corner
- High z-index to appear above page content
- Responsive design for mobile devices

### React App
- Modified to work as content script
- Full-height layout for iframe embedding
- Uses existing Chat component with all features
- Tailwind CSS for styling

### Extension Permissions
- `activeTab`: Access to current tab
- `storage`: Store user preferences
- `host_permissions`: Work on all websites

## Customization

### Styling
- Modify `src/index.css` for React app styles
- Modify `public/content.css` for floating window styles
- Update `public/content.js` for positioning and behavior

### Features
- Add new chat features in `src/components/ui/ai/`
- Modify keyboard shortcuts in `public/content.js`
- Update popup interface in `public/popup.html`

## Troubleshooting

### Chat Not Appearing
- Check if extension is enabled in `chrome://extensions/`
- Try refreshing the page
- Check browser console for errors

### Styling Issues
- Ensure Tailwind CSS is properly built
- Check if content script CSS is loading
- Verify iframe dimensions in content script

### Build Issues
- Run `npm install` to ensure dependencies are installed
- Check that all files in `public/` exist
- Verify Vite build configuration

## Security Notes

- Content script runs in isolated world
- No access to page's JavaScript variables
- Communication through Chrome extension APIs only
- Safe to use on any website
