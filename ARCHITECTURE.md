# Architecture — Mountain Kids Game v2

## Component Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   index.html │────→│   engine.js │←────│   ui.js     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
  ┌────────────┐    ┌────────────┐    ┌──────────────┐
  │  buggy.js  │    │  world.js  │    │  ai-buggy.js │
  │ (player)   │    │(terrain +  │    │  (AI car)    │
  └────────────┘    │ hazards +  │    └──────────────┘
                    │  gems)     │
                    └────────────┘
        ↑                  ↑
  ┌────────────┐    ┌────────────┐
  │  input.js  │    │  audio.js  │
  └────────────┘    └────────────┘
```

## Data Flow

1. **engine.js** — Game loop, state machine (MENU → PLAYING → GAME_OVER)
2. **world.js** — Procedural terrain, instanced meshes for gems/props, hazard zones
3. **buggy.js** — Player vehicle physics, camera follow, collision response
4. **ai-buggy.js** — AI vehicle with difficulty-based pathfinding and gem collection
5. **ui.js** — Overlay screens, HUD, difficulty selector
6. **input.js** — Keyboard + touch joystick
7. **audio.js** — Engine pitch + collect sounds

## Hazard Integration

- `world.js` owns zombie meshes, bomb meshes, lava pool meshes
- Each has its own update(dt) method called from engine.js loop
- Collision detection: world.js exposes `checkHazardCollisions(position)` → returns {type, spinDuration}
- Both player and AI call this during their update
- Spin state managed in respective buggy modules (freeze input/AI logic, rotate heading)

## AI Pathfinding

- Easy: random target selection, frequent idle pauses
- Hard: greedy nearest-gem using distance heuristic
- Both use same physics constraints as player (terrain following, map boundaries)
- AI hazard collision triggers spin → temporarily overrides pathfinding

## State Machine Additions

```
MENU → [select difficulty] → PLAYING → [time=0] → GAME_OVER
  ↑                              │
  └──── [Play Again] ←───────────┘
```

New states within PLAYING:
- `playerSpinTimer`: >0 → ignore input, spin heading
- `aiSpinTimer`: >0 → AI idle, spin heading
- `lavaEruptionTimers`: per-pool cycle tracking
