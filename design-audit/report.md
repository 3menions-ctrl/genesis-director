# Genesis Director — Design Audit

_Generated against http://localhost:7777 · 74 pages analysed (desktop pass) · 148 total captures (desktop + mobile)._

## Summary

- **Routes discovered:** 74 (from `src/App.tsx` React Router config + `businessNav.ts`)
- **Rendered unique content:** 36 routes
- **Redirected (auth/gate):** 38 routes → captured at their redirect target
- **Capture errors:** 0
- **Distinct opaque colors:** 80
- **Near-duplicate color pairs (RGB dist < 12):** 167
- **Distinct font families:** 2
- **Distinct font sizes:** 70
- **Distinct button radii:** 6
- **Distinct spacing values:** 86

> ⚠️ This pass ran **unauthenticated**. All protected, business, and admin routes
> redirect to `/auth`, so their screenshots show the sign-in page, not the real
> surface. To audit those, generate a logged-in session and re-run with
> `AUDIT_STORAGE_STATE` (see README). Token stats below are from the
> 36 routes that render real content.

## 🚩 Flagged inconsistencies

### Near-duplicate colors (167)
Colors close enough that they're probably meant to be the same token but drifted:

| Color A | uses | Color B | uses | RGB dist |
| `#0a0b0f` | 117 | `#0a0b0e` | 100 | 1 |
| `#0a0b0f` | 117 | `#0a0b10` | 36 | 1 |
| `#08090d` | 7 | `#08090c` | 2 | 1 |
| `#04050a` | 1 | `#04050b` | 1 | 1 |
| `#050507` | 1 | `#050607` | 1 | 1 |
| `#040506` | 330 | `#050507` | 1 | 1.4 |
| `#090a0c` | 73 | `#08090c` | 2 | 1.4 |
| `#090a0c` | 73 | `#09090b` | 2 | 1.4 |
| `#0a0b10` | 36 | `#090b11` | 1 | 1.4 |
| `#08090c` | 2 | `#09090b` | 2 | 1.4 |
| `#04050a` | 1 | `#05060a` | 1 | 1.4 |
| `#070809` | 1 | `#060709` | 1 | 1.4 |
| `#040506` | 330 | `#050607` | 1 | 1.7 |
| `#090a0c` | 73 | `#08090d` | 7 | 1.7 |
| `#05060a` | 1 | `#04050b` | 1 | 1.7 |
| `#05060a` | 1 | `#060709` | 1 | 1.7 |
| `#0a0b0e` | 100 | `#0a0b10` | 36 | 2 |
| `#0a0b0f` | 117 | `#090b11` | 1 | 2.2 |
| `#08090d` | 7 | `#09090b` | 2 | 2.2 |
| `#0c0e12` | 1 | `#0b0e14` | 1 | 2.2 |
| `#0a0b0e` | 100 | `#090a0c` | 73 | 2.4 |
| `#050607` | 1 | `#060709` | 1 | 2.4 |
| `#0a0b0e` | 100 | `#08090d` | 7 | 3 |
| `#0a0c16` | 7 | `#0b0e14` | 1 | 3 |
| `#09090b` | 2 | `#070809` | 1 | 3 |
| `#04050a` | 1 | `#060709` | 1 | 3 |
| `#05060a` | 1 | `#070809` | 1 | 3 |
| `#05060a` | 1 | `#050607` | 1 | 3 |
| `#050507` | 1 | `#060709` | 1 | 3 |
| `#0a0b0e` | 100 | `#090b11` | 1 | 3.2 |
| `#04050a` | 1 | `#050507` | 1 | 3.2 |
| `#05060a` | 1 | `#050507` | 1 | 3.2 |
| `#0a0b0f` | 117 | `#090a0c` | 73 | 3.3 |
| `#08090c` | 2 | `#070809` | 1 | 3.3 |
| `#04050a` | 1 | `#050607` | 1 | 3.3 |
| `#0a0b0f` | 117 | `#08090d` | 7 | 3.5 |
| `#0a0b0e` | 100 | `#08090c` | 2 | 3.5 |
| `#070809` | 1 | `#050607` | 1 | 3.5 |
| `#04050b` | 1 | `#060709` | 1 | 3.5 |
| `#0a0b0e` | 100 | `#09090b` | 2 | 3.7 |

