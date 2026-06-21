import { createContext, useContext } from "react";

/**
 * The route namespace the current subtree lives under: "" for the consumer
 * app, "/business" for the business module. Lets shared workbenches keep
 * their in-page navigation inside whichever module is hosting them.
 *
 * Default "" means consumer behavior is completely unchanged unless a host
 * (BusinessShell) provides a base.
 */
export const ModuleBaseContext = createContext<string>("");

export function useModuleBase(): string {
  return useContext(ModuleBaseContext);
}

// Consumer route → in-module equivalent. Only routes that exist in the
// module are mapped; anything else falls through to the consumer route
// (an intentional hand-off), and callers can hide it via isMappedInModule.
const MODULE_MAP: Record<string, string> = {
  "/studio": "/create",
  "/create": "/create",
  "/editor": "/editor",
  "/library": "/projects",
  "/projects": "/projects",
  "/avatars": "/avatars",
  "/environments": "/environments",
  "/templates": "/templates",
  "/training-video": "/learning",
};

/** True if `path` has an equivalent inside a module (ignores query string). */
export function isMappedInModule(path: string): boolean {
  return path.split("?")[0] in MODULE_MAP;
}

/**
 * Returns a mapper: in the consumer app it returns paths unchanged; inside a
 * module it rewrites known consumer paths to the module equivalent
 * (preserving any query string). Unknown paths pass through.
 */
export function useModuleLink(): (path: string) => string {
  const base = useModuleBase();
  return (path: string): string => {
    if (!base) return path;
    const [p, q] = path.split("?");
    const mapped = MODULE_MAP[p];
    if (!mapped) return path;
    return base + mapped + (q ? "?" + q : "");
  };
}
