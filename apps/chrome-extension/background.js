// OnPoint Fashion AI Chrome Extension Background Service Worker

class OnPointBackground {
  constructor() {
    this.setupEventListeners();
    this.initializeExtension();
  }

  initializeExtension() {
    console.log('OnPoint Fashion AI Extension initialized');

    // Set default storage values
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        chrome.storage.local.set({
          savedAnalyses: [],
          userPreferences: {
            theme: 'light',
            notifications: true,
            autoSave: true
          },
          extensionStats: {
            installDate: Date.now(),
            totalAnalyses: 0,
            totalChats: 0
          }
        });

        // Show welcome notification
        this.showNotification(
          'Welcome to OnPoint Fashion AI!',
          'Click the extension icon to start analyzing your outfits.'
        );
      } else if (details.reason === 'update') {
        console.log('Extension updated to version:', chrome.runtime.getManifest().version);
      }
    });
  }

  setupEventListeners() {
    // Handle extension icon click
    chrome.action.onClicked.addListener((tab) => {
      console.log('Extension icon clicked on tab:', tab.id);
    });

    // Handle messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Will respond asynchronously
    });

    // Handle context menu interactions (future feature)
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'analyze-outfit-image') {
        this.analyzeImageFromPage(info.srcUrl, tab);
      }
    });

    // Handle tab updates for potential outfit detection
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkPageForOutfitImages(tab);
      }
    });

    // Handle storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChanges(changes, namespace);
    });

    // Handle alarms for periodic tasks
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'analyzePageOutfit':
          const result = await this.analyzePageOutfit(request.imageUrl);
          sendResponse({ success: true, data: result });
          break;

        case 'getAnalysisHistory':
          const history = await this.getAnalysisHistory();
          sendResponse({ success: true, data: history });
          break;

        case 'saveAnalysis':
          await this.saveAnalysis(request.analysis);
          sendResponse({ success: true });
          break;

        case 'updateStats':
          await this.updateStats(request.statType, request.increment);
          sendResponse({ success: true });
          break;

        case 'exportData':
          const exportData = await this.exportUserData();
          sendResponse({ success: true, data: exportData });
          break;

        case 'checkChromeAI':
          const aiStatus = await this.checkChromeAIStatus();
          sendResponse({ success: true, data: aiStatus });
          break;

        default:
          console.log('Unknown message action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzePageOutfit(imageUrl) {
    // Analyze an outfit image found on a webpage
    console.log('Analyzing outfit from page:', imageUrl);

    // This would integrate with the same AI logic as the popup
    // For now, return a placeholder response
    return {
      source: 'webpage',
      imageUrl,
      timestamp: Date.now(),
      status: 'pending'
    };
  }

  async getAnalysisHistory() {
    const result = await chrome.storage.local.get(['savedAnalyses']);
    return result.savedAnalyses || [];
  }

  async saveAnalysis(analysis) {
    const result = await chrome.storage.local.get(['savedAnalyses']);
    const savedAnalyses = result.savedAnalyses || [];

    // Add new analysis to the beginning
    savedAnalyses.unshift({
      ...analysis,
      id: `analysis_${Date.now()}`,
      savedAt: Date.now()
    });

    // Keep only the last 50 analyses
    const trimmedAnalyses = savedAnalyses.slice(0, 50);

    await chrome.storage.local.set({ savedAnalyses: trimmedAnalyses });

    // Update stats
    await this.updateStats('totalAnalyses', 1);
  }

  async updateStats(statType, increment = 1) {
    const result = await chrome.storage.local.get(['extensionStats']);
    const stats = result.extensionStats || {};

    stats[statType] = (stats[statType] || 0) + increment;
    stats.lastUpdated = Date.now();

    await chrome.storage.local.set({ extensionStats: stats });
  }

  async exportUserData() {
    const data = await chrome.storage.local.get(null);
    return {
      version: chrome.runtime.getManifest().version,
      exportDate: Date.now(),
      data: data
    };
  }

  async checkChromeAIStatus() {
    // This would check Chrome AI availability
    // Since we can't access window.ai from background script,
    // we'll rely on popup to report status
    return {
      available: 'unknown',
      message: 'AI status can only be checked from popup or content script'
    };
  }

  async checkPageForOutfitImages(tab) {
    // Future feature: automatically detect outfit images on fashion websites
    if (this.isFashionSite(tab.url)) {
      console.log('Fashion site detected:', tab.url);
      // Could inject content script to look for outfit images
    }
  }

  isFashionSite(url) {
    const fashionDomains = [
      'zara.com',
      'hm.com',
      'asos.com',
      'nordstrom.com',
      'instagram.com',
      'pinterest.com',
      'fashionnova.com',
      'shein.com',
      'uniqlo.com',
      'gap.com'
    ];

    return fashionDomains.some(domain => url && url.includes(domain));
  }

  handleStorageChanges(changes, namespace) {
    if (namespace === 'local') {
      console.log('Storage changes detected:', Object.keys(changes));

      // Could trigger notifications or updates based on changes
      if (changes.savedAnalyses) {
        console.log('Analysis history updated');
      }
    }
  }

  handleAlarm(alarm) {
    switch (alarm.name) {
      case 'dailyTip':
        this.showDailyFashionTip();
        break;
      case 'cleanupStorage':
        this.cleanupOldData();
        break;
    }
  }

  showDailyFashionTip() {
    const tips = [
      "Color coordination tip: Use the 60-30-10 rule for balanced outfits!",
      "Fit matters more than brand - ensure your clothes fit your body properly.",
      "Accessories can make or break an outfit - choose them thoughtfully.",
      "Invest in quality basics that you can mix and match.",
      "When in doubt, confidence is your best accessory!"
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    this.showNotification('Daily Fashion Tip', randomTip);
  }

  async cleanupOldData() {
    const result = await chrome.storage.local.get(['savedAnalyses']);
    const analyses = result.savedAnalyses || [];

    // Remove analyses older than 6 months
    const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
    const filteredAnalyses = analyses.filter(analysis =>
      analysis.timestamp > sixMonthsAgo
    );

    if (filteredAnalyses.length !== analyses.length) {
      await chrome.storage.local.set({ savedAnalyses: filteredAnalyses });
      console.log(`Cleaned up ${analyses.length - filteredAnalyses.length} old analyses`);
    }
  }

  showNotification(title, message) {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: title,
        message: message
      });
    }
  }

  // Setup context menus for right-click functionality
  setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'analyze-outfit-image',
        title: 'Analyze with OnPoint Fashion AI',
        contexts: ['image'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
    });
  }

  // Setup periodic alarms
  setupAlarms() {
    // Daily fashion tip
    chrome.alarms.create('dailyTip', {
      when: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
      periodInMinutes: 24 * 60 // Every 24 hours
    });

    // Weekly storage cleanup
    chrome.alarms.create('cleanupStorage', {
      when: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
      periodInMinutes: 7 * 24 * 60 // Every 7 days
    });
  }
}

// Initialize the background service
const onPointBackground = new OnPointBackground();

// Setup context menus and alarms after installation
chrome.runtime.onInstalled.addListener(() => {
  onPointBackground.setupContextMenus();
  onPointBackground.setupAlarms();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('OnPoint Fashion AI Extension started');
});

// Export for testing if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OnPointBackground;
}
