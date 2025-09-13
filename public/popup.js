document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleChat');
  
  toggleButton.addEventListener('click', async function() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to toggle the chat
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleChat' });
      
      // Close the popup
      window.close();
    } catch (error) {
      console.error('Error toggling chat:', error);
    }
  });
});
