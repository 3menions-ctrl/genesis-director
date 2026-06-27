# Genesis Director — Design Audit

_Generated against http://localhost:7777 · 52 pages analysed (desktop pass) · 104 total captures (desktop + mobile)._

## Summary

- **Routes discovered:** 52 (from `src/App.tsx` React Router config + `businessNav.ts`)
- **Rendered unique content:** 50 routes
- **Redirected (auth/gate):** 2 routes → captured at their redirect target
- **Capture errors:** 0
- **Distinct opaque colors:** 98
- **Near-duplicate color pairs (RGB dist < 12):** 194
- **Distinct font families:** 4
- **Distinct font sizes:** 71
- **Distinct button radii:** 8
- **Distinct spacing values:** 101

> ✅ This pass ran **authenticated** (session: `./auth-personal.json`). Protected
> consumer routes render their real surfaces. Any routes still listed under
> "Redirected" are gated to a different account type (e.g. business/admin).
> Token stats below are from the 50 routes that rendered real content.

## 🚩 Flagged inconsistencies

### Near-duplicate colors (194)
Colors close enough that they're probably meant to be the same token but drifted:

| Color A | uses | Color B | uses | RGB dist |
| `#07090d` | 11 | `#08090d` | 7 | 1 |
| `#08090d` | 7 | `#08090c` | 2 | 1 |
| `#04050a` | 1 | `#04050b` | 1 | 1 |
| `#050507` | 1 | `#050607` | 1 | 1 |
| `#050607` | 1 | `#050608` | 1 | 1 |
| `#040506` | 99 | `#050507` | 1 | 1.4 |
| `#090a0c` | 76 | `#08090c` | 2 | 1.4 |
| `#090a0c` | 76 | `#09090b` | 2 | 1.4 |
| `#0a0b10` | 36 | `#090b11` | 2 | 1.4 |
| `#07090d` | 11 | `#08090c` | 2 | 1.4 |
| `#08090c` | 2 | `#09090b` | 2 | 1.4 |
| `#04050a` | 1 | `#05060a` | 1 | 1.4 |
| `#070809` | 1 | `#060709` | 1 | 1.4 |
| `#050507` | 1 | `#050608` | 1 | 1.4 |
| `#040506` | 99 | `#050607` | 1 | 1.7 |
| `#090a0c` | 76 | `#08090d` | 7 | 1.7 |
| `#05060a` | 1 | `#04050b` | 1 | 1.7 |
| `#05060a` | 1 | `#060709` | 1 | 1.7 |
| `#060709` | 1 | `#050608` | 1 | 1.7 |
| `#0a0b0e` | 100 | `#0a0b10` | 36 | 2 |
| `#05060a` | 1 | `#050608` | 1 | 2 |
| `#08090d` | 7 | `#09090b` | 2 | 2.2 |
| `#0b0e14` | 3 | `#0c0e12` | 1 | 2.2 |
| `#0a0b0e` | 100 | `#090a0c` | 76 | 2.4 |
| `#040506` | 99 | `#050608` | 1 | 2.4 |
| `#090a0c` | 76 | `#07090d` | 11 | 2.4 |
| `#04050a` | 1 | `#050608` | 1 | 2.4 |
| `#050607` | 1 | `#060709` | 1 | 2.4 |
| `#07090d` | 11 | `#09090b` | 2 | 2.8 |
| `#0a0b0e` | 100 | `#08090d` | 7 | 3 |
| `#f56b3d` | 10 | `#f5683d` | 1 | 3 |
| `#0a0c16` | 7 | `#0b0e14` | 3 | 3 |
| `#09090b` | 2 | `#070809` | 1 | 3 |
| `#8d95a5` | 1 | `#8f96a3` | 1 | 3 |
| `#04050a` | 1 | `#060709` | 1 | 3 |
| `#05060a` | 1 | `#070809` | 1 | 3 |
| `#05060a` | 1 | `#050607` | 1 | 3 |
| `#070809` | 1 | `#050608` | 1 | 3 |
| `#050507` | 1 | `#060709` | 1 | 3 |
| `#0a0b0e` | 100 | `#090b11` | 2 | 3.2 |

### Button radius inconsistency (8 distinct)
A consistent system usually has 2–4 radius tokens. Distinct values in use:

