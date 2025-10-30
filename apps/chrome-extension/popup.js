// OnPoint Fashion AI Chrome Extension Popup JavaScript

class OnPointExtension {
  constructor() {
    this.currentPhoto = null;
    this.analysisResults = null;
    this.chromeAIAvailable = false;
    this.aiSession = null;
    this.chatMessages = [];

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
    await this.checkChromeAI();
    this.setupEventListeners();
    await this.loadSavedPhotos();
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
      if (!this.chromeAIAvailable) {
        // Fallback analysis without Chrome AI
        await this.performFallbackAnalysis();
        return;
      }

      // Use Chrome AI for analysis
      let analysisPrompt;
      if (this.virtualTryOnMode) {
        analysisPrompt = `Provide a detailed virtual try-on experience for this outfit. Describe:

        1. How this outfit would look and feel when worn by different body types (petite, athletic, plus-size)
        2. Visual styling suggestions - how it flows, drapes, and moves
        3. Color and pattern interactions in real lighting conditions
        4. Occasion versatility and styling adaptability
        5. A vivid, imaginative description of wearing this outfit in a real scenario

        Focus on creating an immersive, positive visualization experience. Be descriptive and encouraging.`;
      } else if (this.comparisonMode && this.productPhoto) {
        analysisPrompt = `Compare this personal outfit with the selected product item and provide styling advice:

        1. Overall compatibility rating (1-10) between the personal style and product
        2. How well they coordinate in terms of color, style, and aesthetic
        3. Specific styling suggestions for wearing the product with similar outfits
        4. Recommended accessories or modifications to make them work together
        5. Alternative styling approaches for this product

        Be specific about coordination and provide actionable styling recommendations.`;
      } else {
        analysisPrompt = `Analyze this fashion outfit and provide:

        1. Overall rating (1-10) with brief explanation
        2. 3-4 specific strengths of the outfit
        3. 2-3 areas for improvement with actionable suggestions
        4. Style notes about the overall aesthetic
        5. Your confidence level in this analysis

        Be constructive and focus on actionable advice. The user wants to improve their style.`;
      }

      const response = await this.aiSession.prompt(analysisPrompt);

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
      if (!this.chromeAIAvailable) {
        this.showError('Chrome AI is required for page image analysis. Please upload a photo directly.');
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

      // Use Chrome AI for analysis with context
      const contextInfo = pageUrl ? ` from ${new URL(pageUrl).hostname}` : '';
      const analysisPrompt = `Analyze this fashion outfit${contextInfo} and provide:

      1. Overall rating (1-10) with brief explanation
      2. 3-4 specific strengths of the outfit
      3. 2-3 areas for improvement with actionable suggestions
      4. Style notes about the overall aesthetic and how it might fit different body types
      5. Your confidence level in this analysis

      Consider the context that this appears to be a product or styled outfit${contextInfo}. Be constructive and focus on actionable advice.`;

      const aiResponse = await this.aiSession.prompt(analysisPrompt);

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
