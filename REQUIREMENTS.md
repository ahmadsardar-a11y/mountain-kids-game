# Requirements — Mountain Kids Game v2 Enhancements

## Functional Requirements

### FR-1: Hazards System [MUST]
**Zombies:**
- 6 zombie meshes (simple humanoid: green box body + smaller box head)
- Walk randomly with bounce-off-boundaries logic
- On collision with player buggy: player enters "spin" state for 3 seconds (heading rapidly rotates, no control input processed)
- Zombie disappears after collision (remove from scene)
- AI buggy is ALSO affected by zombie collisions (same 3s spin)

**Bombs:**
- 8 red sphere bombs placed randomly on terrain
- On proximity (radius 2.5): trigger explosion effect (red flash), player spins for 3s
- Bomb disappears after explosion
- AI buggy is ALSO affected by bombs

**Lava Pools:**
- 5 flat circular red/orange planes on terrain
- Eruption cycle: calm (10-15s random) → warning glow intensifies (3s) → erupt (2s) → repeat
- During erupt phase: collision causes player/AI spin for 3s
- Visual hint: scale pulses and color shifts during warning phase

### FR-2: Random Gem Positions [MUST]
- Gem positions randomized on every game start
- Must still be reachable (not inside mountains, not on too-steep slopes)
- Minimum spacing between gems maintained

### FR-3: AI Competitor Car [MUST]
- Second buggy mesh (blue color instead of player red)
- Difficulty selector on start screen (Easy/Hard)
- **Easy mode:** Speed capped at 60% of player, 20% chance to idle each second, picks random gem target
- **Hard mode:** Speed capped at 85% of player, always pursues nearest uncollected gem using greedy pathfinding
- AI collects gems (removes them from world)
- AI is affected by all hazards (zombies, bombs, lava) — enters spin state for 3s

### FR-4: Competitive Scoring [MUST]
- HUD shows AI gem count alongside player gem count
- Game ends when timer expires (not when all gems collected)
- End message based on relative score:
  - Player > AI: "You Won! 🏆"
  - AI > Player: "You Lost — AI collected more gems!"
  - Tie: "It's a Tie!"

### FR-5: UI Updates [MUST]
- Add difficulty selector (Easy/Hard) before game starts
- Show AI score in HUD during gameplay
- Update win/lose screens for competitive results

## Non-Functional Requirements

- Maintain 60fps on Chrome with <50 draw calls
- Mobile touch controls continue to work
- Single HTML file architecture preserved (modular JS files)
- Kid-friendly visual style (no blood, no scary imagery)

## Open Questions / Kid-Friendly Decisions

- **Decision:** AI car also affected by hazards (per Ahmad's confirmation)
- **Decision:** Zombies are cartoon green blocks, not realistic — friendly obstacle look
- **Decision:** Lava pools have orange→red glow pulse as warning, not text
- **Decision:** Bomb explosion is a quick red flash + screen shake, not graphic
