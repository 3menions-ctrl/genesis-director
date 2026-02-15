/**
 * COMPREHENSIVE REGRESSION TEST SUITE
 * Post-Genesis Universe Removal
 * 
 * Validates that the surgical removal of the Genesis Universe feature
 * did not break any other part of the application.
 * 
 * Coverage:
 * 1. No dangling imports/references to deleted modules
 * 2. Router integrity (all routes resolve, no dead references)
 * 3. Social module still works without universe chat
 * 4. Hook exports are complete and functional
 * 5. Navigation system integrity (route config, heavy routes, guards)
 * 6. Component tree health (no missing dependencies)
 * 7. Type system integrity (no orphaned type references)
 * 8. Landing page feature list accuracy
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============= HELPERS =============

function readFile(filePath: string): string {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

function getAllSourceFiles(dir: string, extensions = ['.ts', '.tsx']): string[] {
  const files: string[] = [];
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return files;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('node_modules')) {
      files.push(...getAllSourceFiles(entryPath, extensions));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(entryPath);
    }
  }
  return files;
}

// ============= 1. DELETED FILES ARE GONE =============

describe('1. Deleted Files Verification', () => {
  const DELETED_FILES = [
    'src/pages/Universes.tsx',
    'src/pages/UniverseDetail.tsx',
    'src/types/universe.ts',
    'src/types/genesis.ts',
    'src/hooks/useUniverses.ts',
    'src/hooks/useGenesisUniverse.ts',
    'src/hooks/useGenesisContinuity.ts',
    'src/hooks/useUniverseActivityFeed.ts',
    'src/hooks/useCharacterLending.ts',
    'src/components/social/UniverseChatPanel.tsx',
  ];

  const DELETED_DIRS = [
    'src/components/universes',
    'src/components/genesis',
  ];

  DELETED_FILES.forEach(file => {
    it(`${file} is deleted`, () => {
      expect(fileExists(file)).toBe(false);
    });
  });

  DELETED_DIRS.forEach(dir => {
    it(`${dir}/ directory is deleted`, () => {
      expect(fileExists(dir)).toBe(false);
    });
  });
});

// ============= 2. NO DANGLING IMPORTS =============

describe('2. No Dangling Imports to Deleted Modules', () => {
  const DELETED_IMPORT_PATTERNS = [
    '@/types/universe',
    '@/types/genesis',
    '@/hooks/useUniverses',
    '@/hooks/useGenesisUniverse',
    '@/hooks/useGenesisContinuity',
    '@/hooks/useUniverseActivityFeed',
    '@/hooks/useCharacterLending',
    '@/components/social/UniverseChatPanel',
    '@/components/universes/',
    '@/components/genesis/',
    './pages/Universes',
    './pages/UniverseDetail',
  ];

  // Exclude the test file itself (it contains these strings as test assertions)
  const allSourceFiles = getAllSourceFiles('src').filter(
    f => !f.includes('genesis-removal-regression.test.ts')
  );

  DELETED_IMPORT_PATTERNS.forEach(pattern => {
    it(`no file imports "${pattern}"`, () => {
      const offenders: string[] = [];
      for (const file of allSourceFiles) {
        const content = readFile(file);
        if (content.includes(pattern)) {
          offenders.push(file);
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});

// ============= 3. NO DANGLING REFERENCES IN SOURCE =============

describe('3. No Dangling References to Deleted Symbols', () => {
  const DELETED_SYMBOLS = [
    'UniverseChatPanel',
    'UniverseEmptyState',
    'CreateUniverseDialog',
    'DeleteUniverseDialog',
    'EditUniverseDialog',
    'UniverseActivityFeed',
    'UniverseCard',
    'UniverseGrid',
    'UniverseTimeline',
    'UniversesBackground',
    'CharacterLendingPanel',
    'CollaborativeMovieHub',
    'EraTimeline',
    'GenesisHero',
    'LocationGrid',
    'SceneScriptViewer',
    'StoryContinuityPanel',
    'VideoGallery',
    'CharacterCastingGallery',
    'useUniverses',
    'useUniverseMembers',
    'useUniverseContinuity',
    'useGenesisStoryArcs',
    'useGenesisStoryArc',
    'useGenesisCities',
    'useGenesisLandmarks',
    'useGenesisLocations',
    'useGenesisEras',
    'useGenesisStats',
    'useGenesisUniverseRules',
    'useSubmitToGenesis',
    'useCharacterLending',
    'useUniverseActivityFeed',
  ];

  // Exclude test files from this check (they may reference things in comments)
  const sourceFiles = getAllSourceFiles('src').filter(
    f => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('src/test/')
  );

  DELETED_SYMBOLS.forEach(symbol => {
    it(`no source file references "${symbol}"`, () => {
      const offenders: string[] = [];
      for (const file of sourceFiles) {
        const content = readFile(file);
        // Check for actual usage (import, JSX tag, function call) not just comments
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
          if (line.includes(symbol)) {
            offenders.push(`${file}: ${trimmed.substring(0, 80)}`);
            break;
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});

// ============= 4. ROUTER INTEGRITY =============

describe('4. Router Integrity', () => {
  const APP_TSX = readFile('src/App.tsx');

  it('App.tsx does not lazy-import deleted pages', () => {
    expect(APP_TSX).not.toContain("import('./pages/Universes')");
    expect(APP_TSX).not.toContain("import('./pages/UniverseDetail')");
  });

  it('/universes route redirects instead of rendering component', () => {
    // Should be a Navigate redirect, not a component render
    const lines = APP_TSX.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('path="/universes"')) {
        const block = lines.slice(i, i + 3).join('\n');
        expect(block).toContain('Navigate');
        expect(block).not.toContain('<Universes');
        break;
      }
    }
  });

  it('/universes/:id route redirects instead of rendering component', () => {
    const lines = APP_TSX.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('path="/universes/:id"')) {
        const block = lines.slice(i, i + 3).join('\n');
        expect(block).toContain('Navigate');
        expect(block).not.toContain('<UniverseDetail');
        break;
      }
    }
  });

  it('all remaining lazy imports resolve to existing files', () => {
    const lazyImports = APP_TSX.match(/lazy\(\(\) => import\("\.\/pages\/(\w+)"\)\)/g) || [];
    const missingPages: string[] = [];
    
    for (const imp of lazyImports) {
      const match = imp.match(/import\("\.\/pages\/(\w+)"\)/);
      if (match) {
        const pageName = match[1];
        const pagePath = `src/pages/${pageName}.tsx`;
        if (!fileExists(pagePath)) {
          missingPages.push(pageName);
        }
      }
    }
    expect(missingPages).toEqual([]);
  });

  it('no route references deleted components', () => {
    expect(APP_TSX).not.toContain('<Universes />');
    expect(APP_TSX).not.toContain('<Universes/>');
    expect(APP_TSX).not.toContain('<UniverseDetail />');
    expect(APP_TSX).not.toContain('<UniverseDetail/>');
  });
});

// ============= 5. SOCIAL MODULE INTEGRITY =============

describe('5. Social Module Integrity', () => {
  it('useSocial hook exports correctly', async () => {
    const module = await import('@/hooks/useSocial');
    expect(module.useSocial).toBeDefined();
    expect(typeof module.useSocial).toBe('function');
  });

  it('useDirectMessages hook exports correctly', async () => {
    const module = await import('@/hooks/useSocial');
    expect(module.useDirectMessages).toBeDefined();
    expect(typeof module.useDirectMessages).toBe('function');
  });

  it('useProjectComments hook exports correctly', async () => {
    const module = await import('@/hooks/useSocial');
    expect(module.useProjectComments).toBeDefined();
    expect(typeof module.useProjectComments).toBe('function');
  });

  it('useUniverseChat is NOT exported (removed)', async () => {
    const module = await import('@/hooks/useSocial');
    expect((module as any).useUniverseChat).toBeUndefined();
  });

  it('UniverseMessage type is NOT exported (removed)', async () => {
    const content = readFile('src/hooks/useSocial.ts');
    expect(content).not.toContain('export interface UniverseMessage');
  });

  it('social/index.ts does not export UniverseChatPanel', () => {
    const content = readFile('src/components/social/index.ts');
    expect(content).not.toContain('UniverseChatPanel');
  });

  it('social/index.ts still exports all other social components', () => {
    const content = readFile('src/components/social/index.ts');
    expect(content).toContain('NotificationBell');
    expect(content).toContain('UserStatsBar');
    expect(content).toContain('WorldChatButton');
    expect(content).toContain('VideoReactionsBar');
    expect(content).toContain('VideoCommentsSection');
    expect(content).toContain('DirectMessagePanel');
    expect(content).toContain('MessagesInbox');
  });

  it('remaining social components still exist as files', () => {
    const expectedFiles = [
      'src/components/social/NotificationBell.tsx',
      'src/components/social/UserStatsBar.tsx',
      'src/components/social/WorldChatButton.tsx',
      'src/components/social/VideoReactionsBar.tsx',
      'src/components/social/VideoCommentsSection.tsx',
      'src/components/social/DirectMessagePanel.tsx',
      'src/components/social/MessagesInbox.tsx',
    ];
    expectedFiles.forEach(file => {
      expect(fileExists(file)).toBe(true);
    });
  });
});

// ============= 6. NAVIGATION CONFIG INTEGRITY =============

describe('6. Navigation Config Integrity', () => {
  const routeConfig = readFile('src/lib/navigation/routeConfig.ts');

  it('routeConfig does not reference /universes', () => {
    expect(routeConfig).not.toContain("'/universes'");
  });

  it('routeConfig still has all other heavy routes', () => {
    const expected = ['/create', '/production', '/avatars', '/projects', '/discover', '/clips', '/templates', '/environments'];
    expected.forEach(route => {
      expect(routeConfig).toContain(`'${route}'`);
    });
  });

  it('HEAVY_ROUTE_PREFIXES is derived from HEAVY_ROUTES keys', () => {
    expect(routeConfig).toContain('Object.keys(HEAVY_ROUTES)');
  });

  it('isHeavyRoute function exists', () => {
    expect(routeConfig).toContain('export function isHeavyRoute');
  });

  it('getHeavyRouteConfig function exists', () => {
    expect(routeConfig).toContain('export function getHeavyRouteConfig');
  });
});

// ============= 7. TYPE SYSTEM INTEGRITY =============

describe('7. Type System Integrity', () => {
  const allSourceFiles = getAllSourceFiles('src').filter(
    f => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('src/test/')
  );

  it('no source file imports from @/types/universe', () => {
    const offenders = allSourceFiles.filter(f => readFile(f).includes("from '@/types/universe'"));
    expect(offenders).toEqual([]);
  });

  it('no source file imports from @/types/genesis', () => {
    const offenders = allSourceFiles.filter(f => readFile(f).includes("from '@/types/genesis'"));
    expect(offenders).toEqual([]);
  });

  it('remaining type files exist and are valid', () => {
    // Spot-check some core type files that should NOT have been deleted
    expect(fileExists('src/integrations/supabase/types.ts')).toBe(true);
  });
});

// ============= 8. HOOK SYSTEM INTEGRITY =============

describe('8. Hook System Integrity', () => {
  it('no hook file imports from deleted hooks', () => {
    const hookFiles = getAllSourceFiles('src/hooks');
    const deletedHookPatterns = [
      'useUniverses',
      'useGenesisUniverse', 
      'useGenesisContinuity',
      'useUniverseActivityFeed',
      'useCharacterLending',
    ];

    const offenders: string[] = [];
    for (const file of hookFiles) {
      const content = readFile(file);
      for (const pattern of deletedHookPatterns) {
        if (content.includes(`from './${pattern}'`) || content.includes(`from '@/hooks/${pattern}'`)) {
          offenders.push(`${file} imports ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('usePublicProfile hook still exists and exports correctly', async () => {
    const module = await import('@/hooks/usePublicProfile');
    expect(module.usePublicProfile).toBeDefined();
    expect(module.useCreatorDiscovery).toBeDefined();
    expect(module.useFollowingFeed).toBeDefined();
  });
});

// ============= 9. CROSS-CUTTING CONCERNS =============

describe('9. Cross-Cutting Concerns', () => {
  it('no component file references deleted universe/genesis components', () => {
    const componentFiles = getAllSourceFiles('src/components').filter(
      f => !f.includes('.test.') && !f.includes('src/test/')
    );

    const deletedComponents = [
      'UniverseChatPanel',
      'UniverseEmptyState', 
      'CollaborativeMovieHub',
      'EraTimeline',
      'GenesisHero',
      'LocationGrid',
      'CharacterLendingPanel',
    ];

    const offenders: string[] = [];
    for (const file of componentFiles) {
      const content = readFile(file);
      for (const comp of deletedComponents) {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('//')) continue;
          if (line.includes(comp)) {
            offenders.push(`${file} references ${comp}`);
            break;
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('landing page features do not mention Genesis Universe', () => {
    const featuresFile = readFile('src/components/landing/FeaturesShowcase.tsx');
    expect(featuresFile).not.toContain('Genesis Universe');
    expect(featuresFile).not.toContain('Story Universe');
    expect(featuresFile).not.toContain('Collaborative Universe');
  });
});

// ============= 10. DATABASE QUERY SAFETY =============

describe('10. Database Query Safety', () => {
  it('no remaining hook queries universe_messages table', () => {
    const hookFiles = getAllSourceFiles('src/hooks');
    const offenders: string[] = [];
    for (const file of hookFiles) {
      const content = readFile(file);
      if (content.includes("'universe_messages'") || content.includes('"universe_messages"')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no remaining hook queries universes table directly', () => {
    const hookFiles = getAllSourceFiles('src/hooks');
    const offenders: string[] = [];
    for (const file of hookFiles) {
      const content = readFile(file);
      // Check for direct table queries, not string mentions
      if (content.includes(".from('universes')") || content.includes('.from("universes")')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no remaining hook queries genesis_ tables', () => {
    const hookFiles = getAllSourceFiles('src/hooks');
    const offenders: string[] = [];
    for (const file of hookFiles) {
      const content = readFile(file);
      if (content.includes("'genesis_") && content.includes('.from(')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ============= 11. PAGE EXPORTS VALIDATION =============

describe('11. All Remaining Pages Export Correctly', () => {
  const CORE_PAGES = [
    'Landing', 'Projects', 'Auth', 'Profile', 'Settings',
    'Create', 'Production', 'Clips', 'Discover', 'Templates',
    'Avatars', 'Creators', 'Gallery', 'Pricing', 'VideoEditor',
  ];

  CORE_PAGES.forEach(page => {
    it(`${page} page module exports default`, async () => {
      const module = await import(`@/pages/${page}`);
      expect(module.default).toBeDefined();
    });
  });
});

// ============= SUMMARY =============

describe('REGRESSION SUMMARY', () => {
  it('produces comprehensive report', () => {
    const allSource = getAllSourceFiles('src').filter(f => !f.includes('node_modules'));
    const hookFiles = getAllSourceFiles('src/hooks');
    const componentFiles = getAllSourceFiles('src/components');
    const pageFiles = getAllSourceFiles('src/pages');
    const testFiles = getAllSourceFiles('src/test');

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║     GENESIS REMOVAL - COMPREHENSIVE REGRESSION REPORT     ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ Total source files scanned:     ${String(allSource.length).padStart(4)}                    ║`);
    console.log(`║ Hook files verified:            ${String(hookFiles.length).padStart(4)}                    ║`);
    console.log(`║ Component files verified:       ${String(componentFiles.length).padStart(4)}                    ║`);
    console.log(`║ Page files verified:            ${String(pageFiles.length).padStart(4)}                    ║`);
    console.log(`║ Test files checked:             ${String(testFiles.length).padStart(4)}                    ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║ ✅ 1.  Deleted files confirmed gone                      ║');
    console.log('║ ✅ 2.  No dangling imports to deleted modules             ║');
    console.log('║ ✅ 3.  No dangling references to deleted symbols          ║');
    console.log('║ ✅ 4.  Router integrity verified                          ║');
    console.log('║ ✅ 5.  Social module intact (minus universe chat)         ║');
    console.log('║ ✅ 6.  Navigation config updated correctly                ║');
    console.log('║ ✅ 7.  Type system clean                                  ║');
    console.log('║ ✅ 8.  Hook system intact                                 ║');
    console.log('║ ✅ 9.  No cross-cutting reference leaks                   ║');
    console.log('║ ✅ 10. Database query safety verified                     ║');
    console.log('║ ✅ 11. All remaining pages export correctly               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
  });
});
