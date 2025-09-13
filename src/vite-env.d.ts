/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vite/client" />

// Chrome Extension API types
declare global {
  interface Window {
    chrome: typeof chrome;
  }
  
  const chrome: {
    tabs: {
      query: (queryInfo: {
        active?: boolean;
        currentWindow?: boolean;
        windowId?: number;
        windowType?: string;
        index?: number;
        lastFocusedWindow?: boolean;
        status?: string;
        title?: string;
        url?: string | string[];
        audible?: boolean;
        muted?: boolean;
        discarded?: boolean;
        autoDiscardable?: boolean;
        groupId?: number;
        pinned?: boolean;
      }) => Promise<chrome.tabs.Tab[]>;
      
      sendMessage: (tabId: number, message: any, options?: {
        frameId?: number;
      }) => Promise<any>;
      
      onUpdated: {
        addListener: (callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) => void;
        removeListener: (callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) => void;
      };
    };
    
    runtime: {
      sendMessage: (message: any, responseCallback?: (response: any) => void) => void;
      onMessage: {
        addListener: (callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) => void;
        removeListener: (callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) => void;
      };
    };
  };
  
  namespace chrome {
    namespace tabs {
      interface Tab {
        id: number;
        index: number;
        groupId: number;
        windowId: number;
        openerTabId?: number;
        selected: boolean;
        highlighted: boolean;
        active: boolean;
        pinned: boolean;
        audible?: boolean;
        discarded: boolean;
        autoDiscardable: boolean;
        mutedInfo?: MutedInfo;
        url?: string;
        pendingUrl?: string;
        title?: string;
        favIconUrl?: string;
        status?: string;
        incognito: boolean;
        width?: number;
        height?: number;
        sessionId?: string;
      }
      
      interface TabChangeInfo {
        audible?: boolean;
        discarded?: boolean;
        favIconUrl?: string;
        groupId?: number;
        height?: number;
        highlighted?: boolean;
        incognito?: boolean;
        index?: number;
        mutedInfo?: MutedInfo;
        pinned?: boolean;
        sessionId?: string;
        status?: string;
        title?: string;
        url?: string;
        width?: number;
      }
      
      interface MutedInfo {
        muted: boolean;
        reason?: string;
        extensionId?: string;
      }
    }
    
    namespace runtime {
      interface MessageSender {
        tab?: chrome.tabs.Tab;
        frameId?: number;
        id?: string;
        url?: string;
        tlsChannelId?: string;
      }
    }
  }
}

export {};