# Vision-Powered Virtual Try-On - Quick Start

## What's New

Your virtual try-on now uses **Venice AI's computer vision** (`qwen3-vl-235b-a22b`) to actually analyze uploaded photos instead of just text descriptions.

## Key Improvements

✅ **Real photo analysis** - Analyzes actual body measurements from photos  
✅ **Accurate fit recommendations** - Based on visual body proportions  
✅ **Color compatibility** - Analyzes skin tone and coloring from photos  
✅ **Style detection** - Understands current outfit and style preferences  
✅ **Backward compatible** - Text-only analysis still works  

## How It Works

### Before (Text-Only)
```
User uploads photo → Backend ignores photo → AI guesses based on text description
```

### After (Vision-Powered)
```
User uploads photo → Photo sent to Venice Vision API → AI analyzes actual image → Detailed recommendations
```

## Testing

### 1. Test Vision API Locally
```bash
node apps/web/scripts/test-vision.mjs
```

### 2. Deploy to Hetzner
```bash
cd apps/api
./deploy.sh
```

### 3. Test Production
```bash
# Test body analysis
curl -X POST https://api.onpoint.famile.xyz/api/ai/virtual-tryon \
  -H "Content-Type: application/json" \
  -d '{
    "type": "body-analysis",
    "data": {
      "description": "Athletic build",
      "photoData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
  }'

# Test person analysis
curl -X POST https://api.onpoint.famile.xyz/api/ai/analyze-person \
  -H "Content-Type: application/json" \
  -d '{
    "photoData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }'
```

## Frontend Usage

The frontend automatically uses vision analysis when photos are uploaded:

```typescript
// In VirtualTryOn.tsx
const handlePhotoSelect = async (file: File) => {
  setSelectedPhoto(file);
  // Photo is automatically converted to base64 and sent to vision API
  await analyzePhoto(file);
};
```

## API Endpoints

### Body Analysis with Vision
**POST** `/api/ai/virtual-tryon`
```json
{
  "type": "body-analysis",
  "data": {
    "photoData": "data:image/jpeg;base64,..."
  }
}
```

### Person Analysis
**POST** `/api/ai/analyze-person`
```json
{
  "photoData": "data:image/jpeg;base64,..."
}
```

### Outfit Fit with Vision
**POST** `/api/ai/virtual-tryon`
```json
{
  "type": "outfit-fit",
  "data": {
    "photoData": "data:image/jpeg;base64,...",
    "items": [...]
  }
}
```

## Files Changed

### Backend
- ✅ `apps/api/routes/ai-virtual-tryon.js` - Added vision analysis
- ✅ `apps/api/routes/ai-analyze-person.js` - New person analysis route
- ✅ `apps/api/server.js` - Already configured for new route

### Frontend
- ✅ `packages/ai-client/src/hooks.ts` - Updated to send photo data
- ✅ `apps/web/components/VirtualTryOn.tsx` - Already handles photos

### Documentation
- ✅ `HETZNER_CONFIG.md` - Updated with vision capabilities
- ✅ `apps/web/scripts/test-vision.mjs` - Vision testing script
- ✅ `apps/web/scripts/VISION_UPGRADE.md` - Detailed upgrade docs
- ✅ `apps/api/deploy.sh` - Deployment script

## Next Steps

1. **Deploy to Hetzner**
   ```bash
   cd apps/api && ./deploy.sh
   ```

2. **Test with real photos** - Upload actual fashion photos to see detailed analysis

3. **Monitor performance** - Check Venice API usage and response times

4. **Optimize if needed** - Add image compression, caching, etc.

## Troubleshooting

### "Venice API key not configured"
- Check `VENICE_API_KEY` in backend `.env`
- Restart PM2: `pm2 restart onpoint-api`

### "Vision analysis failed"
- Check Venice API status: https://veniceai-status.com
- Verify image format (JPEG, PNG, WebP supported)
- Check image size (max ~10MB recommended)

### Slow response times
- Large images take longer to analyze
- Consider image compression before upload
- Check Venice API rate limits

## Resources

- [Venice AI Docs](https://docs.venice.ai)
- [Vision API Reference](https://docs.venice.ai/api-reference)
- [Qwen3-VL Model Info](https://docs.venice.ai/overview/about-venice)
