# OnPoint Fashion AI - Chrome Extension

**AI-Powered Fashion Analysis & Virtual Try-On using Chrome Built-in AI**

*Submission for Google Chrome Built-in AI Challenge 2025*

## 🎯 Overview

OnPoint Fashion AI leverages Chrome's built-in AI APIs to provide instant, privacy-first fashion analysis and styling advice. Analyze your outfits, get AI-powered feedback, explore virtual try-on experiences, and compare with products - all running locally in your browser.

### 🏆 Challenge Alignment

Built for the **Google Chrome Built-in AI Challenge 2025**, utilizing:
- **Prompt API** - Fashion analysis & virtual try-on
- **Writer API** - Styling recommendations
- **Rewriter API** - Fashion descriptions
- **Summarizer API** - Key insights

## ✨ Key Features

### 🔍 **Smart Fashion Analysis**
- Upload photos or analyze images directly from e-commerce sites
- Detailed AI critique with ratings, strengths, and improvement suggestions
- **Virtual Try-On Mode**: Immersive text descriptions of how outfits look on different body types
- **Product Comparison**: Compare your style with fashion items for coordination advice

### 💬 **Interactive Styling Chat**
- Real-time AI fashion consultation
- Context-aware recommendations based on your analyzed outfits
- Personalized advice for colors, fit, accessories, and occasions

### 🖼️ **Photo Management**
- Persistent storage of favorite outfit photos
- Quick reuse across sessions
- Visual gallery with easy selection

### 🔒 **Privacy & Performance**
- **100% Local Processing** - No external APIs or data sharing
- Works offline after AI model download
- No server costs or API quotas
- Chrome's built-in privacy protections

## 🚀 Installation & Setup

### Prerequisites
- **Chrome 138+** with AI features enabled
- **Chrome AI APIs** available on your device
- Minimum **4GB VRAM** or **16GB RAM** + **4 CPU cores**
- **22GB free storage** for AI models

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/onpoint
   cd onpoint/apps/chrome-extension
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the extension folder
   - The OnPoint Fashion AI extension should appear in your toolbar

3. **Verify Chrome AI**
   - Visit `chrome://on-device-internals`
   - Ensure Gemini Nano model is available
   - The extension will show AI status in the popup

### Configure Origin Trial Tokens via .env (optional)

If you need Origin Trial tokens (e.g., Writer/Rewriter/Proofreader APIs, or Prompt on Chrome 131–136), manage them through a local `.env` file.

1. Create `.env` next to `manifest.json` using the template:
   ```bash
   cp .env.example .env
   # Edit .env and paste your token strings
   ```

2. Supported variables (paste full token strings):
   - `OT_WRITER_TOKEN` — Chrome Extensions token
   - `OT_REWRITER_TOKEN` — Chrome Extensions token
   - `OT_PROOFREADER_TOKEN` — Chrome Extensions token
   - `OT_PROMPT_TOKEN` — Chrome Extensions token (only for Chrome 131–136)
   - `OT_EXTRA_TOKENS` — optional, comma-separated list for rotations

3. Inject tokens into `manifest.json`:
   ```bash
   npm run inject-ot
   # or as part of build
   npm run build
   ```

This keeps tokens out of version control and writes them into `manifest.json` under `trial_tokens`. Page-origin tokens (Third‑party matching) can be saved directly in the popup Diagnostics and are injected by the content script.

### Alternative Installation
Download the packaged extension from our [releases page](../../releases) and install directly.

## 🎨 How to Use

### Quick Start
1. **Click the OnPoint icon** in your Chrome toolbar
2. **Upload or select a photo** from your saved gallery
3. **Choose your analysis mode**:
- **Analyze Outfit**: Get detailed fashion critique
- **Virtual Try-On**: Experience immersive outfit descriptions
   - **Compare with Product**: Analyze coordination with fashion items

### Advanced Features

#### **E-Commerce Integration**
- Browse fashion sites and hover over product images
- Click "Analyze Style" for instant AI feedback on any item
- No need to download images - analyzes directly from web

#### **Photo Management**
- **Save Photos**: Keep favorite outfits for quick reuse
- **Visual Gallery**: Click saved photos to analyze instantly
- **Persistent Storage**: Photos remain available across sessions

#### **Interactive Chat**
- **Get Styling Advice**: Chat with AI fashion expert
- **Context-Aware**: Recommendations based on your analyzed outfits
- **Personalized**: Advice tailored to your style and preferences

## 🛠 Technical Details

**Architecture**: Modular Chrome extension using built-in AI APIs
- **Prompt API**: Fashion analysis, virtual try-on, and chat
- **Writer API**: Generate styling recommendations
- **Rewriter API**: Refine fashion descriptions
- **Summarizer API**: Extract key insights

**Storage**: Local Chrome storage for photos and analysis history
**Privacy**: 100% client-side processing, no external data transmission

## 📊 Example Output

**Fashion Analysis**:
- **Rating**: 8.2/10 - "Great outfit!"
- **Strengths**: Excellent color coordination, perfect fit, balanced accessories
- **Improvements**: Consider rolled sleeves, add statement necklace

**Virtual Try-On**: "This outfit flows beautifully on athletic builds, with the fabric draping naturally and creating movement. On petite frames, it maintains proportion while the colors pop against various skin tones..."

**Product Comparison**: "Your casual style coordinates well with this blazer - the 85% compatibility rating suggests adding it would elevate your everyday looks significantly."

## 🏗 Development

**Setup**: Clone repo → Load unpacked in Chrome Developer mode → Test with Chrome AI enabled

**File Structure**: Modular extension with popup UI, content scripts, and local AI integration

## 🏆 Challenge Entry

**Built for Google Chrome Built-in AI Challenge 2025**
- Uses Prompt, Writer, Rewriter, and Summarizer APIs
- Privacy-first: 100% local processing, no external APIs required
- Multimodal: Processes images + text for comprehensive fashion analysis

**Target Categories**: Most Helpful Chrome Extension + Best Multimodal AI Application

## 📄 License

MIT License - see [LICENSE](../../LICENSE) file for details.

## 📞 Contact

- **Issues**: [GitHub Issues](../../issues)
- **Demo**: [View Demo Video](link-to-video)

---

**Built with ❤️ for the Google Chrome Built-in AI Challenge 2025**

*Transforming how people approach fashion with the power of local AI*