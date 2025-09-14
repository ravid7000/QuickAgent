// Background script for Chrome extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAccessibilityTree') {
    getAccessibilityTree(sender.tab.id)
      .then(tree => sendResponse({ success: true, data: tree }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'getElementByAccessibilityRef') {
    getElementByAccessibilityRef(sender.tab.id, request.ref)
      .then(element => sendResponse({ success: true, element: element }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }

  // Navigation actions
  if (request.action === 'browser_navigate') {
    navigateToUrl(sender.tab.id, request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'browser_navigate_back') {
    navigateBack(sender.tab.id)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Keyboard actions
  if (request.action === 'browser_press_key') {
    pressKey(sender.tab.id, request.key)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // File upload actions
  if (request.action === 'browser_file_upload') {
    handleFileUpload(sender.tab.id, request.paths)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function getAccessibilityTree(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId: tabId }, "1.0", function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // First get the accessibility tree
      chrome.debugger.sendCommand(
        { tabId: tabId }, 
        "Accessibility.getFullAXTree", 
        {}, 
        function(axResult) {
          if (chrome.runtime.lastError) {
            chrome.debugger.detach({ tabId: tabId });
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // Then get DOM information for each node
          getDOMInfoForAXNodes(tabId, axResult)
            .then(enhancedResult => {
              chrome.debugger.detach({ tabId: tabId }, function() {
                if (chrome.runtime.lastError) {
                  console.warn('Error detaching debugger:', chrome.runtime.lastError);
                }
              });
              resolve(enhancedResult);
            })
            .catch(error => {
              chrome.debugger.detach({ tabId: tabId });
              reject(error);
            });
        }
      );
    });
  });
}

async function getDOMInfoForAXNodes(tabId, axResult) {
  if (!axResult || !axResult.nodes) {
    return axResult;
  }

  const enhancedNodes = [];
  
  for (const node of axResult.nodes) {
    const enhancedNode = { ...node };
    
    // Try to get DOM node ID and selector
    if (node.backendDOMNodeId) {
      try {
        const domInfo = await getDOMNodeInfo(tabId, node.backendDOMNodeId);
        enhancedNode.domInfo = domInfo;
      } catch (error) {
        console.warn('Could not get DOM info for node:', error);
      }
    }
    
    enhancedNodes.push(enhancedNode);
  }
  
  return {
    ...axResult,
    nodes: enhancedNodes
  };
}

function getDOMNodeInfo(tabId, backendDOMNodeId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "DOM.resolveNode",
      { backendNodeId: backendDOMNodeId },
      function(result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      }
    );
  });
}

async function getElementByAccessibilityRef(tabId, ref) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId: tabId }, "1.0", function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // First get the accessibility tree
      chrome.debugger.sendCommand(
        { tabId: tabId }, 
        "Accessibility.getFullAXTree", 
        {}, 
        function(axResult) {
          if (chrome.runtime.lastError) {
            chrome.debugger.detach({ tabId: tabId });
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // Find the node with the matching ref
          const targetNode = findNodeByRef(axResult, ref);
          if (!targetNode || !targetNode.backendDOMNodeId) {
            chrome.debugger.detach({ tabId: tabId });
            resolve(null);
            return;
          }

          // Get the DOM node info
          getDOMNodeInfo(tabId, targetNode.backendDOMNodeId)
            .then(domInfo => {
              chrome.debugger.detach({ tabId: tabId }, function() {
                if (chrome.runtime.lastError) {
                  console.warn('Error detaching debugger:', chrome.runtime.lastError);
                }
              });
              resolve(domInfo);
            })
            .catch(error => {
              chrome.debugger.detach({ tabId: tabId });
              reject(error);
            });
        }
      );
    });
  });
}

function findNodeByRef(axResult, ref) {
  if (!axResult || !axResult.nodes) {
    return null;
  }

  // Look for a node that matches our ref pattern
  // The ref should be in the format "e1", "e2", etc.
  for (const node of axResult.nodes) {
    // Check if this node has a matching ref in its properties
    if (node.ariaAttributes) {
      for (const [key, value] of Object.entries(node.ariaAttributes)) {
        if (value && value.value && value.value.includes(ref)) {
          return node;
        }
      }
    }
    
    // Check other properties that might contain the ref
    if (node.name && node.name.value && node.name.value.includes(ref)) {
      return node;
    }
  }

  return null;
}

// Navigation actions
async function navigateToUrl(tabId, url) {
  try {
    await chrome.tabs.update(tabId, { url: url });
    return { 
      success: true, 
      data: { action: "navigate", url: url } 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Navigation failed: ${error.message}` 
    };
  }
}

async function navigateBack(tabId) {
  try {
    // Use Chrome scripting API to go back
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        window.history.back();
      }
    });
    return { 
      success: true, 
      data: { action: "navigate_back" } 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Navigate back failed: ${error.message}` 
    };
  }
}

// Keyboard actions
async function pressKey(tabId, key) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (keyToPress) => {
        const event = new KeyboardEvent("keydown", {
          key: keyToPress,
          code: getKeyCode(keyToPress),
          bubbles: true,
        });

        document.dispatchEvent(event);

        // Also dispatch keyup
        const keyupEvent = new KeyboardEvent("keyup", {
          key: keyToPress,
          code: getKeyCode(keyToPress),
          bubbles: true,
        });
        document.dispatchEvent(keyupEvent);
      },
      args: [key]
    });

    return { 
      success: true, 
      data: { action: "press_key", key: key } 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Key press failed: ${error.message}` 
    };
  }
}

// File upload actions
async function handleFileUpload(tabId, paths) {
  try {
    // Note: File upload in Chrome extensions is limited due to security restrictions
    // This is a simplified implementation that creates a file input
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (filePaths) => {
        // Create a temporary file input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = filePaths.length > 1;
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        // Trigger file selection dialog
        fileInput.click();

        // Clean up after a short delay
        setTimeout(() => {
          if (document.body.contains(fileInput)) {
            document.body.removeChild(fileInput);
          }
        }, 1000);
      },
      args: [paths]
    });

    return { 
      success: true, 
      data: { action: "file_upload", files: paths } 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `File upload failed: ${error.message}` 
    };
  }
}

// Helper function for key codes
function getKeyCode(key) {
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
