# CDN Assets

This folder contains large static assets that will be deployed to the CDN.

## How it works

1. **Add your assets here** (images, audio, videos, etc.)
2. **Deploy game using rundot cli** rundot deploy
3. **cdn-assets will be uploaded to the CDN** versioning is also handled for you

## Usage in Code

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

// Reference CDN assets using RundotGameAPI.cdn.fetchAssets():
const imageBlob = RundotGameAPI.cdn.fetchAssets('hero-image.png');

// Use in React:
<img src={imageBlob} alt="Hero" />
```

## Important Notes

- **DO** commit assets to this folder
- Use `public/` folder for small essential assets (<100KB)
- Use `public/cdn-assets` folder for large assets (>100KB)
