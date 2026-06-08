// OnPoint Fashion AI Chrome Extension Content Script

class OnPointContentScript {
  constructor() {
    this.fashionImages = new Set();
    this.observer = null;
    this.isEnabled = false;

    this.init();
  }

  async init() {
    // Check if we should run on this page
    if (!this.shouldRunOnPage()) {
      return;
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  shouldRunOnPage() {
    const url = window.location.href;
    const fashionSites = [
      'zara.com',
      'hm.com',
      'asos.com',
      'nordstrom.com',
      'instagram.com',
      'pinterest.com',
      'fashionnova.com',
      'shein.com',
      'uniqlo.com',
      'gap.com',
      'nike.com',
      'adidas.com',
      'macys.com',
      'bloomingdales.com'
    ];

    return fashionSites.some(site => url.includes(site));
  }

  setup() {
    // Inject origin trial tokens early so AI features can be enabled in page context
    // Note: This is asynchronous; fire and forget to avoid blocking UI
    this.injectOriginTrialTokens();
    this.isEnabled = true;
    this.scanForFashionImages();
    this.setupImageObserver();
    this.addImageHoverEffects();
    this.setupMessageListener();

    console.log('OnPoint Fashion AI content script initialized');
  }

  scanForFashionImages() {
    const images = document.querySelectorAll('img');

    images.forEach(img => {
      if (this.isFashionImage(img)) {
        this.fashionImages.add(img);
        this.enhanceImage(img);
      }
    });

    console.log(`Found ${this.fashionImages.size} potential fashion images`);
  }

  isFashionImage(img) {
    const src = img.src?.toLowerCase() || '';
    const alt = img.alt?.toLowerCase() || '';
    const className = img.className?.toLowerCase() || '';

    // Check image attributes for fashion-related keywords
    const fashionKeywords = [
      'outfit', 'fashion', 'clothing', 'dress', 'shirt', 'pants',
      'jacket', 'shoes', 'style', 'look', 'wear', 'apparel',
      'garment', 'attire', 'ensemble', 'wardrobe'
    ];

    const hasFashionKeyword = fashionKeywords.some(keyword =>
      src.includes(keyword) || alt.includes(keyword) || className.includes(keyword)
    );

    // Check image size (fashion images are usually larger)
    const isLargeEnough = img.naturalWidth >= 200 && img.naturalHeight >= 200;

    // Check if image is in a product or fashion context
    const parent = img.closest('.product, .item, .fashion, .outfit, .look, [data-testid*="product"]');
    const hasProductContext = !!parent;

    return (hasFashionKeyword || hasProductContext) && isLargeEnough;
  }

  enhanceImage(img) {
    // Add hover effect for OnPoint analysis
    img.style.transition = 'all 0.2s ease';
    img.addEventListener('mouseenter', () => this.showAnalyzeButton(img));
    img.addEventListener('mouseleave', () => this.hideAnalyzeButton(img));

    // Mark as enhanced
    img.dataset.onpointEnhanced = 'true';
  }

  showAnalyzeButton(img) {
    // Remove any existing button
    this.hideAnalyzeButton(img);

    const button = document.createElement('div');
    button.className = 'onpoint-analyze-btn';
    button.innerHTML = `
      <div style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Analyze Style
      </div>
    `;

    // Position button relative to image
    const rect = img.getBoundingClientRect();
    button.style.position = 'fixed';
    button.style.top = rect.top + 10 + 'px';
    button.style.right = (window.innerWidth - rect.right + 10) + 'px';
    button.style.zIndex = '10000';

    // Add click handler
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.analyzeImage(img);
    });

    document.body.appendChild(button);
    img.dataset.onpointButton = 'visible';
  }

  hideAnalyzeButton(img) {
    const existingButton = document.querySelector('.onpoint-analyze-btn');
    if (existingButton) {
      existingButton.remove();
    }
    img.dataset.onpointButton = 'hidden';
  }

