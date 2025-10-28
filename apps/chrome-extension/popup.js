// OnPoint Fashion AI Chrome Extension Popup JavaScript

class OnPointExtension {
  constructor() {
    this.currentPhoto = null;
    this.analysisResults = null;
    this.chromeAIAvailable = false;
    this.aiSession = null;
    this.chatMessages = [];

    this.init();
  }

  async init() {
    await this.checkChromeAI();
    this.setupEventListeners();
    this.updateUIState();
  }

  // Check if Chrome AI APIs are available
  async checkChromeAI() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    try {
      statusIndicator.className = 'status-indicator checking';
      statusText.textContent = 'Checking AI...';

      if ('ai' in window && window.ai.languageModel) {
        const availability = await window.ai.languageModel.availability();

        if (availability === 'readily' || availability === 'after-download') {
          this.chromeAIAvailable = true;
          statusIndicator.className = 'status-indicator';
          statusText.textContent = 'AI Ready';

          // Initialize AI session
          await this.initializeAISession();
        } else {
          throw new Error('AI not available on this device');
        }
      } else {
        throw new Error('Chrome AI APIs not found');
      }
    } catch (error) {
      console.warn('Chrome AI not available:', error);
      this.chromeAIAvailable = false;
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

    // Action buttons
    document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeOutfit());
    document.getElementById('getAdviceBtn').addEventListener('click', () => this.openAdviceModal());
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
      if (!this.chromeAIAvailable) {
        // Fallback analysis without Chrome AI
        await this.performFallbackAnalysis();
        return;
      }

      // Use Chrome AI for analysis
      const analysisPrompt = `Analyze this fashion outfit and provide:

      1. Overall rating (1-10) with brief explanation
      2. 3-4 specific strengths of the outfit
      3. 2-3 areas for improvement with actionable suggestions
      4. Style notes about the overall aesthetic
      5. Your confidence level in this analysis

      Be constructive and focus on actionable advice. The user wants to improve their style.`;

      const response = await this.aiSession.prompt(analysisPrompt);

      // Parse AI response into structured data
      this.analysisResults = this.parseAnalysisResponse(response);

      await this.displayResults();

    } catch (error) {
      console.error('Analysis error:', error);
      this.showError('Failed to analyze outfit. Please try again.');
    }
  }

  async performFallbackAnalysis() {
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock analysis results
    this.analysisResults = {
      rating: Math.floor(Math.random() * 3) + 7, // 7-9
      strengths: [
        'Good color coordination between pieces',
        'Appropriate fit for the style',
        'Well-balanced proportions',
        'Suitable for the occasion'
      ],
      improvements: [
        'Consider adding a statement accessory',
        'The silhouette could be more defined',
        'Try experimenting with texture contrast'
      ],
      styleNotes: 'Clean, well-coordinated look with good attention to detail. The overall aesthetic is polished and appropriate.',
      confidence: 0.8
    };

    await this.displayResults();
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

  showLoading() {
    document.getElementById('analysisSection').style.display = 'block';
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('errorCard').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
  }

  async displayResults() {
    const results = this.analysisResults;

    // Update rating
    document.getElementById('ratingScore').textContent = `${results.rating.toFixed(1)}/10`;
    document.getElementById('ratingFill').style.width = `${(results.rating / 10) * 100}%`;
    document.getElementById('ratingText').textContent = this.getRatingText(results.rating);

    // Update strengths
    const strengthsList = document.getElementById('strengthsList');
    strengthsList.innerHTML = '';
    results.strengths.forEach(strength => {
      const li = document.createElement('li');
      li.textContent = strength;
      strengthsList.appendChild(li);
    });

    // Update improvements
    const improvementsList = document.getElementById('improvementsList');
    improvementsList.innerHTML = '';
    results.improvements.forEach(improvement => {
      const li = document.createElement('li');
      li.textContent = improvement;
      improvementsList.appendChild(li);
    });

    // Update style notes
    document.getElementById('styleNotesText').textContent = results.styleNotes;

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
      let response;

      if (this.chromeAIAvailable && this.aiSession) {
        // Build context from current analysis
        const contextPrompt = this.analysisResults
          ? `Context: The user's outfit was rated ${this.analysisResults.rating}/10. Strengths: ${this.analysisResults.strengths.join(', ')}. Areas for improvement: ${this.analysisResults.improvements.join(', ')}. User question: ${message}`
          : `User question about fashion styling: ${message}`;

        response = await this.aiSession.prompt(contextPrompt);
      } else {
        // Fallback responses
        response = this.getFallbackResponse(message);
      }

      this.addChatMessage('assistant', response);

    } catch (error) {
      console.error('Chat error:', error);
      this.addChatMessage('assistant', "I'm having trouble right now. Please try asking again in a moment.");
    }
  }

  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('color') || lowerMessage.includes('colour')) {
      return "For colors, try complementary or analogous color schemes. Neutrals like navy, gray, and beige are versatile bases. Add pops of color through accessories.";
    }

    if (lowerMessage.includes('accessory') || lowerMessage.includes('accessories')) {
      return "Accessories can elevate any outfit! Try a statement necklace, watch, or scarf. Keep it balanced - if you're wearing bold clothing, choose subtle accessories.";
    }

    if (lowerMessage.includes('fit') || lowerMessage.includes('size')) {
      return "Proper fit is crucial! Clothes should follow your body's natural lines without being too tight or loose. Consider tailoring for the perfect fit.";
    }

    if (lowerMessage.includes('occasion') || lowerMessage.includes('event')) {
      return "Consider the occasion's dress code and setting. When in doubt, it's better to be slightly overdressed than underdressed. Comfort is also key!";
    }

    return "That's a great question! For personalized styling advice, consider the occasion, your body type, and personal style preferences. What specific aspect would you like to focus on?";
  }

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

  retryAnalysis() {
    this.clearError();
    this.analyzeOutfit();
  }

  clearResults() {
    this.analysisResults = null;
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'none';
    this.clearError();
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

  updateUIState() {
    // Update UI based on Chrome AI availability
    if (!this.chromeAIAvailable) {
      const warningText = document.createElement('div');
      warningText.className = 'ai-warning';
      warningText.innerHTML = `
        <small style="color: #d97706; font-size: 11px;">
          ⚠️ Limited functionality - Chrome AI not available
        </small>
      `;
      document.querySelector('.header').appendChild(warningText);
    }
  }
}

// Initialize extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OnPointExtension();
});

// Handle extension lifecycle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePageOutfit') {
    // Handle analyzing outfits found on web pages
    console.log('Analyzing outfit from page:', request.imageUrl);
    sendResponse({ success: true });
  }
});
