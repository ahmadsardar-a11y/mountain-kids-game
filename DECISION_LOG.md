# Decision Log — Mountain Kids Game v2

| Decision | Context | Chosen Option | Rationale |
|----------|---------|---------------|-----------|
| AI car affected by hazards | Ahmad confirmed | Yes, same 3s spin | Makes game fair and more chaotic/fun |
| Zombie visual style | Kid-friendly requirement | Green box humanoid (not realistic) | Non-scary, keeps cartoon aesthetic |
| Lava warning style | Kid-friendly + visual clarity | Pulsing orange→red glow on pool | No text needed, intuitive |
| Bomb explosion style | Kid-friendly | Red screen flash + car spin | No fire/gore, just mechanical effect |
| Difficulty levels | Kids of different ages | Easy (60% speed, random) / Hard (85% speed, greedy) | Easy for younger kids, Hard for challenge |
| AI pathfinding algorithm | Hard mode needs to be beatable | Greedy nearest-gem, not perfect optimal | Keeps AI competitive but not unbeatable |
| Game end trigger | Competitive mode changes flow | Timer expiration (not all gems) | Prevents player from just waiting if behind |
| HUD AI score display | Competitive awareness | Show "AI: X" below player score | Kids can see who's winning in real-time |
| Hazard self-destruct | Prevent infinite loops | Zombies/bombs disappear after one trigger | Ensures game always progresses |
| Random gem placement | Fresh experience per game | Regenerate positions on every reset | Replayability for kids |