| border-radius | occurrences |
| `9999px` | 536 |
| `0px` | 498 |
| `16px` | 137 |
| `10px` | 84 |
| `20px` | 83 |
| `4px` | 16 |
| `12px` | 9 |
| `8px` | 9 |

### Font sizes off a clean scale (32 fractional)
Fractional / odd sizes that don't sit on an integer-px scale: `8.5px`, `9.5px`, `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`, `15.5px`, `22.4px`, `27.2px`, `30.4px`, `30.72px`, `31.2px`, `35.2px`, `36.8px`, `37.44px`, `38.4px`, `41.6px`, `44.8px`, `51.2px`, `54.4px`, `57.6px`, `59.2px`, `60.8px`, `62.4px`, `67.2px`, `70.4px`, `76.8px`, `83.2px`, `92.8px`, `102.4px`, `266.4px`

All distinct font sizes (px): `8` `8.5` `9` `9.5` `10` `10.5` `11` `11.5` `12` `12.5` `13` `13.5` `14` `14.5` `15` `15.5` `16` `17` `18` `19` `20` `22` `22.4` `24` `25` `26` `27.2` `28` `30` `30.4` `30.72` `31.2` `32` `34` `35.2` `36` `36.8` `37.44` `38.4` `40` `41.6` `44` `44.8` `48` `51.2` `52` `54.4` `56` `57.6` `59.2` `60` `60.8` `62` `62.4` `64` `67.2` `70.4` `72` `76` `76.8` `80` `83.2` `84` `88` `92.8` `96` `102.4` `112` `128` `160` `266.4`

### Spacing off the 4px grid (41 values)
| spacing | occurrences |
| `10px` | 2043 |
| `2px` | 1892 |
| `6px` | 1444 |
| `14px` | 450 |
| `-1px` | 224 |
| `1px` | 123 |
| `178.953px` | 68 |
| `3px` | 16 |
| `-2.24px` | 9 |
| `5px` | 7 |
| `61.4062px` | 6 |
| `57.3594px` | 6 |
| `82px` | 6 |
| `362px` | 6 |
| `61.3906px` | 4 |
| `18px` | 4 |
| `15px` | 4 |
| `214px` | 4 |
| `312.875px` | 2 |
| `130px` | 2 |
| `207px` | 2 |
| `242px` | 2 |
| `395px` | 2 |
| `268.891px` | 2 |
| `250.859px` | 2 |
| `169.672px` | 2 |
| `262px` | 2 |
| `310px` | 2 |
| `210px` | 2 |
| `158.016px` | 1 |

### Multiple font families (4)
| font-family (primary) | occurrences |
| Fraunces | 29961 |
| JetBrains Mono | 5889 |
| Sora | 18 |
| monospace | 1 |

## Heading scale (h1–h6)
Each tag should ideally map to one size. Multiple sizes per tag = drift.

| tag | distinct sizes (count) | verdict |
| h1 | 64px×5, 48px×5, 96px×4, 24px×4, 76px×4, 88px×3, 52px×2, 36px×2, 30.4px×2, 92.8px×1, 102.4px×1, 76.8px×1, 70.4px×1, 28px×1, 60px×1, 84px×1, 56px×1, 44px×1, 160px×1 | ⚠️ 19 sizes |
| h2 | 24px×36, 48px×12, 51.2px×9, 59.2px×8, 18px×7, 62.4px×4, 36px×4, 20px×4, 34px×4, 44.8px×3, 16px×2, 56px×2, 26px×2, 15.5px×2, 54.4px×1, 67.2px×1, 60px×1, 44px×1, 80px×1, 32px×1, 38.4px×1, 30px×1 | ⚠️ 22 sizes |
| h3 | 15px×232, 16px×28, 27.2px×25, 32px×21, 24px×12, 20px×9, 22.4px×7, 18px×6, 35.2px×5, 41.6px×1, 48px×1, 60.8px×1, 14px×1, 51.2px×1, 30.4px×1, 10px×1 | ⚠️ 16 sizes |
| h4 | 19px×1 | ✓ consistent |
| h5 | — | — |
| h6 | — | — |

