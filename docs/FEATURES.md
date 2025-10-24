# OnPoint Features & User Flows

**Version:** 1.0  
**Last Updated:** October 24, 2025  
**Status:** Feature Specification

---

## Table of Contents

1. [Core Features Overview](#core-features-overview)
2. [Digital Closet Management](#digital-closet-management)
3. [AI-Powered Collage Creation](#ai-powered-collage-creation)
4. [Virtual Try-On Experience](#virtual-try-on-experience)
5. [AI Fashion Critique](#ai-fashion-critique)
6. [Product Sourcing](#product-sourcing)
7. [Stylist Marketplace](#stylist-marketplace)
8. [Worldcoin Mini App Features](#worldcoin-mini-app-features)

---

## Core Features Overview

### Feature Matrix

| Feature | Web | Mobile | Mini App | Status |
|---------|-----|--------|----------|--------|
| Digital Closet | ✅ | ✅ | ✅ | Core |
| AI Collage Creator | ✅ | ✅ | - | Core |
| Virtual Try-On | ✅ | ✅ | - | Core |
| AI Critique | ✅ | ✅ | - | Core |
| Product Sourcing | ✅ | ✅ | - | Core |
| Stylist Marketplace | ✅ | ✅ | ✅ | Core |
| NFT Minting | ✅ | ✅ | ✅ | Web3 |
| Worldcoin Verification | - | ✅ | ✅ | Identity |
| Style Challenges | - | - | �� | Community |
| Exclusive Drops | - | - | ✅ | Community |

---

## Digital Closet Management

### Overview

The digital closet is the foundation of OnPoint. Users organize their fashion items as NFTs, with AI-powered automatic tagging and metadata management.

### User Journey: Upload Item

```
1. Navigate to Closet → Click "Add Item"
   ↓
2. Choose upload method:
   • Take photo with camera
   • Upload from device
   • Import from URL
   ↓
3. AI automatically detects and tags:
   • Category (shirt, pants, shoes, accessory)
   • Colors (primary, secondary, accent)
   • Style tags (casual, formal, vintage, streetwear)
   • Brand recognition (if visible)
   • Season appropriateness
   ↓
4. User reviews and edits AI suggestions
   ↓
5. Add custom metadata:
   • Purchase date and price
   • Occasions worn
   • Care instructions
   • Personal notes
   ↓
6. Choose storage option:
   • Save locally (IndexedDB/MMKV)
   • Mint as NFT on ZetaChain
   ↓
7. Item added to closet
```

### Key Components

**Item Grid**:
- Filtering by category, color, season, brand
- Search functionality
- Sorting options (newest, most worn, price)
- Bulk actions (delete, export, mint)

**Upload Interface**:
- Drag-and-drop support
- Camera integration
- URL import
- Batch upload capability

**Item Detail View**:
- Full metadata display
- Edit capabilities
- Wear history
- NFT status
- Share options

**AI Tagging**:
- Automatic category detection
- Color extraction (hex values)
- Style tag suggestions
- Brand recognition
- Season classification

### Technical Implementation

**AI Tagging Flow**:
1. Image uploaded to client
2. Sent to GPT-4V for analysis
3. Structured JSON response with tags
4. User reviews suggestions
5. Metadata stored locally
6. Optional IPFS upload for NFT

**Storage Options**:
- **Local Only**: IndexedDB (web) / MMKV (mobile)
- **NFT**: IPFS upload + ZetaChain minting
- **Sync**: Blockchain events trigger cross-platform sync

### Features

- ✅ Automatic AI tagging
- ✅ Manual metadata editing
- ✅ Bulk operations
- ✅ Search and filter
- ✅ Wear history tracking
- ✅ NFT minting
- ✅ Cross-platform sync
- ✅ Offline access
- ✅ Export functionality
- ✅ Social sharing

---

## AI-Powered Collage Creation

### Overview

Create mood boards and style collages with AI enhancement. Combine images from your closet, inspiration photos, and AI-generated elements.

### User Journey: Create Collage

```
1. Navigate to Styles → Click "Create Collage"
   ↓
2. Choose creation method:
   • Start from scratch (blank canvas)
   • Upload inspiration images
   • Generate from text prompt
   ↓
3. Add elements to canvas:
   • Upload additional images
   • Select items from closet
   • Add text overlays
   • Apply filters and effects
   ↓
4. Arrange elements:
   • Drag and drop positioning
   • Resize and rotate
   • Layer management (z-index)
   • Adjust opacity and blending modes
   ↓
5. AI enhancement (optional):
   • "Make it cohesive" → AI adjusts colors and composition
   • "Add missing piece" → AI suggests/generates complementary items
   • "Style it like [celebrity/era]" → AI applies style transfer
   ↓
6. Save options:
   • Save draft locally
   • Export as image (PNG/JPG)
   • Mint as NFT
   • Share to social media
   ↓
7. Collage added to gallery
```

### Canvas Features

**Editing Tools**:
- Fabric.js for canvas manipulation
- Layer management
- Transform tools (move, resize, rotate)
- Filter effects (brightness, contrast, saturation)
- Text overlay with styling
- Alignment guides

**AI Enhancement**:
- Color harmony analysis
- Composition suggestions
- Missing element detection
- Style transfer
- Automatic layout optimization

**Export Options**:
- PNG/JPG with custom resolution
- SVG for vector editing
- NFT metadata with full composition data
- Social media optimized sizes

### Technical Implementation

**Canvas Stack**:
- Fabric.js for manipulation
- HTML5 Canvas for rendering
- WebGL for advanced effects
- Service Worker for offline support

**AI Enhancement**:
- GPT-4V for analysis
- DALL-E 3 for generation
- LangChain for workflow orchestration
- Caching for performance

### Features

- ✅ Blank canvas creation
- ✅ Multi-image upload
- ✅ Closet item integration
- ✅ Text overlays
- ✅ Filter effects
- ✅ Layer management
- ✅ AI enhancement
- ✅ Style transfer
- ✅ Element suggestions
- ✅ NFT minting
- ✅ Social sharing
- ✅ Draft saving

---

## Virtual Try-On Experience

### Overview

AR-powered outfit visualization. See how items look on your body in real-time using pose detection and 3D rendering.

### User Journey: Virtual Try-On

```
1. Navigate to Try-On page
   ↓
2. Grant camera permissions
   ↓
3. Position body in frame (visual guides provided)
   ↓
4. Real-time pose detection activates
   ↓
5. Select garment from closet or catalog
   ↓
6. 3D model overlaid on body
   ↓
7. Adjust fit and position with sliders:
   • Scale
   • Horizontal offset
   • Vertical offset
   • Rotation
   ↓
8. Move around to see different angles
   ↓
9. Capture screenshot or video
   ↓
10. Save to gallery or share
```

### AR Features

**Pose Detection**:
- MediaPipe Pose Landmarker (68+ landmarks)
- Real-time body tracking
- Shoulder width calculation
- Torso height estimation
- Limb positioning

**3D Rendering**:
- Three.js for web
- React Three Fiber for mobile
- GLTF/GLB model support
- Texture mapping
- Lighting and shadows
- Perspective correction

**Garment Overlay**:
- Automatic positioning based on pose
- Fit adjustment sliders
- Color preview
- Size estimation
- Multiple angle views

### Technical Implementation

**Web Stack**:
- Three.js for 3D rendering
- MediaPipe for pose detection
- WebXR API for AR (future)
- Canvas for screenshot capture

**Mobile Stack**:
- React Native Vision Camera
- MediaPipe Pose Landmarker
- React Three Fiber Native
- Skia for 2D overlays

**Performance Optimization**:
- Frame skipping (process every 3rd frame)
- Model quantization (INT8)
- GPU acceleration
- Texture caching
- Progressive loading

### Features

- ✅ Real-time pose detection
- ✅ 3D garment overlay
- ✅ Fit adjustment
- ✅ Multiple angles
- ✅ Screenshot capture
- ✅ Video recording
- ✅ Color preview
- ✅ Size estimation
- ✅ Social sharing
- ✅ Offline capability

---

## AI Fashion Critique

### Overview

Professional fashion feedback powered by AI. Submit outfits for detailed analysis including fit, color harmony, style coherence, and improvement suggestions.

### User Journey: Get Critique

```
1. Navigate to Critique page
   ↓
2. Submit outfit:
   • Upload photo
   • Select items from closet
   • Use recent try-on session
   ↓
3. Specify context (optional):
   • Occasion (date, work, casual, formal)
   • Weather/season
   • Personal style goals
   ↓
4. Submit for AI analysis
   ↓
5. Wait for critique generation (10-30 seconds)
   ↓
6. View detailed feedback:
   • Overall rating (1-10)
   • Fit assessment
   • Color harmony analysis
   • Style coherence
   • Occasion appropriateness
   • Improvement suggestions
   ↓
7. View product recommendations
   ↓
8. Save critique or mint as NFT
   ↓
9. Share on social media
```

### Critique Components

**Analysis Sections**:
- **Overall Rating**: 1-10 score with visual indicator
- **Fit Assessment**: Detailed analysis of how pieces fit together
- **Color Analysis**: Harmony, contrast, palette evaluation
- **Style Coherence**: How well pieces work together
- **Occasion Appropriateness**: Suitability for stated context
- **Strengths**: Array of positive aspects
- **Improvements**: Specific, actionable suggestions
- **Product Recommendations**: Items that would enhance the outfit

**Critique Display**:
- Markdown-formatted feedback
- Visual rating indicators
- Collapsible sections
- Product cards with links
- Share buttons
- NFT minting option

### Technical Implementation

**Critique Generation**:
- GPT-4V for image analysis
- LangChain for structured workflows
- JSON mode for consistent output
- Prompt engineering for quality
- Caching for performance

**Product Recommendations**:
- Vector search in MongoDB
- Semantic similarity matching
- Retail API integration
- Affiliate link management
- Real-time price updates

### Features

- ✅ Photo upload
- ✅ Closet item selection
- ✅ Context specification
- ✅ Detailed analysis
- ✅ Product recommendations
- ✅ Improvement suggestions
- ✅ NFT minting
- ✅ Social sharing
- ✅ Critique history
- ✅ Shareable links

---

## Product Sourcing

### Overview

AI-powered retail product discovery. Find similar items, search by description, and discover new products with visual and semantic search.

### User Journey: Visual Search

```
1. Navigate to Sourcing page
   ↓
2. Choose search method:
   • Upload inspiration image
   • Take photo
   • Select from closet
   ↓
3. AI analyzes image and extracts:
   • Item type and category
   • Color palette
   • Style attributes
   • Brand (if recognizable)
   ↓
4. Search across retail partners
   ↓
5. Display results with filters:
   • Price range
   • Brand
   • Retailer
   • Availability
   • Similarity score
   ↓
6. Click product for details
   ↓
7. Purchase via affiliate link or save to wishlist
```

### Search Features

**Visual Search**:
- Image upload or camera
- AI-powered item extraction
- Color palette analysis
- Style attribute detection
- Brand recognition

**Text Search**:
- Natural language queries
- Semantic understanding
- Filter suggestions
- Auto-complete

**Filtering**:
- Price range slider
- Brand multi-select
- Retailer selection
- Availability status
- Similarity score threshold

**Results Display**:
- Product cards with images
- Price and retailer info
- Similarity score
- Availability status
- Quick add to wishlist
- Affiliate link

### Technical Implementation

**Visual Search**:
- GPT-4V for image analysis
- Structured JSON extraction
- Retail API integration (ShopStyle, Google Shopping, Amazon)
- Affiliate link management
- Real-time price scraping

**Semantic Search**:
- Vector embeddings
- MongoDB Atlas Vector Search
- Hybrid search (text + image)
- Ranking algorithm

### Features

- ✅ Visual search
- ✅ Text search
- ✅ Natural language queries
- ✅ Multi-filter support
- ✅ Price comparison
- ✅ Retailer selection
- ✅ Wishlist management
- ✅ Affiliate integration
- ✅ Price tracking
- ✅ Availability alerts

---

## Stylist Marketplace

### Overview

Connect with fashion professionals for personalized styling services. Browse stylists, book consultations, and manage sessions with secure escrow payments.

### User Journey: Book Stylist

```
1. Navigate to Stylist page
   ↓
2. Browse featured stylists or search
   ↓
3. Apply filters:
   • Specialty (personal, editorial, celebrity)
   • Price range
   • Rating
   • Availability
   • Location (for in-person)
   ↓
4. View stylist profiles:
   • Portfolio of past work
   • Client testimonials
   • Pricing tiers
   • Availability calendar
   ↓
5. Select service package
   ↓
6. Choose date and time
   ↓
7. Review booking summary
   ↓
8. Pay via escrow smart contract
   ↓
9. Receive confirmation
   ↓
10. Prepare for session (upload photos, measurements)
    ↓
11. Complete session
    ↓
12. Leave review
```

### Stylist Features

**Stylist Directory**:
- Profile with portfolio
- Specialties and services
- Pricing tiers
- Availability calendar
- Client reviews and ratings
- Response time metrics

**Booking System**:
- Calendar interface
- Time slot selection
- Service package selection
- Milestone-based pricing
- Escrow payment

**Session Management**:
- Pre-session questionnaire
- Photo upload
- Measurement input
- Session notes
- Post-session deliverables

**Payment & Escrow**:
- Milestone-based releases
- Dispute resolution
- Refund mechanism
- Payment history

### Technical Implementation

**Escrow Smart Contract**:
- Milestone tracking
- Proportional payment release
- Dispute handling
- Refund mechanism
- Event logging

**Booking Management**:
- Calendar API integration
- Notification system
- Session tracking
- Review system

### Features

- ✅ Stylist directory
- ✅ Advanced filtering
- ✅ Portfolio viewing
- ✅ Calendar booking
- ✅ Service packages
- ✅ Escrow payments
- ✅ Milestone tracking
- ✅ Dispute resolution
- ✅ Review system
- ✅ Video consultations (future)

---

## Worldcoin Mini App Features

### Overview

Lightweight, focused application within Worldcoin ecosystem. Leverages World ID verification for streamlined onboarding and exclusive features.

### Feature 1: Quick Stylist Matching

**Purpose**: Instant stylist recommendations based on verified identity

**Flow**:
```
1. User opens mini app from Worldcoin wallet
   ↓
2. World ID automatically authenticated
   ↓
3. AI-powered stylist matching based on:
   • User's style preferences
   • Budget range
   • Availability
   • Geographic location
   ↓
4. Top 3 stylist recommendations displayed
   ↓
5. One-click booking with escrow payment
   ���
6. Session scheduled and confirmed
```

**Benefits**:
- No additional login required
- Verified identity ensures trust
- Quick matching algorithm
- Instant booking

### Feature 2: Style Challenges

**Purpose**: Community-driven fashion competitions with NFT rewards

**Flow**:
```
1. Browse weekly themed challenges
   • "Monochrome Monday"
   • "Vintage Vibes"
   • "Sustainable Style"
   ↓
2. Submit outfit photos or AI-generated collages
   ↓
3. Community voting (one vote per verified World ID)
   ↓
4. Top submissions win exclusive NFTs
   ↓
5. Leaderboard and reputation points
```

**Anti-Bot Protection**:
- World ID verification prevents multi-accounting
- One claim per unique human
- Time-limited minting windows
- Proof of humanity required

### Feature 3: Exclusive Drops

**Purpose**: Limited-edition fashion NFTs for verified Worldcoin users

**Flow**:
```
1. Browse upcoming designer collaborations
   ↓
2. Verified-user-only minting
   ↓
3. Whitelist guaranteed by World ID proof
   ↓
4. Instant verification at checkout
   ↓
5. Cross-platform NFT display
```

**Benefits**:
- Early access to designer drops
- Guaranteed whitelist spot
- Sybil-resistant minting
- Exclusive to verified humans

### Cross-Platform Integration

**Shared User Profile**:
- Single account across web, mobile, mini-app
- Worldcoin World ID as primary identifier
- ZetaChain wallet address linked to World ID
- Preferences and closet data synced via blockchain

**Cross-Platform Actions**:
- Book stylist in mini-app → confirmation on mobile/web
- Mint NFT on web → immediately visible in mini-app
- Complete challenge in mini-app → reflected in mobile profile
- Purchase in mini-app → added to web closet

**Data Synchronization**:
- Event-driven architecture
- Blockchain event listeners
- Real-time updates
- Conflict resolution (last-write-wins)

### Features

- ✅ Quick stylist matching
- ✅ Style challenges
- ✅ Exclusive drops
- ✅ World ID verification
- ✅ Cross-platform sync
- ✅ NFT rewards
- ✅ Leaderboard
- ✅ Community voting
- ✅ Sybil resistance

---

## User Onboarding

### Web App Onboarding

```
1. Landing Page
   • Feature highlights
   • Call-to-action: "Get Started"
   ↓
2. Connect Wallet
   • RainbowKit modal
   • Wallet selection
   • Network auto-switch to ZetaChain
   ↓
3. Profile Creation
   • Display name
   • Avatar upload
   • Style preferences
   ↓
4. Interactive Tutorial
   • Feature walkthrough
   • First action prompt
   ↓
5. First Action
   • Upload first item
   • Create collage
   • Get critique
```

### Mobile App Onboarding

```
1. Splash Screen
   • Brand animation (2s)
   ↓
2. Welcome Screen
   • Feature highlights carousel
   ↓
3. Identity Verification
   • "Verify with World ID" (primary CTA)
   ↓
4. Worldcoin Verification
   • QR code scan
   • Biometric verification
   ↓
5. Wallet Linking
   • Create or import ZetaChain wallet
   ↓
6. Permissions
   • Camera access
   • Notifications
   • Storage access
   ↓
7. Sync Prompt
   • Option to sync existing web closet
   ↓
8. Complete
   • Navigate to home screen
```

### Mini App Onboarding

```
1. World ID Auto-Auth
   • Automatic authentication
   ↓
2. Feature Introduction
   • Quick tour of capabilities
   ↓
3. First Action
   • Browse stylists
   • View challenges
   • Explore drops
```

---

## Accessibility & Internationalization

### Accessibility Features

- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ High contrast mode
- ✅ Text size adjustment
- ✅ Captions for videos

### Internationalization

- ✅ Multi-language support (10+ languages)
- ✅ RTL language support
- ✅ Currency localization
- ✅ Date/time formatting
- ✅ Regional content adaptation

---

## Future Features

- 🔮 Real-time collaboration on collages
- 🔮 Advanced AR with virtual fitting rooms
- 🔮 Social features (followers, likes, comments)
- 🔮 Influencer partnerships
- 🔮 Subscription tiers
- 🔮 Advanced analytics dashboard
- 🔮 AI-powered personal stylist (always-on)
- 🔮 Voice-based search and commands
- 🔮 Augmented reality showrooms
- 🔮 Blockchain-based loyalty program
