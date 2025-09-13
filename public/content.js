// Content script for Chrome extension
let chatWindow = null;
let isVisible = true;
let iframe = null;

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
  if (request.action === "toggleChat") {
    toggleChat();
    sendResponse({ success: true });
  }

  if (request.action === "updateStyles" && request.styles) {
    Object.entries(request.styles).forEach(([key, value]) => {
      iframe.style[key] = value;
    });
  }
});

// Keyboard shortcut listener (Ctrl+Shift+A)
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key === "A") {
    event.preventDefault();
    toggleChat();
  }
});

// Initialize
createChatWindow();
