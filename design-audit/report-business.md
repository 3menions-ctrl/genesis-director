# Genesis Director — Design Audit

_Generated against http://localhost:7777 · 21 pages analysed (desktop pass) · 42 total captures (desktop + mobile)._

## Summary

- **Routes discovered:** 21 (from `src/App.tsx` React Router config + `businessNav.ts`)
- **Rendered unique content:** 21 routes
- **Redirected (auth/gate):** 0 routes → captured at their redirect target
- **Capture errors:** 0
- **Distinct opaque colors:** 35
- **Near-duplicate color pairs (RGB dist < 12):** 14
- **Distinct font families:** 2
- **Distinct font sizes:** 29
- **Distinct button radii:** 6
- **Distinct spacing values:** 36

> ✅ This pass ran **authenticated** (session: `./auth-business.json`). Protected
> consumer routes render their real surfaces. Any routes still listed under
> "Redirected" are gated to a different account type (e.g. business/admin).
> Token stats below are from the 21 routes that rendered real content.

## 🚩 Flagged inconsistencies

### Near-duplicate colors (14)
Colors close enough that they're probably meant to be the same token but drifted:

| Color A | uses | Color B | uses | RGB dist |
| `#090b11` | 1 | `#0a0b10` | 1 | 1.4 |
| `#090a0c` | 33 | `#07090d` | 7 | 2.4 |
| `#07090d` | 7 | `#05070a` | 1 | 4.1 |
| `#090a0c` | 33 | `#0a0b10` | 1 | 4.2 |
| `#040506` | 48 | `#05070a` | 1 | 4.6 |
| `#07090d` | 7 | `#0a0b10` | 1 | 4.7 |
| `#07090d` | 7 | `#090b11` | 1 | 4.9 |
| `#090a0c` | 33 | `#090b11` | 1 | 5.1 |
| `#090a0c` | 33 | `#05070a` | 1 | 5.4 |
| `#040506` | 48 | `#07090d` | 7 | 8.6 |
| `#040506` | 48 | `#000000` | 2 | 8.8 |
| `#05070a` | 1 | `#0a0b10` | 1 | 8.8 |
| `#05070a` | 1 | `#090b11` | 1 | 9 |
| `#040506` | 48 | `#090a0c` | 33 | 9.3 |

### Button radius inconsistency (6 distinct)
A consistent system usually has 2–4 radius tokens. Distinct values in use:

| border-radius | occurrences |
| `9999px` | 396 |
| `0px` | 325 |
| `16px` | 34 |
| `20px` | 32 |
| `10px` | 28 |
| `12px` | 6 |

### Font sizes off a clean scale (9 fractional)
Fractional / odd sizes that don't sit on an integer-px scale: `8.5px`, `9.5px`, `11.5px`, `12.5px`, `14.5px`, `15.5px`, `30.4px`, `38.4px`, `50.4px`

All distinct font sizes (px): `8` `8.5` `9` `9.5` `10` `11` `11.5` `12` `12.5` `13` `14` `14.5` `15` `15.5` `16` `17` `18` `19` `20` `22` `26` `30.4` `32` `34` `38.4` `40` `48` `50.4` `76`

### Spacing off the 4px grid (16 values)
| spacing | occurrences |
| `10px` | 1915 |
| `2px` | 1419 |
| `6px` | 682 |
| `14px` | 98 |
| `-1px` | 91 |
| `178.953px` | 62 |
| `1px` | 8 |
| `9px` | 3 |
| `102.391px` | 2 |
| `166px` | 2 |
| `210px` | 2 |
| `126.156px` | 1 |
| `162.875px` | 1 |
| `93.75px` | 1 |
| `164.875px` | 1 |
| `330.625px` | 1 |

### Multiple font families (2)
| font-family (primary) | occurrences |
| Fraunces | 15950 |
| JetBrains Mono | 1538 |

## Heading scale (h1–h6)
Each tag should ideally map to one size. Multiple sizes per tag = drift.

| tag | distinct sizes (count) | verdict |
| h1 | 50.4px×16, 48px×2, 30.4px×1, 76px×1 | ⚠️ 4 sizes |
| h2 | 17px×53, 15.5px×1, 32px×1, 38.4px×1 | ⚠️ 4 sizes |
| h3 | 19px×198, 15px×120, 32px×9, 30.4px×1, 22px×1, 10px×1, 40px×1 | ⚠️ 7 sizes |
| h4 | — | — |
| h5 | — | — |
| h6 | — | — |

