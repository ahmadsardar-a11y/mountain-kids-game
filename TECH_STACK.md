# Mountain Kids Game — Tech Stack Recommendation

## Constraints
- Free tier hosting (Render)
- No persistence → no database needed
- Single player → no multiplayer server needed
- Low poly 3D → lightweight WebGL renderer
- Low processing power target → minimal JS, no heavy frameworks

## Decision

| Layer | Choice | Justification |
|-------|--------|---------------|
| **Renderer** | Three.js (r128+ via CDN) | Industry standard, lightweight, no build step needed, excellent low-poly support |
| **Physics** | None (simplified custom) | Arcade-style movement doesn't need Cannon.js/Ammo.js overhead. Keeps bundle tiny. |
| **Build Tool** | None — vanilla JS | Static files only. No bundler = faster loads, simpler deploy. |
| **Hosting** | Render Static Site (free) OR GitHub Pages | Zero backend. Static HTML/CSS/JS. Render free tier: 100GB bandwidth/mo, auto-deploy from GitHub. |
| **Input** | Keyboard (WASD/Arrows) + Touch (mobile) | Standard browser APIs |
| **Audio** | Web Audio API (simple SFX) | No libraries needed for engine sounds / collect sounds |

## Architecture
```
┌─────────────────────────────────────────┐
│  Browser (Any device)                   │
│  ├── index.html (single screen)         │
│  ├── style.css                          │
│  ├── app.js (game loop + logic)         │
│  ├── three.min.js (CDN or local)        │
│  └── assets/ (low-poly models, tex)     │
└─────────────────────────────────────────┘
                   │
            Render Static (Free)
```

## Why Not ___
- **PlayCanvas/Babylon**: Heavier, build step, overkill for simple low-poly
- **Unity WebGL**: Export is bloated (10MB+), slow load on low-end devices
- **Godot Web**: Better than Unity but still heavier than Three.js for this scope
- **Backend (Node/Express)**: Not needed — no auth, no persistence, no multiplayer
- **Database**: Not needed — no saved data per requirements

## Free Tier Check — Render Static Sites
- ✅ 100GB bandwidth/month
- ✅ Unlimited sites
- ✅ Auto-deploy from GitHub
- ✅ Custom domain support
- ✅ No idle timeout (static)
- ⚠️ Build minutes: 500/mo (more than enough for static)

## Asset Strategy
- Procedural terrain: Three.js `PlaneGeometry` + vertex displacement
- Low-poly vehicle: Simple `BoxGeometry` / `ConeGeometry` composite
- Sky: Gradient shader or simple color
- Collectibles: Spinning `OctahedronGeometry` (gems/coins)

## Performance Budget
- Target: 60fps on Intel HD Graphics / old mobile
- Draw calls: < 50
- Tris: < 10,000
- Texture size: 512x512 max
- No shadow maps (bake ambient occlusion into vertex colors)