  async analyzeImage(img) {
    try {
      // Show loading state
      this.showLoadingNotification();

      // Send message to background script or popup
      const response = await chrome.runtime.sendMessage({
        action: 'analyzePageOutfit',
        imageUrl: img.src,
        imageAlt: img.alt,
        pageUrl: window.location.href
      });

      if (response.success) {
        this.showAnalysisNotification(img);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
      this.showErrorNotification(error.message);
    }
  }

  showLoadingNotification() {
    this.showNotification('Analyzing outfit...', 'OnPoint AI is analyzing this fashion item.', 'info');
  }

  showAnalysisNotification(img) {
    this.showNotification(
      'Analysis Ready!',
      'Click the OnPoint extension icon to view your fashion analysis.',
      'success'
    );
  }

  showErrorNotification(error) {
    this.showNotification(
      'Analysis Error',
      `Could not analyze this image: ${error}`,
      'error'
    );
  }

  showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'onpoint-notification';

    const bgColor = {
      info: '#667eea',
      success: '#10b981',
      error: '#ef4444'
    }[type];

    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 300px;
        animation: slideIn 0.3s ease;
      ">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">${message}</div>
      </div>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  setupImageObserver() {
    // Watch for new images added to the page
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is an image
            if (node.tagName === 'IMG' && this.isFashionImage(node)) {
              this.fashionImages.add(node);
              this.enhanceImage(node);
            }

            // Check for images within the added node
            const images = node.querySelectorAll ? node.querySelectorAll('img') : [];
            images.forEach(img => {
              if (this.isFashionImage(img)) {
                this.fashionImages.add(img);
                this.enhanceImage(img);
              }
            });
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  addImageHoverEffects() {
    const style = document.createElement('style');
    style.textContent = `
      img[data-onpoint-enhanced="true"]:hover {
        opacity: 0.8;
        cursor: pointer;
      }

      .onpoint-analyze-btn {
        pointer-events: all;
      }
    `;
    document.head.appendChild(style);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getPageInfo') {
        sendResponse({
          url: window.location.href,
          title: document.title,
          fashionImagesCount: this.fashionImages.size
        });
      } else if (request.action === 'highlightFashionImages') {
        this.highlightAllFashionImages();
        sendResponse({ success: true });
      }
    });
  }

  highlightAllFashionImages() {
    this.fashionImages.forEach(img => {
      img.style.outline = '3px solid #667eea';
      img.style.outlineOffset = '2px';
    });

    // Remove highlights after 3 seconds
    setTimeout(() => {
      this.fashionImages.forEach(img => {
        img.style.outline = '';
        img.style.outlineOffset = '';
      });
    }, 3000);
  }

  // Inject Origin Trial tokens (third-party) into page context for content scripts
  async injectOriginTrialTokens() {
    try {
      const { otThirdPartyToken, otThirdPartyTokens } = await chrome.storage.local.get([
        'otThirdPartyToken',
        'otThirdPartyTokens'
      ]);

      const tokens = [];
      if (typeof otThirdPartyToken === 'string' && otThirdPartyToken.trim()) {
        tokens.push(otThirdPartyToken.trim());
      }
      if (Array.isArray(otThirdPartyTokens)) {
        for (const t of otThirdPartyTokens) {
          if (typeof t === 'string' && t.trim()) tokens.push(t.trim());
        }
      }

      if (tokens.length === 0) return;

      // Inject meta tags for each token
      const head = document.head || document.getElementsByTagName('head')[0];
      for (const token of tokens) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'origin-trial';
        meta.content = token;
        head.appendChild(meta);
      }
      // Optional: mark on window for debugging
      window.__onpointOTInjected = true;
    } catch (err) {
      console.warn('Failed to inject Origin Trial tokens:', err?.message || err);
    }
  }

  // Clean up when page unloads
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Remove all OnPoint elements
    document.querySelectorAll('.onpoint-analyze-btn, .onpoint-notification').forEach(el => {
      el.remove();
    });
  }
}

// Initialize content script
const onPointContent = new OnPointContentScript();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  onPointContent.cleanup();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OnPointContentScript;
}
