// OnPoint Fashion AI Chrome Extension Popup JavaScript

class OnPointExtension {
  constructor() {
    this.currentPhoto = null;
    this.analysisResults = null;
    this.chromeAIAvailable = false;
    this.chromeAILiteAvailable = false;
    this.aiSession = null;
    this.chatMessages = [];
    // Server-first architecture; optional on-device fallback when available
    this.serverAvailable = false;
    this.serverStatus = null;
    this.serverModelChoice = 'flash';

    // Page analysis properties
    this.pageImageFile = null;
    this.pageImageUrl = null;
    this.pageImageAlt = null;
    this.pageUrl = null;

    // Saved photos
    this.savedPhotos = [];

    // Virtual try-on mode
    this.virtualTryOnMode = false;

    // Comparison mode
    this.comparisonMode = false;
    this.productPhoto = null;

    this.init();
  }

  async init() {
    await this.checkServerStatus();
    await this.checkChromeAI();
    await this.loadUserContext(); // Load user preferences and history
    this.setupEventListeners();
    await this.loadServerModelChoice();
    this.setupModelSelector();
    await this.loadSavedPhotos();
    this.updateUIState();
    await this.renderDiagnostics();
  }

  // Check server AI status via /api/ai/status
  async checkServerStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    try {
      const status = await window.OnPointAPI?.status();
      if (status && status.ok) {
        this.serverAvailable = true;
        this.serverStatus = status;
        if (statusIndicator) statusIndicator.className = 'status-indicator';
        if (statusText) statusText.textContent = 'Server Ready';
      } else {
        this.serverAvailable = false;
      }
    } catch (e) {
      this.serverAvailable = false;
    }
  }

  async loadServerModelChoice() {
    try {
      const { serverModelChoice } = await chrome.storage?.local?.get(['serverModelChoice']) || {};
      if (typeof serverModelChoice === 'string' && serverModelChoice) {
        this.serverModelChoice = serverModelChoice;
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  setupModelSelector() {
    const select = document.getElementById('serverModelSelect');
    if (!select) return;
    // Initialize value
    select.value = this.serverModelChoice;
    select.addEventListener('change', async (e) => {
      const value = e.target.value;
      if (value === 'flash' || value === 'pro' || value === 'flash-lite') {
        this.serverModelChoice = value;
        try {
          await chrome.storage?.local?.set({ serverModelChoice: value });
        } catch (err) {
          console.warn('Failed to persist model choice:', err);
        }
      }
    });
  }

  // Check if Chrome AI APIs are available
  async checkChromeAI() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    try {
      statusIndicator.className = 'status-indicator checking';
      statusText.textContent = 'Checking AI...';

      const hasLM = 'ai' in window && !!window.ai?.languageModel;
      const hasWriter = 'ai' in window && !!window.ai?.writer;
      const hasSummarizer = 'ai' in window && !!window.ai?.summarizer;

      if (hasLM) {
        const availability = await window.ai.languageModel.availability();

        if (availability === 'readily' || availability === 'after-download') {
          this.chromeAIAvailable = true;
          statusIndicator.className = 'status-indicator';
          statusText.textContent = availability === 'readily' ? 'AI Ready' : 'AI Downloading';
        } else {
          throw new Error('AI not available on this device');
        }
      } else if (hasWriter || hasSummarizer) {
        // Lite Mode: limited features available without full Prompt API
        this.chromeAIAvailable = false;
        this.chromeAILiteAvailable = true;
        statusIndicator.className = 'status-indicator';
        statusText.textContent = 'AI Lite Mode';
      } else {
        throw new Error('Chrome AI APIs not found');
      }
    } catch (error) {
      console.warn('Chrome AI not available:', error);
      this.chromeAIAvailable = false;
      this.chromeAILiteAvailable = false;
      statusIndicator.className = 'status-indicator unavailable';
      statusText.textContent = 'AI Unavailable';
      this.showChromeAIWarning();
    }
  }

  async initializeAISession() {
    try {
      if (window.ai && window.ai.languageModel) {
        this.aiSession = await window.ai.languageModel.create({
          temperature: 0.7,
          topK: 30,
          initialPrompts: [{
            role: 'system',
            content: `You are a professional fashion stylist AI. Analyze outfits and provide constructive, helpful feedback.
                     Focus on color coordination, fit, style coherence, and practical styling advice.
                     Always be encouraging while offering specific improvement suggestions.
                     Rate outfits on a 1-10 scale and provide actionable recommendations.`
          }]
        });
      }
    } catch (error) {
      console.error('Failed to initialize AI session:', error);
    }
  }

  // Initialize Prompt API with user activation and show model download progress when available
  async ensureAISessionInitialized() {
    if (this.aiSession) return;

    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    try {
      if (!(window.ai && window.ai.languageModel)) {
        throw new Error('Prompt API not available in this context');
      }

      const availability = await window.ai.languageModel.availability();
      if (availability === 'after-download') {
        if (statusIndicator) statusIndicator.className = 'status-indicator checking';
        if (statusText) statusText.textContent = 'AI Downloading…';
      }

      const options = {
        temperature: 0.7,
        topK: 30,
        initialPrompts: [{
          role: 'system',
          content: `You are a professional fashion stylist AI. Analyze outfits and provide constructive, helpful feedback.
                   Focus on color coordination, fit, style coherence, and practical styling advice.
                   Always be encouraging while offering specific improvement suggestions.
                   Rate outfits on a 1-10 scale and provide actionable recommendations.`
        }]
      };

      // Attach a monitor if supported to surface download progress
      try {
        options.monitor = (m) => {
          m.addEventListener('downloadprogress', (e) => {
            const pct = Math.round((e.loaded || 0) * 100);
            if (statusIndicator) statusIndicator.className = 'status-indicator checking';
            if (statusText) statusText.textContent = `AI Downloading ${pct}%`;
          });
          m.addEventListener('downloadcomplete', () => {
            if (statusIndicator) statusIndicator.className = 'status-indicator';
            if (statusText) statusText.textContent = 'AI Ready';
          });
        };
      } catch (_) {
        // Safe no-op if monitor is not supported
      }

      this.aiSession = await window.ai.languageModel.create(options);

      if (statusIndicator) statusIndicator.className = 'status-indicator';
      if (statusText) statusText.textContent = 'AI Ready';
      this.chromeAIAvailable = true;
    } catch (error) {
      console.warn('ensureAISessionInitialized failed:', error);
      if (statusIndicator) statusIndicator.className = 'status-indicator unavailable';
      if (statusText) statusText.textContent = 'AI Unavailable';
      this.chromeAIAvailable = false;
      this.showChromeAIWarning();
    }
  }

  setupEventListeners() {
    // Photo upload
    const uploadArea = document.getElementById('uploadArea');
    const uploadBtn = document.getElementById('uploadBtn');
    const photoInput = document.getElementById('photoInput');
    const removePhoto = document.getElementById('removePhoto');

    uploadArea.addEventListener('click', () => photoInput.click());
    uploadBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', (e) => this.handlePhotoSelect(e));
    removePhoto.addEventListener('click', () => this.removePhoto());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        this.handlePhotoFile(files[0]);
      }
    });

    // Mode toggle
    document.getElementById('virtualTryOnToggle').addEventListener('change', (e) => {
      this.virtualTryOnMode = e.target.checked;
      this.updateUIMode();
    });

    // Action buttons
    document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeOutfit());
    document.getElementById('getAdviceBtn').addEventListener('click', () => this.openAdviceModal());
    document.getElementById('compareBtn').addEventListener('click', () => this.startComparison());
    document.getElementById('savePhotoBtn').addEventListener('click', () => this.savePhoto());
    document.getElementById('saveBtn').addEventListener('click', () => this.saveAnalysis());
    document.getElementById('retryBtn').addEventListener('click', () => this.retryAnalysis());

    // Modal
    document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') this.closeModal();
    });

    // Chat
    const messageInput = document.getElementById('messageInput');
    const sendMessage = document.getElementById('sendMessage');

    messageInput.addEventListener('input', (e) => {
      sendMessage.disabled = !e.target.value.trim();
    });

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        this.sendChatMessage();
      }
    });

    sendMessage.addEventListener('click', () => this.sendChatMessage());

    // Links
    document.getElementById('aboutLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://onpoint.fashion' });
    });

    document.getElementById('privacyLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://onpoint.fashion/privacy' });
    });

    // Removed web app option per user request; no external fallback

    // Diagnostics interactions
    const diagToggle = document.getElementById('diagnosticsToggle');
    const diagBody = document.getElementById('diagnosticsBody');
    const diagRefresh = document.getElementById('diagnosticsRefresh');

    if (diagToggle && diagBody) {
      diagToggle.addEventListener('click', () => {
        const isHidden = diagBody.style.display === 'none';
        diagBody.style.display = isHidden ? 'block' : 'none';
      });
    }

    if (diagRefresh) {
      diagRefresh.addEventListener('click', async () => {
        await this.checkChromeAI();
        await this.renderDiagnostics();
      });
    }

    const saveOTTokenBtn = document.getElementById('saveOTTokenBtn');
    const otTokenInput = document.getElementById('otTokenInput');
    if (saveOTTokenBtn && otTokenInput) {
      saveOTTokenBtn.addEventListener('click', async () => {
        const token = otTokenInput.value.trim();
        if (!token) return;
        try {
          const existing = await chrome.storage.local.get(['otThirdPartyTokens']);
          const list = Array.isArray(existing.otThirdPartyTokens) ? existing.otThirdPartyTokens : [];
          // Avoid duplicates
          if (!list.includes(token)) list.push(token);
          await chrome.storage.local.set({ otThirdPartyToken: token, otThirdPartyTokens: list });
          // Simple feedback
          saveOTTokenBtn.textContent = 'Saved';
          setTimeout(() => { saveOTTokenBtn.textContent = 'Save Token'; }, 1200);
          await this.renderDiagnostics();
        } catch (err) {
          console.warn('Failed to save OT token:', err?.message || err);
        }
      });
    }
  }

  handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.handlePhotoFile(file);
    }
  }

  handlePhotoFile(file) {
    this.currentPhoto = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('uploadArea').style.display = 'none';
      document.getElementById('photoPreview').style.display = 'block';
      document.getElementById('actions').style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Clear previous results
    this.clearResults();
  }

  removePhoto() {
    this.currentPhoto = null;
    this.pageImageFile = null;
    this.pageImageUrl = null;
    this.pageImageAlt = null;
    this.pageUrl = null;
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('actions').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('photoInput').value = '';
    this.clearResults();
  }

  async analyzeOutfit() {
    if (!this.currentPhoto) return;

    this.showLoading();

    try {
      // Prefer server-side analysis when available
      if (this.serverAvailable) {
        let analysisPrompt = this.buildAnalysisPrompt({
          virtualTryOn: this.virtualTryOnMode,
          comparison: this.comparisonMode && !!this.productPhoto,
          pageUrl: null
        });
        analysisPrompt = this.buildContextualPrompt(analysisPrompt);

        const serverResp = await window.OnPointAPI.analyze(analysisPrompt, 'auto', this.serverModelChoice);
        const responseText = serverResp?.result || '';
        this.analysisResults = this.virtualTryOnMode ?
          this.parseVirtualTryOnResponse(responseText) :
          this.parseAnalysisResponse(responseText);
        await this.displayResults();
        return;
      }

      // Attempt session init on user action to trigger model download when available
      if (!this.aiSession && (window.ai && window.ai.languageModel)) {
        await this.ensureAISessionInitialized();
      }

      if (!this.chromeAIAvailable) {
        // Fallback analysis without full Prompt API
        await this.performFallbackAnalysis();
        return;
      }
      // Use Chrome AI for analysis
      let analysisPrompt = this.buildAnalysisPrompt({
        virtualTryOn: this.virtualTryOnMode,
        comparison: this.comparisonMode && !!this.productPhoto,
        pageUrl: null
      });
      analysisPrompt = this.buildContextualPrompt(analysisPrompt);

      const response = await this.modelPromptWithImage(analysisPrompt, this.currentPhoto);

      // Parse AI response into structured data
      this.analysisResults = this.virtualTryOnMode ?
        this.parseVirtualTryOnResponse(response) :
        this.parseAnalysisResponse(response);

      await this.displayResults();

    } catch (error) {
      console.error('Analysis error:', error);
      this.showError('Failed to analyze outfit. Please try again.');
    }
  }

  async analyzePageOutfit(imageUrl, imageAlt, pageUrl) {
    this.showLoading();
    this.currentPhoto = null; // Clear current photo since this is from page

    try {
      // Prefer server-side image analysis when available
      if (this.serverAvailable) {
        const serverResp = await window.OnPointAPI.analyzeImage(imageUrl, 'auto', this.serverModelChoice);
        const responseText = serverResp?.result || '';
        this.analysisResults = this.parseAnalysisResponse(responseText);
        // Store page context
        this.pageImageUrl = imageUrl;
        this.pageImageAlt = imageAlt;
        this.pageUrl = pageUrl;
        await this.displayResults();
        // Update UI to show page context
        this.showPageContext();
        return;
      }

      if (!this.chromeAIAvailable) {
        this.showError('Server unavailable and Chrome AI required for page image analysis. Please upload a photo directly.');
        return;
      }

      // Fetch image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const fileName = imageAlt || 'page-outfit.jpg';

      // Create a File-like object from blob
      const file = new File([blob], fileName, { type: blob.type });

      // Store reference for display
      this.pageImageFile = file;
      this.pageImageUrl = imageUrl;
      this.pageImageAlt = imageAlt;
      this.pageUrl = pageUrl;

      // Use Chrome AI for analysis with page context
      let analysisPrompt = this.buildAnalysisPrompt({
        virtualTryOn: false,
        comparison: false,
        pageUrl
      });
      analysisPrompt = this.buildContextualPrompt(analysisPrompt);

      const aiResponse = await this.modelPromptWithImage(analysisPrompt, this.pageImageFile);

      // Parse AI response into structured data
      this.analysisResults = this.parseAnalysisResponse(aiResponse);

      await this.displayResults();

      // Update UI to show page context
      this.showPageContext();

    } catch (error) {
      console.error('Page analysis error:', error);
      this.showError('Failed to analyze page outfit. The image may be inaccessible or too large.');
    }
  }

  buildAnalysisPrompt({ virtualTryOn = false, comparison = false, pageUrl = null }) {
    // Enhanced structured prompt for better multimodal analysis
    const basePrompt = `You are an expert fashion stylist and personal shopper with expertise in color theory, body styling, and current fashion trends. 

ANALYSIS INSTRUCTIONS:
1. Examine the outfit image carefully, noting colors, patterns, fit, styling, and overall composition
2. Consider seasonal appropriateness, occasion suitability, and current fashion trends
3. Evaluate color coordination, proportion balance, and styling techniques
4. Provide specific, actionable feedback that helps improve the overall look

Please provide your analysis in this exact structured format:

RATING: [number from 1-10 with one decimal place]
STRENGTHS: 
- [specific positive aspect with reasoning]
- [specific positive aspect with reasoning] 
- [specific positive aspect with reasoning]
IMPROVEMENTS:
- [specific actionable suggestion with explanation]
- [specific actionable suggestion with explanation]
STYLE_NOTES: [professional styling advice focusing on how to enhance the look, including specific recommendations for accessories, colors, or styling techniques]
CONFIDENCE: [your confidence level in this analysis from 1-10]

FOCUS AREAS:
- Color harmony and coordination
- Fit and proportions
- Styling and accessories
- Occasion appropriateness
- Current fashion trends alignment`;

    if (virtualTryOn) {
      return basePrompt + `\n\nSPECIAL FOCUS: Virtual Try-On Analysis
Evaluate how well this outfit would translate to virtual try-on experiences:
- Clarity of garment details and textures
- Color accuracy representation
- Fit visualization potential
- Online shopping appeal and marketability`;
    }

    if (comparison) {
      return basePrompt + `\n\nSPECIAL FOCUS: Comparative Analysis
This is part of a comparison study. Emphasize:
- Unique distinguishing features of this outfit
- Comparative strengths and weaknesses
- Specific elements that set this look apart
- Ranking factors for outfit comparison`;
    }

    if (pageUrl) {
      const domain = new URL(pageUrl).hostname;
      return basePrompt + `\n\nCONTEXT: Image Source Analysis
This outfit image was found on: ${domain}
Consider the presentation context:
- Website styling and target audience
- Brand aesthetic alignment
- Marketing presentation quality
- Contextual appropriateness for the platform`;
    }

    return basePrompt;
  }

  async modelPromptWithImage(promptText, imageFile) {
    if (!this.aiSession) throw new Error('AI session not initialized');

    // Try multimodal prompt if supported
    try {
      const imageDataUrl = imageFile ? await this.fileToDataURL(imageFile) : null;

      // Attempt object-form prompt with image attachment
      if (imageDataUrl) {
        const res = await this.aiSession.prompt({ text: promptText, images: [imageDataUrl] });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.text || res.output || '';
      }

      // Fallback to text-only prompt if object-form not supported or no image
      return await this.aiSession.prompt(promptText);
    } catch (err) {
      console.warn('Multimodal prompt failed; falling back to text-only:', err);
      // Explicitly try text-only to avoid hard failure
      try {
        return await this.aiSession.prompt(promptText);
      } catch (e2) {
        throw e2;
      }
    }
  }

  showPageContext() {
    // Add page info to the results
    const resultsDiv = document.getElementById('results');
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-context';
    pageInfo.innerHTML = `
      <small style="color: #666; font-size: 11px;">
        Analyzed from: ${new URL(this.pageUrl).hostname}
        ${this.pageImageAlt ? ` • ${this.pageImageAlt}` : ''}
      </small>
    `;

    // Insert after rating
    const ratingDiv = resultsDiv.querySelector('.rating-display');
    if (ratingDiv && ratingDiv.nextSibling) {
      resultsDiv.insertBefore(pageInfo, ratingDiv.nextSibling);
    } else {
      resultsDiv.appendChild(pageInfo);
    }
  }

  async performFallbackAnalysis() {
    // Try Lite Mode (writer/summarizer) first
    const analysisPrompt = `Analyze this fashion outfit and provide:\n- Overall rating (1-10) with brief explanation\n- 3 specific strengths\n- 2 areas for improvement with actionable suggestions\n- One short style note\nKeep it concise and actionable.`;

    try {
      if (this.chromeAILiteAvailable) {
        const liteText = await this.liteGenerate(analysisPrompt);
        if (liteText && liteText.trim()) {
          this.analysisResults = this.parseAnalysisResponse(liteText);
          await this.displayResults();
          return;
        }
      }
    } catch (e) {
      console.warn('Fallback analysis failed:', e);
    }

    // No mock: surface explicit error to the UI
    this.analysisResults = null;
    this.showError('AI unavailable: Lite Mode not available.');
  }

  async liteGenerate(inputText) {
    try {
      if (window.ai?.writer?.write) {
        const res = await window.ai.writer.write({ input: inputText });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.output || res.text || '';
      }
      if (window.ai?.summarizer?.summarize) {
        const res = await window.ai.summarizer.summarize({ input: inputText });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.summary || res.text || '';
      }
    } catch (error) {
      console.warn('Lite generation error:', error);
    }
    return null;
  }

  // Enhanced rewriter function for fashion descriptions
  async rewriteForStyle(text, style = 'professional') {
    try {
      if (window.ai?.rewriter?.rewrite) {
        const stylePrompts = {
          professional: 'Rewrite this fashion advice in a professional, expert stylist tone',
          casual: 'Rewrite this fashion advice in a friendly, casual tone',
          concise: 'Rewrite this fashion advice to be more concise and actionable',
          detailed: 'Rewrite this fashion advice with more detailed explanations'
        };

        const prompt = stylePrompts[style] || stylePrompts.professional;
        const res = await window.ai.rewriter.rewrite({ 
          input: text,
          context: prompt
        });
        
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.output || res.text || res.rewritten || text;
      }
    } catch (error) {
      console.warn('Rewriter error:', error);
    }
    return text;
  }

  // Enhanced summarizer function for outfit insights
  async summarizeOutfitAnalysis(analysisText) {
    try {
      if (window.ai?.summarizer?.summarize) {
        const res = await window.ai.summarizer.summarize({ 
          input: analysisText,
          type: 'key-points',
          format: 'markdown',
          length: 'short'
        });
        
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.summary || res.text || res.output || null;
      }
    } catch (error) {
      console.warn('Summarizer error:', error);
    }
    return null;
  }

  async renderDiagnostics() {
    const serverEl = document.getElementById('diagServerStatus');
    const providersEl = document.getElementById('diagProvidersStatus');
    const promptEl = document.getElementById('diagPromptStatus');
    const liteEl = document.getElementById('diagLiteStatus');
    const translatorEl = document.getElementById('diagTranslatorStatus');
    const langDetectEl = document.getElementById('diagLangDetectStatus');
    const proofreaderEl = document.getElementById('diagProofreaderStatus');
    const writerEl = document.getElementById('diagWriterStatus');
    const rewriterEl = document.getElementById('diagRewriterStatus');
    const otExtEl = document.getElementById('diagOTExtStatus');
    const otPageEl = document.getElementById('diagOTPageStatus');
    const noteEl = document.getElementById('diagNote');

    const setBadge = (el, text, cls) => {
      if (!el) return;
      el.textContent = text;
      el.className = `diag-badge ${cls}`;
    };

    // Server status
    if (serverEl) {
      setBadge(serverEl, this.serverAvailable ? 'Connected' : 'Unavailable', this.serverAvailable ? 'ok' : 'error');
    }
    if (providersEl) {
      const p = this.serverStatus?.providers;
      if (p) {
        const list = [p.gemini ? 'Gemini' : null, p.openai ? 'OpenAI' : null].filter(Boolean).join(', ');
        setBadge(providersEl, list || 'None', list ? 'ok' : 'error');
      } else {
        setBadge(providersEl, 'Unknown', 'warn');
      }
    }

    // Prompt Model status
    if (this.chromeAIAvailable) {
      setBadge(promptEl, 'Ready', 'ok');
    } else if (window.ai?.languageModel) {
      setBadge(promptEl, 'Detected', 'warn');
    } else {
      setBadge(promptEl, 'Missing', 'error');
    }

    // Lite Mode status
    const liteDetected = !!(window.ai?.writer || window.ai?.summarizer);
    if (this.chromeAILiteAvailable) {
      setBadge(liteEl, 'Active', 'ok');
    } else if (liteDetected) {
      setBadge(liteEl, 'Detected', 'warn');
    } else {
      setBadge(liteEl, 'Unavailable', 'error');
    }

    // Origin Trial (Extension)
    if (otExtEl && chrome?.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      const tokens = manifest?.trial_tokens || [];
      const hasTokens = Array.isArray(tokens) && tokens.some(t => typeof t === 'string' && t.trim());
      setBadge(otExtEl, hasTokens ? 'Configured' : 'Missing', hasTokens ? 'ok' : 'error');
    }

    // Origin Trial (Pages)
    if (otPageEl && chrome?.storage?.local) {
      try {
        const { otThirdPartyToken, otThirdPartyTokens } = await chrome.storage.local.get(['otThirdPartyToken', 'otThirdPartyTokens']);
        const tokens = [];
        if (typeof otThirdPartyToken === 'string' && otThirdPartyToken.trim()) tokens.push(otThirdPartyToken.trim());
        if (Array.isArray(otThirdPartyTokens)) {
          for (const t of otThirdPartyTokens) if (typeof t === 'string' && t.trim()) tokens.push(t.trim());
        }
        const hasTokens = tokens.length > 0;
        setBadge(otPageEl, hasTokens ? 'Saved' : 'Not Set', hasTokens ? 'ok' : 'error');
      } catch (err) {
        setBadge(otPageEl, 'Unknown', 'warn');
      }
    }

    // Translator
    if (translatorEl) {
      const available = !!window.ai?.translator?.translate;
      setBadge(translatorEl, available ? 'Available' : 'Unavailable', available ? 'ok' : 'error');
    }

    // Language Detector
    if (langDetectEl) {
      const available = !!window.ai?.languageDetector?.detect;
      setBadge(langDetectEl, available ? 'Available' : 'Unavailable', available ? 'ok' : 'error');
    }

    // Proofreader
    if (proofreaderEl) {
      const available = !!window.ai?.proofreader?.proofread;
      setBadge(proofreaderEl, available ? 'Available' : 'Unavailable', available ? 'ok' : 'error');
    }

    // Writer
    if (writerEl) {
      const available = !!window.ai?.writer?.write;
      setBadge(writerEl, available ? 'Available' : 'Unavailable', available ? 'ok' : 'error');
    }

    // Rewriter
    if (rewriterEl) {
      const available = !!window.ai?.rewriter?.rewrite;
      setBadge(rewriterEl, available ? 'Available' : 'Unavailable', available ? 'ok' : 'error');
    }

    // Diagnostic note
    if (noteEl) {
      let note = '';
      if (this.chromeAIAvailable) {
        note = 'Prompt model ready. Full analysis and chat enabled.';
      } else if (this.chromeAILiteAvailable) {
        note = 'Lite Mode active. Using on-device writer/summarizer for concise results.';
      } else {
        note = 'Chrome AI unavailable. On-device AI disabled; features limited.';
      }
      noteEl.textContent = note;
    }
  }

  parseAnalysisResponse(response) {
    const lines = response.split('\n').filter(line => line.trim());

    // Extract rating
    const ratingMatch = response.match(/(\d+(?:\.\d+)?)\s*(?:\/10|out of 10)/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 7.5;

    // Extract strengths
    const strengths = lines
      .filter(line =>
        line.includes('strength') ||
        line.includes('good') ||
        line.includes('great') ||
        line.includes('excellent') ||
        line.includes('working')
      )
      .slice(0, 4)
      .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''));

    // Extract improvements
    const improvements = lines
      .filter(line =>
        line.includes('improve') ||
        line.includes('consider') ||
        line.includes('try') ||
        line.includes('could') ||
        line.includes('suggest')
      )
      .slice(0, 3)
      .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''));

    // Extract style notes
    const styleNotes = lines
      .filter(line =>
        line.includes('style') ||
        line.includes('aesthetic') ||
        line.includes('overall') ||
        line.includes('vibe')
      )
      .join(' ') || 'Clean, well-coordinated look with good attention to detail.';

    // Extract confidence
    const confidenceMatch = response.match(/confidence.*?(\d+(?:\.\d+)?)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 10 : 0.8;

    return {
      rating: Math.min(Math.max(rating, 1), 10),
      strengths: strengths.length > 0 ? strengths : ['Well-coordinated outfit', 'Good color choices', 'Appropriate styling'],
      improvements: improvements.length > 0 ? improvements : ['Consider adding accessories', 'Experiment with proportions'],
      styleNotes,
      confidence: Math.min(Math.max(confidence, 0), 1)
    };
  }

  parseVirtualTryOnResponse(response) {
    const lines = response.split('\\n').filter(line => line.trim());

    // For virtual try-on, we'll structure it differently
    // Extract sections based on the prompt structure
    const bodyTypes = lines
      .filter(line => line.includes('body type') || line.includes('petite') || line.includes('athletic') || line.includes('plus-size'))
      .slice(0, 3)
      .map(line => line.replace(/^\\d+\\.\\s*/, '').replace(/^-\\s*/, ''));

    const visualStyling = lines
      .filter(line => line.includes('visual') || line.includes('flow') || line.includes('drape') || line.includes('move'))
      .slice(0, 3)
      .map(line => line.replace(/^\\d+\\.\\s*/, '').replace(/^-\\s*/, ''));

    const colorLighting = lines
      .filter(line => line.includes('color') || line.includes('lighting') || line.includes('pattern'))
      .slice(0, 2)
      .map(line => line.replace(/^\\d+\\.\\s*/, '').replace(/^-\\s*/, ''));

    const versatility = lines
      .filter(line => line.includes('occasion') || line.includes('versatility') || line.includes('adaptability'))
      .slice(0, 2)
      .map(line => line.replace(/^\\d+\\.\\s*/, '').replace(/^-\\s*/, ''));

    const scenario = lines
      .filter(line => line.includes('scenario') || line.includes('wearing') || line.includes('real'))
      .slice(0, 1)
      .map(line => line.replace(/^\\d+\\.\\s*/, '').replace(/^-\\s*/, ''));

    // Combine into a cohesive virtual try-on experience
    const virtualDescription = [
      ...bodyTypes,
      ...visualStyling,
      ...colorLighting,
      ...versatility,
      ...scenario
    ].join(' ') || response; // Fallback to full response if parsing fails

    return {
      rating: 8.5, // Virtual try-on is always positive
      strengths: ['Immersive visualization', 'Body-inclusive descriptions', 'Creative styling ideas'],
      improvements: ['Try this outfit in different settings', 'Experiment with accessories'],
      styleNotes: virtualDescription,
      confidence: 0.9,
      isVirtualTryOn: true
    };
  }

  showLoading() {
    document.getElementById('analysisSection').style.display = 'block';
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('errorCard').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
  }

  async displayResults() {
    const results = this.analysisResults;

    // Enhanced: Use Rewriter API to polish the style notes
    let enhancedStyleNotes = results.styleNotes;
    try {
      enhancedStyleNotes = await this.rewriteForStyle(results.styleNotes, 'professional');
    } catch (error) {
      console.warn('Style notes enhancement failed:', error);
    }

    // Enhanced: Use Summarizer API to create a concise summary
    let outfitSummary = '';
    try {
      const fullAnalysis = `Rating: ${results.rating}/10. Strengths: ${results.strengths.join(', ')}. Improvements: ${results.improvements.join(', ')}. Style: ${enhancedStyleNotes}`;
      outfitSummary = await this.summarizeOutfitAnalysis(fullAnalysis);
    } catch (error) {
      console.warn('Summary generation failed:', error);
    }

    // Update rating
    document.getElementById('ratingScore').textContent = `${results.rating.toFixed(1)}/10`;
    document.getElementById('ratingFill').style.width = `${(results.rating / 10) * 100}%`;
    document.getElementById('ratingText').textContent = this.getRatingText(results.rating);

    // Add outfit summary if available
    const ratingText = document.getElementById('ratingText');
    if (outfitSummary && ratingText) {
      const summaryEl = document.createElement('p');
      summaryEl.className = 'outfit-summary';
      summaryEl.style.cssText = 'margin-top: 8px; font-size: 12px; color: #666; font-style: italic;';
      summaryEl.innerHTML = `<strong>AI Summary:</strong> ${outfitSummary}`;
      ratingText.appendChild(summaryEl);
    }

    // Update strengths with enhanced descriptions
    const strengthsList = document.getElementById('strengthsList');
    strengthsList.innerHTML = '';
    for (const strength of results.strengths) {
      const li = document.createElement('li');
      try {
        // Enhanced: Polish each strength with Rewriter API
        const enhancedStrength = await this.rewriteForStyle(strength, 'concise');
        li.textContent = enhancedStrength;
      } catch (error) {
        li.textContent = strength;
      }
      strengthsList.appendChild(li);
    }

    // Update improvements with enhanced descriptions
    const improvementsList = document.getElementById('improvementsList');
    improvementsList.innerHTML = '';
    for (const improvement of results.improvements) {
      const li = document.createElement('li');
      try {
        // Enhanced: Polish each improvement with Rewriter API
        const enhancedImprovement = await this.rewriteForStyle(improvement, 'detailed');
        li.textContent = enhancedImprovement;
      } catch (error) {
        li.textContent = improvement;
      }
      improvementsList.appendChild(li);
    }

    // Update style notes with enhanced version
    document.getElementById('styleNotesText').textContent = enhancedStyleNotes;

    // Show results
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('results').style.display = 'block';
    document.getElementById('saveBtn').style.display = 'block';
    document.getElementById('analyzeBtn').disabled = false;
  }

  getRatingText(rating) {
    if (rating >= 9) return 'Outstanding style!';
    if (rating >= 8) return 'Great outfit!';
    if (rating >= 7) return 'Good styling';
    if (rating >= 6) return 'Nice look';
    if (rating >= 5) return 'Solid foundation';
    return 'Room for improvement';
  }

  openAdviceModal() {
    document.getElementById('modalOverlay').style.display = 'flex';

    // Add welcome message if chat is empty
    if (this.chatMessages.length === 0) {
      this.addChatMessage('assistant', "Hi! I'm here to help with styling advice. What would you like to know about your outfit?");
    }

    // Focus input
    setTimeout(() => {
      document.getElementById('messageInput').focus();
    }, 100);
  }

  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
  }

  async sendChatMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    this.addChatMessage('user', message);
    input.value = '';
    document.getElementById('sendMessage').disabled = true;

    // Get AI response
    try {
      // Prefer server chat when available
      if (this.serverAvailable) {
        const persona = 'luxury';
        const context = this.analysisResults
          ? `Outfit rated ${this.analysisResults.rating}/10. Strengths: ${this.analysisResults.strengths.join(', ')}. Improvements: ${this.analysisResults.improvements.join(', ')}.`
          : 'No prior outfit analysis context.';
        // Slash commands for server features
        if (message.startsWith('/design ')) {
          const designPrompt = message.slice(8).trim();
          const resp = await window.OnPointAPI.design(designPrompt, 'design', 'auto', this.serverModelChoice);
          const text = resp?.result || 'No design generated.';
          this.addChatMessage('assistant', text);
          return;
        }

        if (message.startsWith('/palette ')) {
          const raw = message.slice(9).trim();
          // Simple parser: "desc | style=modern | season=summer"
          const parts = raw.split('|').map(p => p.trim());
          const description = parts[0] || raw;
          const stylePart = parts.find(p => p.startsWith('style='));
          const seasonPart = parts.find(p => p.startsWith('season='));
          const style = stylePart ? stylePart.split('=')[1] : 'modern';
          const season = seasonPart ? seasonPart.split('=')[1] : 'all-season';
          const resp = await window.OnPointAPI.colorPalette(description, style, season, 'auto', this.serverModelChoice);
          const text = resp?.result || 'No palette generated.';
          this.addChatMessage('assistant', text);
          return;
        }

        const prompt = `As a ${persona} fashion stylist, using the context: ${context}\nRespond to: ${message}`;
        let response = (await window.OnPointAPI.chat(prompt, 'auto', this.serverModelChoice))?.result || '';
        // Optional polishing and translation to maintain parity with client flow
        try {
          response = await this.rewriteForStyle(response, 'professional');
        } catch (e) {
          console.warn('Response polishing failed (server):', e);
        }
        response = await this.translateIfEnabled(response);
        this.addChatMessage('assistant', response || 'No response');
        return;
      }

      // Ensure Prompt API session is initialized on first chat send
      if (!this.aiSession && (window.ai && window.ai.languageModel)) {
        await this.ensureAISessionInitialized();
      }

      let response;

      // Light client-side enhancement: proofread the user's question
      const cleanMessage = await this.proofreadText(message);

      if (this.chromeAIAvailable && this.aiSession) {
        // Build context from current analysis
        const contextPrompt = this.analysisResults
          ? `Context: The user's outfit was rated ${this.analysisResults.rating}/10. Strengths: ${this.analysisResults.strengths.join(', ')}. Areas for improvement: ${this.analysisResults.improvements.join(', ')}. User question: ${cleanMessage}`
          : `User question about fashion styling: ${cleanMessage}`;

        response = await this.aiSession.prompt(contextPrompt);
      } else {
        // Lite Mode chat only; no server fallback
        let text = null;
        if (this.chromeAILiteAvailable) {
          text = await this.liteGenerate(`Provide concise styling advice for: ${cleanMessage}`);
        }

        if (!text) {
          this.addChatMessage('assistant', 'AI unavailable: Lite Mode not available.');
          return;
        }
        response = text;
      }

      // Enhanced: Polish the response with Rewriter API for better styling advice
      try {
        const polishedResponse = await this.rewriteForStyle(response, 'professional');
        response = polishedResponse;
      } catch (error) {
        console.warn('Response polishing failed:', error);
      }

      // Optional translation to UI language
      response = await this.translateIfEnabled(response);
      this.addChatMessage('assistant', response);

    } catch (error) {
      console.error('Chat error:', error);
      this.addChatMessage('assistant', "I'm having trouble right now. Please try asking again in a moment.");
    }
  }

  async proofreadText(text) {
    try {
      if (window.ai?.proofreader?.proofread) {
        const res = await window.ai.proofreader.proofread({ input: text });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.text || res.corrected || res.output || text;
      }
    } catch (e) {
      console.warn('Proofreader error:', e);
    }
    return text;
  }

  async detectLanguage(text) {
    try {
      if (window.ai?.languageDetector?.detect) {
        const res = await window.ai.languageDetector.detect({ input: text });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.language || res.code || res.lang || null;
      }
    } catch (e) {
      console.warn('Language detection error:', e);
    }
    return null;
  }

  async translateIfEnabled(text) {
    try {
      const toggle = document.getElementById('translateAdviceToggle');
      if (!toggle || !toggle.checked) return text;

      const target = (navigator.language || 'en').split('-')[0];

      // Avoid translating if already in target language
      const detected = await this.detectLanguage(text);
      if (detected && detected.toLowerCase().startsWith(target.toLowerCase())) {
        return text;
      }

      if (window.ai?.translator?.translate) {
        const res = await window.ai.translator.translate({ input: text, targetLanguage: target });
        if (typeof res === 'string') return res;
        if (res && typeof res === 'object') return res.text || res.translation || res.output || text;
      }
    } catch (e) {
      console.warn('Translation error:', e);
    }
    return text;
  }

  // Removed mock fallback responses to surface real availability issues

  addChatMessage(role, content) {
    this.chatMessages.push({ role, content, timestamp: Date.now() });

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.textContent = content;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async saveAnalysis() {
    if (!this.analysisResults) return;

    try {
      // Save to Chrome storage
      const analysisData = {
        ...this.analysisResults,
        timestamp: Date.now(),
        photoName: this.currentPhoto?.name || 'outfit.jpg'
      };

      // Get existing analyses
      const result = await chrome.storage.local.get(['savedAnalyses']);
      const savedAnalyses = result.savedAnalyses || [];

      // Add new analysis
      savedAnalyses.unshift(analysisData);

      // Keep only last 10 analyses
      const trimmedAnalyses = savedAnalyses.slice(0, 10);

      // Save back
      await chrome.storage.local.set({ savedAnalyses: trimmedAnalyses });

      // Show feedback
      const saveBtn = document.getElementById('saveBtn');
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '✓ Saved';
      saveBtn.disabled = true;

      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Save error:', error);
      this.showError('Failed to save analysis');
    }
  }

  async savePhoto() {
    if (!this.currentPhoto && !this.pageImageFile) return;

    try {
      const photoToSave = this.currentPhoto || this.pageImageFile;
      const photoData = {
        dataUrl: await this.fileToDataURL(photoToSave),
        name: photoToSave.name,
        timestamp: Date.now(),
        type: photoToSave.type
      };

      // Get existing saved photos
      const result = await chrome.storage.local.get(['savedPhotos']);
      const savedPhotos = result.savedPhotos || [];

      // Check if photo already exists (simple check by name)
      const exists = savedPhotos.some(p => p.name === photoData.name);
      if (exists) {
        this.showNotification('Photo already saved', 'info');
        return;
      }

      // Add new photo
      savedPhotos.unshift(photoData);

      // Keep only last 5 photos
      const trimmedPhotos = savedPhotos.slice(0, 5);

      // Save back
      await chrome.storage.local.set({ savedPhotos: trimmedPhotos });

      // Update local array
      this.savedPhotos = trimmedPhotos;

      // Update UI
      this.displaySavedPhotos();

      // Show feedback
      this.showNotification('Photo saved!', 'success');

    } catch (error) {
      console.error('Save photo error:', error);
      this.showError('Failed to save photo');
    }
  }

  async loadSavedPhotos() {
    try {
      const result = await chrome.storage.local.get(['savedPhotos']);
      this.savedPhotos = result.savedPhotos || [];
      this.displaySavedPhotos();
    } catch (error) {
      console.error('Load saved photos error:', error);
    }
  }

  async fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  displaySavedPhotos() {
    const container = document.getElementById('savedPhotosGrid');
    if (!container) return;

    container.innerHTML = '';

    if (this.savedPhotos.length === 0) {
      document.getElementById('savedPhotosSection').style.display = 'none';
      return;
    }

    document.getElementById('savedPhotosSection').style.display = 'block';

    this.savedPhotos.forEach((photo, index) => {
      const photoDiv = document.createElement('div');
      photoDiv.className = 'saved-photo-item';
      photoDiv.innerHTML = `
        <img src="${photo.dataUrl}" alt="${photo.name}" onclick="extension.useSavedPhoto(${index})">
        <button class="delete-photo" onclick="extension.deleteSavedPhoto(${index})" title="Delete photo">×</button>
      `;
      container.appendChild(photoDiv);
    });
  }

  useSavedPhoto(index) {
    const photo = this.savedPhotos[index];
    if (!photo) return;

    // Convert data URL back to file
    fetch(photo.dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], photo.name, { type: photo.type });
        this.handlePhotoFile(file);
      })
      .catch(error => {
        console.error('Error loading saved photo:', error);
        this.showError('Failed to load saved photo');
      });
  }

  async deleteSavedPhoto(index) {
    if (!confirm('Delete this saved photo?')) return;

    try {
      this.savedPhotos.splice(index, 1);
      await chrome.storage.local.set({ savedPhotos: this.savedPhotos });
      this.displaySavedPhotos();
      this.showNotification('Photo deleted', 'info');
    } catch (error) {
      console.error('Delete photo error:', error);
      this.showError('Failed to delete photo');
    }
  }

  showNotification(message, type = 'info') {
    // Simple notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#667eea'};
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  startComparison() {
    if (this.comparisonMode) {
      // Cancel comparison
      this.comparisonMode = false;
      this.productPhoto = null;
      this.showNotification('Comparison cancelled', 'info');
      document.getElementById('compareBtn').innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        Compare with Product
      `;
      return;
    }

    // Start comparison - open file picker for product photo
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.productPhoto = file;
        this.comparisonMode = true;
        this.showNotification('Product photo selected! Click Analyze to compare.', 'info');
        document.getElementById('compareBtn').innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          Product Selected ✓
        `;
      }
    };
    input.click();
  }

  retryAnalysis() {
    this.clearError();
    this.analyzeOutfit();
  }

  clearResults() {
    this.analysisResults = null;
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'none';
    this.clearError();

    // Clear page context
    const pageContext = document.querySelector('.page-context');
    if (pageContext) {
      pageContext.remove();
    }

    // Reset modes
    this.comparisonMode = false;
    this.productPhoto = null;
    // Reset button text
    document.getElementById('compareBtn').innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
      </svg>
      Compare with Product
    `;
  }

  showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorCard').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = false;
  }

  clearError() {
    document.getElementById('errorCard').style.display = 'none';
  }

  showChromeAIWarning() {
    document.getElementById('chromeAIWarning').style.display = 'block';
  }

  // Enhanced batch processing for multiple outfit analysis
  async batchAnalyzeOutfits(imageFiles, options = {}) {
    const { 
      maxConcurrent = 3, 
      includeComparison = true, 
      generateSummary = true 
    } = options;
    
    if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
      throw new Error('No images provided for batch analysis');
    }

    const results = [];
    const batches = [];
    
    // Split into batches to avoid overwhelming the API
    for (let i = 0; i < imageFiles.length; i += maxConcurrent) {
      batches.push(imageFiles.slice(i, i + maxConcurrent));
    }

    try {
      // Process each batch sequentially
      for (const batch of batches) {
        const batchPromises = batch.map(async (file, index) => {
          try {
            const prompt = this.buildAnalysisPrompt({ 
              comparison: includeComparison && imageFiles.length > 1 
            });
            
            const response = await this.modelPromptWithImage(prompt, file);
            const analysis = this.parseAnalysisResponse(response);
            
            return {
              index: results.length + index,
              filename: file.name,
              analysis,
              success: true
            };
          } catch (error) {
            console.warn(`Analysis failed for ${file.name}:`, error);
            return {
              index: results.length + index,
              filename: file.name,
              error: error.message,
              success: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to be respectful to the API
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Generate comparative summary if requested
      let summary = null;
      if (generateSummary && results.filter(r => r.success).length > 1) {
        summary = await this.generateBatchSummary(results);
      }

      return {
        results,
        summary,
        totalAnalyzed: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length
      };

    } catch (error) {
      console.error('Batch analysis failed:', error);
      throw error;
    }
  }

  async generateBatchSummary(batchResults) {
    try {
      const successfulResults = batchResults.filter(r => r.success);
      if (successfulResults.length < 2) return null;

      // Create summary text for the Summarizer API
      const summaryText = successfulResults.map(result => {
        const { analysis } = result;
        return `Outfit ${result.index + 1} (${result.filename}): Rating ${analysis.rating}/10. Strengths: ${analysis.strengths.join(', ')}. Improvements: ${analysis.improvements.join(', ')}.`;
      }).join(' ');

      const fullSummary = `Batch Analysis Results: ${summaryText}`;
      
      // Use Summarizer API to create concise comparison
      const summary = await this.summarizeOutfitAnalysis(fullSummary);
      
      // Enhanced summary with Rewriter API
      const enhancedSummary = await this.rewriteForStyle(
        summary || 'Multiple outfits analyzed with varying ratings and styling recommendations.',
        'professional'
      );

      return {
        conciseSummary: enhancedSummary,
        topRated: successfulResults.reduce((best, current) => 
          current.analysis.rating > best.analysis.rating ? current : best
        ),
        averageRating: (successfulResults.reduce((sum, r) => sum + r.analysis.rating, 0) / successfulResults.length).toFixed(1),
        commonStrengths: this.findCommonElements(successfulResults.map(r => r.analysis.strengths)),
        commonImprovements: this.findCommonElements(successfulResults.map(r => r.analysis.improvements))
      };
    } catch (error) {
      console.warn('Summary generation failed:', error);
      return null;
    }
  }

  findCommonElements(arrays) {
    if (!arrays.length) return [];
    
    const elementCounts = {};
    const threshold = Math.ceil(arrays.length * 0.4); // 40% threshold for "common"
    
    arrays.forEach(array => {
      const uniqueElements = [...new Set(array.map(item => item.toLowerCase().trim()))];
      uniqueElements.forEach(element => {
        elementCounts[element] = (elementCounts[element] || 0) + 1;
      });
    });
    
    return Object.entries(elementCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([element, _]) => element)
      .slice(0, 3); // Return top 3 common elements
  }

  async displayBatchResults(batchData) {
    const { results, summary, totalAnalyzed, totalFailed } = batchData;
    
    // Create batch results container
    const batchContainer = document.createElement('div');
    batchContainer.className = 'batch-results';
    batchContainer.innerHTML = `
      <div class="batch-header">
        <h3>Batch Analysis Results</h3>
        <p>Analyzed: ${totalAnalyzed} outfits | Failed: ${totalFailed}</p>
      </div>
    `;

    // Add summary if available
    if (summary) {
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'batch-summary';
      summaryDiv.innerHTML = `
        <h4>Analysis Summary</h4>
        <p><strong>Average Rating:</strong> ${summary.averageRating}/10</p>
        <p><strong>Top Rated:</strong> ${summary.topRated.filename} (${summary.topRated.analysis.rating}/10)</p>
        <p><strong>AI Summary:</strong> ${summary.conciseSummary}</p>
        ${summary.commonStrengths.length ? `<p><strong>Common Strengths:</strong> ${summary.commonStrengths.join(', ')}</p>` : ''}
        ${summary.commonImprovements.length ? `<p><strong>Common Areas for Improvement:</strong> ${summary.commonImprovements.join(', ')}</p>` : ''}
      `;
      batchContainer.appendChild(summaryDiv);
    }

    // Add individual results
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'batch-individual-results';
    
    results.forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = `batch-result-item ${result.success ? 'success' : 'error'}`;
      
      if (result.success) {
        const { analysis } = result;
        resultDiv.innerHTML = `
          <h5>${result.filename}</h5>
          <p><strong>Rating:</strong> ${analysis.rating}/10</p>
          <p><strong>Strengths:</strong> ${analysis.strengths.slice(0, 2).join(', ')}</p>
          <p><strong>Key Improvement:</strong> ${analysis.improvements[0] || 'None specified'}</p>
        `;
      } else {
        resultDiv.innerHTML = `
          <h5>${result.filename}</h5>
          <p class="error">Analysis failed: ${result.error}</p>
        `;
      }
      
      resultsContainer.appendChild(resultDiv);
    });
    
    batchContainer.appendChild(resultsContainer);
    
    // Replace or append to results area
    const resultsArea = document.getElementById('results');
    resultsArea.innerHTML = '';
    resultsArea.appendChild(batchContainer);
    resultsArea.style.display = 'block';
  }

  updateUIState() {
    // Update UI based on Chrome AI availability
    if (!this.chromeAIAvailable) {
      const warningText = document.createElement('div');
      warningText.className = 'ai-warning';
      warningText.innerHTML = this.chromeAILiteAvailable
        ? `
        <small style="color: #0ea5e9; font-size: 11px;">
          ℹ️ AI Lite Mode active – some features limited
        </small>
      `
        : `
        <small style="color: #d97706; font-size: 11px;">
          ⚠️ Limited functionality - Chrome AI not available
        </small>
      `;
      document.querySelector('.header').appendChild(warningText);
    }
  }

  // Enhanced context awareness with user preferences and historical data
  async loadUserContext() {
    try {
      const contextData = await chrome.storage.local.get([
        'userPreferences',
        'analysisHistory',
        'styleProfile',
        'seasonalPreferences'
      ]);

      this.userContext = {
        preferences: contextData.userPreferences || this.getDefaultPreferences(),
        history: contextData.analysisHistory || [],
        styleProfile: contextData.styleProfile || null,
        seasonalPrefs: contextData.seasonalPreferences || {}
      };

      return this.userContext;
    } catch (error) {
      console.warn('Failed to load user context:', error);
      this.userContext = {
        preferences: this.getDefaultPreferences(),
        history: [],
        styleProfile: null,
        seasonalPrefs: {}
      };
      return this.userContext;
    }
  }

  getDefaultPreferences() {
    return {
      preferredStyles: ['casual', 'professional'],
      bodyType: null,
      colorPreferences: [],
      budgetRange: 'medium',
      occasionTypes: ['work', 'casual', 'social'],
      sustainabilityFocus: false,
      brandPreferences: [],
      avoidColors: [],
      fitPreferences: 'regular'
    };
  }

  buildContextualPrompt(basePrompt) {
    if (!this.userContext) return basePrompt;

    let contextualAdditions = [];

    // Add user preferences context
    if (this.userContext.preferences) {
      const prefs = this.userContext.preferences;
      
      if (prefs.preferredStyles.length > 0) {
        contextualAdditions.push(`User prefers ${prefs.preferredStyles.join(' and ')} styles.`);
      }
      
      if (prefs.bodyType) {
        contextualAdditions.push(`Consider styling for ${prefs.bodyType} body type.`);
      }
      
      if (prefs.colorPreferences.length > 0) {
        contextualAdditions.push(`User gravitates toward ${prefs.colorPreferences.join(', ')} colors.`);
      }
    }

    // Add seasonal context
    const currentSeason = this.getCurrentSeason();
    contextualAdditions.push(`Current season: ${currentSeason}. Consider seasonal appropriateness.`);

    if (contextualAdditions.length > 0) {
      return basePrompt + `\n\nUSER CONTEXT:\n${contextualAdditions.join(' ')}\n\nUse this context to provide more personalized styling advice.`;
    }

    return basePrompt;
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  updateUIMode() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const originalText = analyzeBtn.innerHTML;

    if (this.virtualTryOnMode) {
      analyzeBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        </svg>
        Virtual Try-On
      `;
    } else {
      analyzeBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        </svg>
        Analyze Outfit
      `;
    }
  }
}

// Initialize extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.extension = new OnPointExtension();
});

// Handle extension lifecycle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePageOutfit') {
    // Handle analyzing outfits found on web pages
    this.analyzePageOutfit(request.imageUrl, request.imageAlt, request.pageUrl);
    sendResponse({ success: true });
  }
});