### Button radius inconsistency (6 distinct)
A consistent system usually has 2–4 radius tokens. Distinct values in use:

| border-radius | occurrences |
| `0px` | 264 |
| `9999px` | 149 |
| `16px` | 119 |
| `20px` | 39 |
| `12px` | 24 |
| `10px` | 16 |

### Font sizes off a clean scale (31 fractional)
Fractional / odd sizes that don't sit on an integer-px scale: `8.5px`, `9.5px`, `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`, `15.5px`, `22.4px`, `27.2px`, `30.4px`, `31.2px`, `35.2px`, `36.8px`, `38.4px`, `41.6px`, `44.8px`, `51.2px`, `54.4px`, `57.6px`, `59.2px`, `60.8px`, `62.4px`, `67.2px`, `70.4px`, `76.8px`, `80.64px`, `83.2px`, `92.8px`, `102.4px`, `266.4px`

All distinct font sizes (px): `8` `8.5` `9` `9.5` `10` `10.5` `11` `11.5` `12` `12.5` `13` `13.5` `14` `14.5` `15` `15.5` `16` `17` `18` `19` `20` `22` `22.4` `24` `25` `26` `27.2` `28` `30` `30.4` `31.2` `32` `34` `35.2` `36` `36.8` `38.4` `40` `41.6` `44` `44.8` `48` `51.2` `52` `54.4` `56` `57.6` `59.2` `60` `60.8` `62` `62.4` `64` `67.2` `70.4` `72` `76` `76.8` `80` `80.64` `83.2` `84` `88` `92.8` `96` `102.4` `112` `128` `160` `266.4`

### Spacing off the 4px grid (31 values)
| spacing | occurrences |
| `6px` | 921 |
| `2px` | 411 |
| `14px` | 320 |
| `-1px` | 300 |
| `10px` | 176 |
| `1px` | 73 |
| `446.031px` | 39 |
| `3px` | 16 |
| `-2.24px` | 9 |
| `5px` | 7 |
| `61.4062px` | 6 |
| `57.3594px` | 6 |
| `61.3906px` | 4 |
| `130px` | 4 |
| `18px` | 4 |
| `15px` | 4 |
| `132.953px` | 2 |
| `207px` | 2 |
| `146px` | 2 |
| `290px` | 2 |
| `547px` | 2 |
| `370px` | 2 |
| `158.016px` | 1 |
| `37.25px` | 1 |
| `2.5px` | 1 |
| `-3px` | 1 |
| `533.547px` | 1 |
| `78px` | 1 |
| `457.469px` | 1 |
| `501.203px` | 1 |

### Multiple font families (2)
| font-family (primary) | occurrences |
| Fraunces | 18151 |
| JetBrains Mono | 2464 |

## Heading scale (h1–h6)
Each tag should ideally map to one size. Multiple sizes per tag = drift.

| tag | distinct sizes (count) | verdict |
| h1 | 80.64px×39, 64px×4, 24px×4, 88px×3, 96px×2, 92.8px×1, 102.4px×1, 76.8px×1, 70.4px×1, 52px×1, 28px×1, 60px×1, 84px×1, 56px×1, 76px×1, 48px×1, 36px×1, 30px×1, 160px×1 | ⚠️ 19 sizes |
| h2 | 40px×39, 24px×36, 48px×12, 51.2px×9, 59.2px×8, 18px×7, 62.4px×4, 36px×4, 34px×4, 44.8px×3, 20px×3, 26px×2, 16px×1, 56px×1, 54.4px×1, 67.2px×1, 60px×1, 44px×1, 80px×1, 30px×1 | ⚠️ 20 sizes |
| h3 | 15px×71, 16px×27, 27.2px×25, 24px×12, 20px×8, 22.4px×7, 18px×6, 32px×6, 41.6px×1, 48px×1, 60.8px×1, 14px×1, 51.2px×1, 35.2px×1 | ⚠️ 14 sizes |
| h4 | 19px×1 | ✓ consistent |
| h5 | — | — |
| h6 | — | — |