## Top colors (opaque, by frequency)
| color | uses |
| `#e4e4e7` | 11350 |
| `#ffffff` | 10097 |
| `#6ed5f7` | 852 |
| `#4792f5` | 542 |
| `#878792` | 465 |
| `#c4b5fd` | 234 |
| `#d1fae5` | 220 |
| `#f877b8` | 204 |
| `#000000` | 162 |
| `#0a0b0e` | 100 |
| `#040506` | 99 |
| `#f7dc6e` | 96 |
| `#090a0c` | 76 |
| `#e0c4ee` | 68 |
| `#f6a055` | 54 |
| `#75c7f0` | 39 |
| `#0a0b10` | 36 |
| `#70acff` | 28 |
| `#70b3ff` | 19 |
| `#eb4747` | 16 |
| `#202327` | 13 |
| `#f43f5e` | 12 |
| `#fef3c7` | 12 |
| `#3b3b3b` | 11 |
| `#07090d` | 11 |

## Button styles sampled (1372)
| radius | padding (T R B L) | bg | color | font | route |
| `0px` | `8px 14px 8px 14px` | `rgba(0,0,0,0)` | `rgba(255,255,255,0.7)` | 13px/300 | / |
| `9999px` | `0px 0px 0px 0px` | `rgba(0,0,0,0)` | `rgb(255,255,255)` | 16px/400 | / |
| `9999px` | `14px 28px 14px 28px` | `rgb(255,255,255)` | `rgb(10,11,14)` | 15px/500 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(75,149,246,0.17)` | `rgba(255,255,255,0.957)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(200,223,252,0.05)` | `rgba(255,255,255,0.545)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `9999px` | `14px 24px 14px 24px` | `rgb(255,255,255)` | `rgb(10,11,14)` | 15px/500 | / |
| `9999px` | `0px 0px 0px 0px` | `rgba(0,0,0,0)` | `rgb(255,255,255)` | 16px/400 | / |
| `9999px` | `14px 28px 14px 28px` | `rgb(255,255,255)` | `rgb(10,11,14)` | 15px/500 | / |
| `9999px` | `0px 16px 0px 16px` | `rgb(255,255,255)` | `rgb(10,11,14)` | 13px/500 | / |
| `0px` | `8px 14px 8px 14px` | `rgba(0,0,0,0)` | `rgba(255,255,255,0.7)` | 13px/300 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.063)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.027)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |

