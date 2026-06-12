/**
 * Static stage manifest for the production pipeline. The order here drives
 * the progress indicator and stage-status updates everywhere downstream.
 */
import { FileText, Users, Shield, Wand2, Film, Sparkles } from 'lucide-react';

export const STAGE_CONFIG: Array<{
  name: string;
  shortName: string;
  icon: React.ElementType;
}> = [
  { name: 'Script Generation', shortName: 'Script',   icon: FileText },
  { name: 'Identity Analysis', shortName: 'Identity', icon: Users },
  { name: 'Quality Audit',     shortName: 'Audit',    icon: Shield },
  { name: 'Asset Creation',    shortName: 'Assets',   icon: Wand2 },
  { name: 'Video Production',  shortName: 'Render',   icon: Film },
  { name: 'Final Assembly',    shortName: 'Stitch',   icon: Sparkles },
];