## Top colors (opaque, by frequency)
| color | uses |
| `#ffffff` | 5561 |
| `#000000` | 4841 |
| `#e4e4e7` | 4238 |
| `#6ed5f7` | 660 |
| `#4792f5` | 542 |
| `#040506` | 330 |
| `#c4b5fd` | 234 |
| `#d1fae5` | 220 |
| `#878792` | 154 |
| `#0a0b0f` | 117 |
| `#0a0b0e` | 100 |
| `#202327` | 92 |
| `#090a0c` | 73 |
| `#0a0b10` | 36 |
| `#70b3ff` | 19 |
| `#eb4747` | 16 |
| `#70acff` | 14 |
| `#f43f5e` | 12 |
| `#cffafe` | 10 |
| `#f4f4f5` | 8 |
| `#3f3f46` | 8 |
| `#0a0c16` | 7 |
| `#08090d` | 7 |
| `#3388ff` | 5 |
| `#08130c` | 5 |

## Button styles sampled (611)
| radius | padding (T R B L) | bg | color | font | route |
| `0px` | `8px 14px 8px 14px` | `rgba(0,0,0,0)` | `rgba(255,255,255,0.7)` | 13px/300 | / |
| `9999px` | `0px 0px 0px 0px` | `rgba(0,0,0,0)` | `rgb(255,255,255)` | 16px/400 | / |
| `9999px` | `14px 28px 14px 28px` | `rgb(255,255,255)` | `rgb(10,11,14)` | 15px/500 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.5)` | 10px/400 | / |
| `10px` | `6px 10px 6px 10px` | `rgba(71,146,245,0.18)` | `rgb(255,255,255)` | 10px/400 | / |
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
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.067)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.024)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |
| `16px` | `12px 16px 12px 16px` | `rgba(255,255,255,0.02)` | `rgb(255,255,255)` | 16px/400 | /studio-showcase |

## Per-page profile
| route | label | elements | fonts | sizes | colors | primary font | deviates? |
| / | Home (Cinema) | 2075 | 2 | 35 | 61 | Fraunces | no |
| /studio-showcase | Studio Showcase | 838 | 2 | 25 | 46 | Fraunces | no |
| /films | Films Gallery | 685 | 2 | 6 | 12 | Fraunces | no |
| /pricing | Pricing | 472 | 2 | 16 | 32 | Fraunces | no |
| /how-it-works | How It Works | 1017 | 2 | 18 | 40 | Fraunces | no |
| /pipeline-preview | Pipeline Preview | 275 | 2 | 13 | 29 | Fraunces | no |
| /enterprise/coming-soon | Enterprise (Coming Soon) | 173 | 2 | 9 | 21 | Fraunces | no |
| /press | Press | 445 | 2 | 19 | 37 | Fraunces | no |
| /blog | Blog | 451 | 2 | 15 | 29 | Fraunces | no |
| /blog/sample-post | Blog Post | 75 | 1 | 3 | 8 | Fraunces | no |
| /contact | Contact | 358 | 2 | 15 | 26 | Fraunces | no |
| /terms | Terms | 462 | 2 | 15 | 26 | Fraunces | no |
| /privacy | Privacy | 443 | 2 | 15 | 26 | Fraunces | no |
| /unsubscribe | Unsubscribe | 84 | 1 | 5 | 11 | Fraunces | no |
| /auth | Sign In / Up | 159 | 2 | 9 | 16 | Fraunces | no |
| /forgot-password | Forgot Password | 116 | 1 | 4 | 12 | Fraunces | no |
| /reset-password | Reset Password | 115 | 1 | 5 | 12 | Fraunces | no |
| /business/start | Business Onboarding | 229 | 1 | 9 | 26 | Fraunces | no |
| /help | Help | 469 | 2 | 13 | 41 | Fraunces | no |
| /help/editor-manual | Help Doc | 158 | 2 | 9 | 21 | Fraunces | no |
| /help-center | Help Center (legacy) | 334 | 1 | 7 | 21 | Fraunces | no |
| /search | Search Hub | 305 | 2 | 7 | 22 | Fraunces | no |
| /lobby | Lobby | 393 | 2 | 14 | 25 | Fraunces | no |
| /music | Music Hub | 304 | 2 | 10 | 22 | Fraunces | no |
| /crossover | Crossover (VFX) | 3053 | 2 | 14 | 54 | Fraunces | no |
| /loft | Hidden Room (Loft) | 80 | 1 | 4 | 9 | Fraunces | no |
| /r/demo | Reel | 94 | 1 | 4 | 9 | Fraunces | no |
| /world/demo | World Detail | 97 | 2 | 5 | 7 | Fraunces | no |
| /c/demo | Channel/Profile (public) | 245 | 2 | 11 | 25 | Fraunces | no |
| /c/demo/patron | Patron Hub | 100 | 2 | 4 | 8 | Fraunces | no |
| /p/demo | Public Share | 76 | 2 | 5 | 8 | Fraunces | no |
| /w/demo | Widget Landing | 75 | 1 | 3 | 8 | Fraunces | no |
| /embed/demo | Embed Player | 78 | 2 | 3 | 8 | Fraunces | no |
| /widget/demo | Widget Embed | 72 | 1 | 2 | 5 | Fraunces | no |
| /studio | Studio | 159 | 2 | 9 | 16 | Fraunces | no |
| /onboarding | Onboarding | 159 | 2 | 9 | 16 | Fraunces | no |
| /welcome/checkout | Welcome Checkout | 159 | 2 | 9 | 16 | Fraunces | no |
| /library | Library | 159 | 2 | 9 | 16 | Fraunces | no |
| /account | Account | 159 | 2 | 9 | 16 | Fraunces | no |
| /account/notifications | Notification Settings | 159 | 2 | 9 | 16 | Fraunces | no |
| /profile | Profile Dashboard | 159 | 2 | 9 | 16 | Fraunces | no |
| /inbox | Inbox | 87 | 1 | 3 | 7 | Fraunces | no |
| /me/year | Director Cards (Year) | 159 | 2 | 9 | 16 | Fraunces | no |
| /avatars | Avatars Studio | 159 | 2 | 9 | 16 | Fraunces | no |
| /templates | Templates | 159 | 2 | 9 | 16 | Fraunces | no |
| /environments | Environments | 159 | 2 | 9 | 16 | Fraunces | no |
| /training-video | Training Video | 159 | 2 | 9 | 16 | Fraunces | no |
| /production | Production | 159 | 2 | 9 | 16 | Fraunces | no |
| /production/demo | Production (project) | 159 | 2 | 9 | 16 | Fraunces | no |
| /editor | Video Editor | 159 | 2 | 9 | 16 | Fraunces | no |
| /editor/demo | Video Editor (project) | 159 | 2 | 9 | 16 | Fraunces | no |
| /business | Business Overview | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/ad-studio | Ad Studio | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/create | Business Create | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/editor | Business Editor | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/projects | Business Projects | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/assets | Business Assets | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/avatars | Business Avatars | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/environments | Business Environments | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/templates | Business Templates | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/learning | Business Learning | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/team | Team & Access | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/brand | Brand | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/audit | Audit Log | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/billing | Billing | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/credits | Credits | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/analytics | Telemetry | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/reports | Reports | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/distribution | Distribution | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/integrations | Integrations | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/api | API & Hooks | 159 | 2 | 9 | 16 | Fraunces | no |
| /business/settings | Business Settings | 159 | 2 | 9 | 16 | Fraunces | no |
| /admin | Admin Console | 117 | 2 | 9 | 15 | Fraunces | no |
| /__audit_not_found__ | 404 / Not Found | 123 | 1 | 5 | 13 | Fraunces | no |

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
`/studio`, `/onboarding`, `/welcome/checkout`, `/library`, `/account`, `/account/notifications`, `/profile`, `/me/year`, `/avatars`, `/templates`, `/environments`, `/training-video`, `/production`, `/production/demo`, `/editor`, `/editor/demo`, `/business`, `/business/ad-studio`, `/business/create`, `/business/editor`, `/business/projects`, `/business/assets`, `/business/avatars`, `/business/environments`, `/business/templates`, `/business/learning`, `/business/team`, `/business/brand`, `/business/audit`, `/business/billing`, `/business/credits`, `/business/analytics`, `/business/reports`, `/business/distribution`, `/business/integrations`, `/business/api`, `/business/settings`, `/admin`



---
_See `contact-sheet.html` / `contact-sheet.png` for the visual grid, and `shots/` for full-page + above-the-fold PNGs per route._