## Per-page profile
| route | label | elements | fonts | sizes | colors | primary font | deviates? |
| / | Home (Cinema) | 2076 | 2 | 35 | 64 | Fraunces | no |
| /studio-showcase | Studio Showcase | 838 | 2 | 25 | 46 | Fraunces | no |
| /films | Films Gallery | 685 | 2 | 6 | 11 | Fraunces | no |
| /pricing | Pricing | 472 | 2 | 16 | 32 | Fraunces | no |
| /how-it-works | How It Works | 1017 | 2 | 18 | 41 | Fraunces | no |
| /pipeline-preview | Pipeline Preview | 275 | 2 | 13 | 29 | Fraunces | no |
| /enterprise/coming-soon | Enterprise (Coming Soon) | 173 | 2 | 9 | 20 | Fraunces | no |
| /press | Press | 445 | 2 | 19 | 37 | Fraunces | no |
| /blog | Blog | 451 | 2 | 15 | 29 | Fraunces | no |
| /blog/sample-post | Blog Post | 75 | 1 | 3 | 8 | Fraunces | no |
| /contact | Contact | 358 | 2 | 15 | 27 | Fraunces | no |
| /terms | Terms | 462 | 2 | 15 | 26 | Fraunces | no |
| /privacy | Privacy | 443 | 2 | 15 | 26 | Fraunces | no |
| /unsubscribe | Unsubscribe | 84 | 1 | 5 | 10 | Fraunces | no |
| /auth | Sign In / Up | 341 | 2 | 11 | 30 | Fraunces | no |
| /forgot-password | Forgot Password | 116 | 1 | 4 | 12 | Fraunces | no |
| /reset-password | Reset Password | 127 | 1 | 4 | 12 | Fraunces | no |
| /business/start | Business Onboarding | 229 | 1 | 9 | 26 | Fraunces | no |
| /help | Help | 628 | 2 | 15 | 42 | Fraunces | no |
| /help/editor-manual | Help Doc | 319 | 2 | 11 | 27 | Fraunces | no |
| /help-center | Help Center (legacy) | 732 | 2 | 12 | 36 | Fraunces | no |
| /search | Search Hub | 489 | 2 | 10 | 31 | Fraunces | no |
| /lobby | Lobby | 578 | 2 | 16 | 33 | Fraunces | no |
| /music | Music Hub | 495 | 2 | 14 | 32 | Fraunces | no |
| /crossover | Crossover (VFX) | 3238 | 2 | 16 | 63 | Fraunces | no |
| /loft | Hidden Room (Loft) | 80 | 1 | 4 | 8 | Fraunces | no |
| /r/demo | Reel | 279 | 2 | 8 | 20 | Fraunces | no |
| /world/demo | World Detail | 281 | 2 | 9 | 19 | Fraunces | no |
| /c/demo | Channel/Profile (public) | 429 | 2 | 15 | 33 | Fraunces | no |
| /c/demo/patron | Patron Hub | 284 | 2 | 8 | 19 | Fraunces | no |
| /p/demo | Public Share | 76 | 2 | 5 | 7 | Fraunces | no |
| /w/demo | Widget Landing | 75 | 1 | 3 | 7 | Fraunces | no |
| /embed/demo | Embed Player | 78 | 2 | 3 | 8 | Fraunces | no |
| /widget/demo | Widget Embed | 72 | 1 | 2 | 5 | Fraunces | no |
| /studio | Studio | 417 | 2 | 13 | 29 | Fraunces | no |
| /onboarding | Onboarding | 417 | 2 | 13 | 29 | Fraunces | no |
| /welcome/checkout | Welcome Checkout | 93 | 2 | 8 | 11 | Fraunces | no |
| /library | Library | 327 | 2 | 10 | 28 | Fraunces | no |
| /account | Account | 508 | 2 | 18 | 42 | Fraunces | no |
| /account/notifications | Notification Settings | 459 | 2 | 12 | 33 | Fraunces | no |
| /profile | Profile Dashboard | 507 | 2 | 18 | 42 | Fraunces | no |
| /inbox | Inbox | 452 | 2 | 15 | 30 | Fraunces | no |
| /me/year | Director Cards (Year) | 304 | 2 | 7 | 23 | Fraunces | no |
| /avatars | Avatars Studio | 10635 | 2 | 11 | 32 | Fraunces | no |
| /templates | Templates | 2675 | 2 | 11 | 39 | JetBrains Mono | ⚠️ yes |
| /environments | Environments | 3224 | 2 | 11 | 47 | Fraunces | no |
| /training-video | Training Video | 425 | 2 | 12 | 39 | Fraunces | no |
| /production | Production | 367 | 4 | 13 | 34 | Fraunces | no |
| /production/demo | Production (project) | 342 | 3 | 10 | 25 | Fraunces | no |
| /editor | Video Editor | 568 | 2 | 12 | 41 | Fraunces | no |
| /editor/demo | Video Editor (project) | 1861 | 2 | 11 | 55 | Fraunces | no |
| /__audit_not_found__ | 404 / Not Found | 123 | 1 | 5 | 12 | Fraunces | no |

## Routes & capture status
**Stubbed params used:**
- `/blog/sample-post` — :slug = 'sample-post'
- `/help/editor-manual` — :slug = 'editor-manual'
- `/r/demo` — :id = 'demo'
- `/world/demo` — :slug = 'demo'
- `/c/demo` — :id = 'demo'
- `/c/demo/patron` — :id = 'demo'
- `/p/demo` — :slug = 'demo'
- `/w/demo` — :slug = 'demo'
- `/embed/demo` — :slug = 'demo'
- `/widget/demo` — :publicKey = 'demo'
- `/production/demo` — :projectId = 'demo'
- `/editor/demo` — :id = 'demo'
- `/__audit_not_found__` — unknown path → NotFound

**Redirected (gated, unauthenticated):**
`/auth`, `/onboarding`



---
_See `contact-sheet.html` / `contact-sheet.png` for the visual grid, and `shots/` for full-page + above-the-fold PNGs per route._
