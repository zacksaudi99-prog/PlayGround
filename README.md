# Hearthvale — The Old Key

A small 2D medieval adventure made for phones and tablets. Gather old coins from glowing trees, welcome homeless travelers at your campfire, give them a calling, then enter a one-room ruin to claim the old key and face the Ruin Warden.

Built with plain HTML, CSS, and Canvas — no framework, no build step.

## Play

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The game is portrait-first. Very short landscape screens show a short “Turn it upright” screen; larger tablets and desktop browsers work in either orientation.

## How to play

1. **Gather coins** — tap the four glowing trees in the village. Each tree holds three old coins and regrows after a short rest.
2. **Find travelers** — tap the campfire. A homeless traveler joins Hearthvale each time you visit (three in total). Your first arrival opens the guild panel.
3. **Assign jobs** — tap **JOBS** in the top bar or the campfire once your guild is formed.
   - **Archer** — fires an arrow at the nearest enemy every few seconds.
   - **Swordsman** — adds damage to every sword strike.
   - **Builder** — raises your maximum hearts and mends one.
4. **Enter the ruin** — once you have 6 old coins, tap the gate.
5. **Take the key** — walk to the pedestal or tap it. The key wakes the Ruin Warden.
6. **Win** — defeat the warden with your sword and your companions’ help.

Slimes roam the ruin and the warden throws fireballs. If you fall, your companions carry you home and the ruin resets, but your coins, travelers, and job choices stay.

## Controls

- **Touch** — D-pad to move, **⚔** to strike, **✦** to talk / enter / interact. You can also tap a tree, the campfire, the gate, the key pedestal, or the ground to move toward it.
- **Keyboard** — arrow keys or `WASD` to move, `Space` or `J` to attack, `E` or `Enter` to interact, `Esc` to close the jobs panel.

## Files

- `index.html` — game shell, start screen, win screen, jobs panel, rotate overlay.
- `style.css` — layout, safe-area handling, overlays, and responsive rules.
- `game.js` — village and dungeon scenes, rendering, input, and game logic.

## Notes

- Screenshots and local verification scripts are development aids and are not required to play.
- Safe-area insets are respected on notched phones, and the game shell is capped at 1000px wide on desktop for comfortable letterboxing.

---

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/zacksaudi99-prog/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/zacksaudi99-prog/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/zacksaudi99-prog/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/zacksaudi99-prog/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/zacksaudi99-prog/PlayGround).
- 🛠️ [Check build runs](https://github.com/zacksaudi99-prog/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/zacksaudi99-prog/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/zacksaudi99-prog).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
