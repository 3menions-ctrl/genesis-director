import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Film, Loader2, FolderOpen, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectSummary } from "@/hooks/useEditorClips";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectBrowserProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  loadingProjects: boolean;
  onSelectProject: (projectId: string) => void;
  loadingClips: boolean;
  loadedProjectIds: Set<string>;
}

export function ProjectBrowser({
  open,
  onClose,
  projects,
  loadingProjects,
  onSelectProject,
  loadingClips,
  loadedProjectIds,
}: ProjectBrowserProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'radial-gradient(ellipse at center, hsla(220,14%,2%,0.78) 0%, hsla(220,14%,1%,0.92) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg max-h-[70vh] rounded-3xl overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,7%,0.72) 0%, hsla(220,14%,4%,0.78) 100%)',
              backdropFilter: 'blur(48px) saturate(180%)',
              boxShadow:
                'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 32px 80px -24px hsla(0,0%,0%,0.7), 0 0 0 1px hsla(0,0%,100%,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{
                background: 'linear-gradient(180deg, hsla(0,0%,100%,0.025) 0%, transparent 100%)',
                boxShadow: 'inset 0 -1px 0 hsla(0,0%,100%,0.04)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-3.5 h-3.5 text-[hsl(215,100%,70%)]" strokeWidth={1.5} />
                <h2 className="text-[11px] font-light tracking-[0.22em] uppercase text-foreground/80 font-display">
                  Import from Project
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.05] transition-all duration-300"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-1.5">
                {loadingProjects ? (
                  <div className="flex items-center justify-center py-14 gap-2.5 text-muted-foreground/60">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                    <span className="text-[11px] font-light tracking-[0.18em] uppercase">Loading projects…</span>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground/60">
                    <Film className="w-7 h-7 opacity-25" strokeWidth={1.5} />
                    <p className="text-[11px] font-light tracking-[0.16em] uppercase">No projects with completed clips</p>
                  </div>
                ) : (
                  projects.map((project) => {
                    const isLoaded = loadedProjectIds.has(project.id);
                    return (
                      <button
                        key={project.id}
                        onClick={() => !isLoaded && onSelectProject(project.id)}
                        disabled={loadingClips}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 text-left group ${
                          isLoaded ? "cursor-default" : "cursor-pointer hover:scale-[1.005]"
                        }`}
                        style={{
                          background: isLoaded
                            ? 'linear-gradient(135deg, hsla(215,100%,55%,0.08) 0%, hsla(215,100%,55%,0.02) 100%)'
                            : 'hsla(0,0%,100%,0.015)',
                          boxShadow: isLoaded
                            ? 'inset 0 1px 0 hsla(215,100%,80%,0.08), 0 0 0 1px hsla(215,100%,55%,0.15)'
                            : 'inset 0 1px 0 hsla(0,0%,100%,0.025)',
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          className="w-16 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                          style={{
                            background: 'hsla(0,0%,100%,0.025)',
                            boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
                          }}
                        >
                          {project.thumbnailUrl ? (
                            <img
                              src={project.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Film className="w-3.5 h-3.5 text-muted-foreground/35" strokeWidth={1.5} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-light tracking-wide text-foreground/90 truncate">
                            {project.title}
                          </p>
                          <p className="text-[10px] font-light tracking-[0.14em] uppercase text-muted-foreground/45 mt-1">
                            {project.clipCount} clip{project.clipCount !== 1 ? "s" : ""} ready
                          </p>
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          {isLoaded ? (
                            <span
                              className="text-[9px] font-light tracking-[0.18em] uppercase text-[hsl(215,100%,75%)] px-2.5 py-1 rounded-full"
                              style={{
                                background: 'hsla(215,100%,55%,0.12)',
                                boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.2)',
                              }}
                            >
                              Loaded
                            </span>
                          ) : loadingClips ? (
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" strokeWidth={1.5} />
                          ) : (
                            <span className="text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/45 group-hover:text-[hsl(215,100%,75%)] transition-colors duration-300">
                              Import →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Footer hint */}
            <div
              className="px-5 py-3"
              style={{ boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)' }}
            >
              <p className="text-[9px] font-light tracking-[0.18em] uppercase text-muted-foreground/40 text-center">
                Select a project to load its clips into the editor's media library
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
