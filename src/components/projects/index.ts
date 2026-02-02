/**
 * Projects Components - Barrel Export
 * 
 * Centralized exports for all projects-related components
 */

export { ProjectCard } from './ProjectCard';
export type { ProjectCardProps } from './ProjectCard';

export { ProjectFilters } from './ProjectFilters';
export type { 
  ProjectFiltersProps,
  SortByOption,
  SortOrderOption,
  StatusFilterOption,
  ViewModeOption,
} from './ProjectFilters';

export { default as ProjectsBackground } from './ProjectsBackground';
export { ProjectsHero } from './ProjectsHero';
export { MergeDownloadDialog } from './MergeDownloadDialog';
