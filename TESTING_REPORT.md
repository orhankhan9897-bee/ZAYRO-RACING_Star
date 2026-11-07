# ZAYRO RACING v6.0 — Testing report (honest)

Environment: headless Chromium via Playwright 1.63 with SOFTWARE WebGL (~5 fps), Node 22, local loopback network. No real GPU, no real phone, no internet deployment.

## Actually run and passing (re-run on the final files)
| Area | How | Result |
|---|---|---|
| JS syntax | `node --check` on all 24 JS files | pass |
| HTML / CSS | duplicate ids, tag balance, asset references, CSS brace balance | pass |
| Base files untouched | `cmp` vs original backup | game.js, style.css, finish/mobile/apex/cockpit/graphics/photo/realism/cars identical |
| Server | `npm test`: 23 two-player + 5 four-player tests (rooms, codes, ready, countdown, clamping, finish order, signatures, reconnect, rematch, DNF, malformed input) | 28/28 pass |
| Origin security | upgrade requests with allowed / evil / missing Origin | 101 / 403 / 403 |
| Two real browser sessions | A creates room, B joins by code, ready, start, both race (800 m sprint) | pass; positions streamed ±2 m; live ranking HUD; server-decided 1st/2nd |
| Reconnect | B's socket dropped mid-race, auto-resumed with token | pass (position continues) |
| DNF | crashed/eliminated online player | no certificate, no rewards |
| Certificates | 1st, 2nd, 3rd, 4th, 11th, 22nd generated + text extracted; 3rd rendered and viewed | correct "1ST…22ND PLACE", medal tiers |
| Single-player | full simulated race (1137 steps) → position vs 3 rivals → certificate "3RD PLACE · OF 4" → rewards | pass; also sprint + time-trial |
| Rewards | coin ordering 1st>2nd>3rd>4th for stages 1/3/5, duplicate claim blocked, pending/DNF rejected, car unlock appears in garage, reload persistence, export/import validity | pass |
| Mobile | touch-mode phone viewport drives (GO), seen by desktop opponent | pass |

## NOT tested / limitations
- Real GPU frame rate, real phones (touch steering wheel feel, vibration), real devices on a LAN.
- Deployment on a real host with TLS (`wss://`) and GitHub Pages → server over the internet. The wss path is code-reviewed, not exercised.
- 3–4 player races in browsers (server verified with 4 simulated clients; client UI supports 4 slots but only 2 real browsers were run).
- Socket.IO is NOT used (own WebSocket server instead).
- No car-to-car collision between online players. A determined cheater can still lie about their own car state; the server clamps impossible jumps/speeds and decides the order, but it is not a full physics-authoritative simulation.
- A visual screenshot test (`t_vis`) timed out under software rendering; screenshots from other tests were reviewed manually instead.

## Note on this session
Earlier-session edits to index.html, certificate, extra, legend and plus were overwritten by a file re-copy and were rebuilt from the earlier snapshot, then all tests above were re-run on the rebuilt files.
