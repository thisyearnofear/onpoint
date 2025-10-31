# OnPoint Platform Documentation

**Version:** 1.0  
**Last Updated:** October 31, 2025  
**Status:** Active Development

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [AI Integration](#ai-integration)
4. [Platform Architecture](#platform-architecture)
5. [Development Roadmap](#development-roadmap)

---

## Project Overview

OnPoint is a revolutionary multiplatform ecosystem for personalized fashion discovery and digital ownership. The platform combines cutting-edge AI-powered design generation, AR virtual try-on experiences, and blockchain-based asset ownership to create a comprehensive fashion technology solution.

### Core Value Propositions

- **AI-Powered Fashion Discovery**: Multimodal AI generates personalized designs from images and text prompts
- **Virtual Try-On**: AR/XR technology enables realistic outfit visualization
- **Digital Ownership**: Blockchain-based NFT system for fashion items and designs
- **Stylist Ecosystem**: Connect users with fashion professionals through programmable payments
- **Cross-Platform Sync**: Seamless experience across web, mobile, and mini-app environments

---

## Core Features

### 1. AI Stylist with Personality-Based Critiques

Users can upload images of themselves in outfits or take photos with their device camera to receive critiques from AI personalities:

- **Anna Karenina** - Russian aristocratic fashion with refined 19th-century high society style
- **Artful Dodger** - Street-smart youth with gritty urban style and sneakerhead expertise
- **Mowgli** - Jungle survivor representing coexistence with animals and ecological balance
- **Edina Monsoon** - Absolutely Fabulous fashion victim with avant-garde style
- **Miranda Priestly** - Runway editor with impossibly high standards
- **John Shaft** - Cool 1970s sophistication with an edge

### 2. Virtual Try-On Experience

Advanced virtual try-on functionality using IDM-VTON model via Replicate API:

- Upload garment and human images
- AI-powered fitting and visualization
- Body-inclusive visualizations
- Performance optimizations with caching

### 3. Computer Vision & Fashion Analysis

Using GPT-4o-mini via Replicate API for detailed fashion image analysis:

- Outfit rating (1-10 scale)
- Strengths and improvement suggestions
- Style notes and recommendations
- Personalized styling advice

### 4. Design Studio

AI-powered design generation capabilities:

- Text-to-image generation
- Style variation creation
- Design refinement tools
- Export functionality

---

## AI Integration

### Provider Abstraction

OnPoint uses a hybrid approach with a shared AI client interface:

1. **Web Application**: Uses cloud AI APIs (Replicate, OpenAI)
2. **Shared Logic**: Common AI client interface for all platforms

### Key AI Models

- **IDM-VTON**: Virtual try-on model via Replicate
- **GPT-4o-mini**: Fashion image analysis and personality critiques
- **DALL-E/Stable Diffusion**: Design generation
- **CLIP**: Image tagging and classification

---

## Platform Architecture

### Multi-Platform Strategy

OnPoint launches three complementary platforms simultaneously:

1. **Web App (Next.js)** - Full-featured platform
2. **Chrome Extension (Gemini Nano)** - Google Chrome Challenge submission
3. **Worldcoin Mini App** - Worldcoin Dev Rewards submission

### Technical Stack

- **Frontend**: Next.js, React, TypeScript
- **AI Services**: Replicate API, OpenAI API
- **Blockchain**: ZetaChain, ERC-721A NFTs
- **Storage**: IPFS (Pinata), LocalStorage
- **Mobile**: React Native
- **AR**: Three.js, MediaPipe

---

## Development Roadmap

### Phase 1: MVP Foundation ✅ Complete

- Web app with Next.js setup
- AI fashion critique with personality-based responses
- Virtual try-on implementation
- Basic collage creator
- Wallet connection and NFT minting

### Phase 2: Mobile & Identity ✅ Complete

- React Native mobile app
- AR try-on implementation
- Cross-platform sync

### Phase 3: Mini App & Community ✅ Complete

- Worldcoin Mini App scaffold
- Quick stylist matching
- Style challenges with voting

### Phase 4: Marketplace & Scaling 📅 In Progress

- Stylist directory and profiles
- Booking system with calendar
- Product sourcing and retail API integration

### Hackathon Submissions

1. **Google Chrome Built-in AI Challenge** (Nov 1 Deadline)
   - Chrome Extension using Gemini Nano
   - Submission target: October 28

2. **Worldcoin Mini App Dev Rewards**
   - Quick Stylist Matching + Style Challenges
   - Weekly $100K prize opportunities