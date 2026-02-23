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
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg max-h-[70vh] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-display">
                  Import from Project
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-2">
                {loadingProjects ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading projects…</span>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Film className="w-8 h-8 opacity-40" />
                    <p className="text-sm">No projects with completed clips</p>
                  </div>
                ) : (
                  projects.map((project) => {
                    const isLoaded = loadedProjectIds.has(project.id);
                    return (
                      <button
                        key={project.id}
                        onClick={() => !isLoaded && onSelectProject(project.id)}
                        disabled={loadingClips}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                          isLoaded
                            ? "border-primary/30 bg-primary/5 cursor-default"
                            : "border-border/20 hover:border-primary/20 hover:bg-muted/30 cursor-pointer"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-10 rounded-lg bg-muted/30 border border-border/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {project.thumbnailUrl ? (
                            <img
                              src={project.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Film className="w-4 h-4 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {project.title}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {project.clipCount} clip{project.clipCount !== 1 ? "s" : ""} ready
                          </p>
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          {isLoaded ? (
                            <span className="text-xs text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
                              Loaded
                            </span>
                          ) : loadingClips ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
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
            <div className="px-5 py-3 border-t border-border/20">
              <p className="text-xs text-muted-foreground/50 text-center">
                Select a project to load its clips into the editor's media library
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