## Top colors (opaque, by frequency)
| color | uses |
| `#e4e4e7` | 7240 |
| `#ffffff` | 3148 |
| `#878792` | 156 |
| `#70acff` | 119 |
| `#e0c4ee` | 62 |
| `#f6a055` | 54 |
| `#040506` | 48 |
| `#75c7f0` | 39 |
| `#090a0c` | 33 |
| `#257bf4` | 23 |
| `#f56b3d` | 10 |
| `#d9d4bf` | 9 |
| `#07090d` | 7 |
| `#c36cef` | 6 |
| `#719df4` | 5 |
| `#a3c9ff` | 4 |
| `#0a84ff` | 4 |
| `#000000` | 2 |
| `#c285e0` | 2 |
| `#5ac8fa` | 2 |
| `#3b3b3b` | 1 |
| `#05070a` | 1 |
| `#8fbeff` | 1 |
| `#8f96a3` | 1 |
| `#090b11` | 1 |

## Button styles sampled (821)
| radius | padding (T R B L) | bg | color | font | route |
| `0px` | `12px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(228,228,231)` | 16px/400 | /business |
| `20px` | `8px 0px 8px 0px` | `rgba(0,0,0,0)` | `rgba(135,135,146,0.55)` | 16px/400 | /business |
| `0px` | `12px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(228,228,231)` | 16px/400 | /business/ad-studio |
| `20px` | `8px 0px 8px 0px` | `rgba(0,0,0,0)` | `rgba(135,135,146,0.55)` | 16px/400 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(37,123,244,0.12)` | `rgb(163,201,255)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(37,123,244,0.12)` | `rgb(163,201,255)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(37,123,244,0.12)` | `rgb(163,201,255)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 14px 0px 14px` | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.6)` | 13px/300 | /business/ad-studio |
| `9999px` | `0px 24px 0px 24px` | `rgb(37,123,244)` | `rgb(255,255,255)` | 14px/500 | /business/ad-studio |
| `0px` | `12px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(228,228,231)` | 16px/400 | /business/create |
| `20px` | `8px 0px 8px 0px` | `rgba(0,0,0,0)` | `rgba(135,135,146,0.55)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(228,228,231)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |
| `16px` | `10px 4px 10px 4px` | `rgba(0,0,0,0)` | `rgb(135,135,146)` | 16px/400 | /business/create |

## Per-page profile
| route | label | elements | fonts | sizes | colors | primary font | deviates? |
| /business | Business Overview | 530 | 2 | 14 | 20 | Fraunces | no |
| /business/ad-studio | Ad Studio | 370 | 2 | 10 | 25 | Fraunces | no |
| /business/create | Business Create | 601 | 2 | 13 | 33 | Fraunces | no |
| /business/editor | Business Editor | 780 | 2 | 15 | 46 | Fraunces | no |
| /business/projects | Business Projects | 399 | 2 | 13 | 23 | Fraunces | no |
| /business/assets | Business Assets | 356 | 2 | 13 | 25 | Fraunces | no |
| /business/avatars | Business Avatars | 12489 | 2 | 12 | 32 | Fraunces | no |
| /business/environments | Business Environments | 3235 | 2 | 10 | 42 | Fraunces | no |
| /business/templates | Business Templates | 322 | 2 | 12 | 18 | Fraunces | no |
| /business/learning | Business Learning | 436 | 2 | 12 | 33 | Fraunces | no |
| /business/team | Team & Access | 441 | 2 | 15 | 28 | Fraunces | no |
| /business/brand | Brand | 425 | 2 | 14 | 39 | Fraunces | no |
| /business/audit | Audit Log | 391 | 2 | 14 | 21 | Fraunces | no |
| /business/billing | Billing | 414 | 2 | 14 | 23 | Fraunces | no |
| /business/credits | Credits | 469 | 2 | 16 | 25 | Fraunces | no |
| /business/analytics | Telemetry | 441 | 2 | 13 | 24 | Fraunces | no |
| /business/reports | Reports | 347 | 2 | 10 | 19 | Fraunces | no |
| /business/distribution | Distribution | 459 | 2 | 14 | 28 | Fraunces | no |
| /business/integrations | Integrations | 392 | 2 | 12 | 20 | Fraunces | no |
| /business/api | API & Hooks | 343 | 2 | 13 | 19 | Fraunces | no |
| /business/settings | Business Settings | 337 | 2 | 12 | 19 | Fraunces | no |

## Routes & capture status
**Stubbed params used:**
_none_

**Redirected (gated, unauthenticated):**




---
_See `contact-sheet.html` / `contact-sheet.png` for the visual grid, and `shots/` for full-page + above-the-fold PNGs per route._
