import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Sparkles, ArrowRight, Check, Edit3, 
  RotateCcw, Play, Clock, Users, Video, ChevronRight,
  Clapperboard, Megaphone, BookOpen, FileVideo, MessageSquare,
  Image, Shield, AlertTriangle, Eye, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { PROJECT_TYPES, ProjectType, Shot } from '@/types/production-pipeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReferenceImageUpload } from '@/components/studio/ReferenceImageUpload';
import { CinematicAuditPanel } from '@/components/studio/CinematicAuditPanel';
import { QualityTierSelector } from '@/components/studio/QualityTierSelector';
import { TIER_CREDIT_COSTS } from '@/hooks/useCreditBilling';

const PROJECT_TYPE_ICONS: Record<ProjectType, React.ReactNode> = {
  'cinematic-trailer': <Clapperboard className="w-5 h-5" />,
  'social-ad': <Megaphone className="w-5 h-5" />,
  'narrative-short': <BookOpen className="w-5 h-5" />,
  'documentary': <Video className="w-5 h-5" />,
  'explainer': <MessageSquare className="w-5 h-5" />,
};

type ScriptingStep = 'type' | 'reference' | 'details' | 'generate' | 'approve' | 'audit';

export default function ScriptingStage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    state, 
    setProjectType, 
    setProjectTitle, 
    setProjectId,
    setRawScript,
    generateStructuredShots,
    updateShot,
    approveScript,
    rejectAndRegenerate,
    goToStage,
    // IMAGE-FIRST
    setReferenceImage,
    // CINEMATIC AUDITOR
    runCinematicAudit,
    approveAudit,
    applyAuditSuggestion,
    isAuditing,
    // QUALITY TIER
    setQualityTier,
  } = useProductionPipeline();
  
  const [step, setStep] = useState<ScriptingStep>('type');
  const [synopsis, setSynopsis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingShot, setEditingShot] = useState<string | null>(null);
  
  const handleTypeSelect = (type: ProjectType) => {
    setProjectType(type);
    setStep('reference'); // Go to reference image upload first
  };
  
  const handleGenerateScript = async () => {
    if (!state.projectTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to create a project');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // STEP 1: Create project in database FIRST to get projectId
      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .insert({
          title: state.projectTitle,
          user_id: user.id,
          genre: 'cinematic', // Map project type to genre
          synopsis: synopsis,
          status: 'scripting',
          target_duration_minutes: PROJECT_TYPES.find(t => t.id === state.projectType)?.shotCount || 6,
        })
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      // Store project ID in pipeline state
      setProjectId(project.id);
      console.log('[ScriptingStage] Created project:', project.id);
      
      // STEP 2: Generate script using LLM
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          title: state.projectTitle,
          genre: state.projectType,
          synopsis: synopsis,
          targetDurationMinutes: PROJECT_TYPES.find(t => t.id === state.projectType)?.shotCount || 6,
          fullMovieMode: true,
        },
      });
      
      if (error) throw error;
      
      setRawScript(data.script || '');
      
      // Update project with generated script
      await supabase
        .from('movie_projects')
        .update({ 
          generated_script: data.script,
          script_content: data.script,
        })
        .eq('id', project.id);
      
      // STEP 3: Extract scenes into shots
      await generateStructuredShots(data.script);
      
      setStep('approve');
      toast.success('Script generated! Now run the Director\'s Audit.');
    } catch (err) {
      console.error('Script generation error:', err);
      toast.error('Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle running the cinematic audit
  const handleRunAudit = async () => {
    await runCinematicAudit();
    if (state.structuredShots.length > 0) {
      setStep('audit');
    }
  };
  
  // Handle approval after audit
  const handleApproveAndContinue = () => {
    if (!state.auditApproved && state.cinematicAudit) {
      toast.error('Please approve the Director\'s Audit first');
      return;
    }
    approveScript();
    goToStage('production');
    navigate('/pipeline/production');
  };
  
  // Handle audit approval
  const handleApproveAudit = () => {
    approveAudit();
    toast.success('Production-ready! Proceeding to 20-credit generation phase.');
  };
  
  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      await rejectAndRegenerate();
      setStep('approve');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const totalDuration = state.structuredShots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const totalDialogueWords = state.structuredShots.reduce(
    (sum, shot) => sum + (shot.dialogue?.split(/\s+/).length || 0), 0
  );
  
  const hasReferenceImage = !!state.referenceImage?.analysisComplete;

  // Step 1: Project Type Selection
  if (step === 'type') {
    return (
      <div className="min-h-[85vh] flex flex-col p-6">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <Badge variant="outline" className="mb-4 gap-2">
              <Film className="w-3 h-3" />
              Step 1 of 4 — Project Type
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Project Creation & Scripting
            </h1>
            <p className="text-muted-foreground">
              Select your project type to begin the iron-clad production pipeline
            </p>
          </div>
          
          {/* Project Type Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {PROJECT_TYPES.map((type, index) => (
              <Card
                key={type.id}
                onClick={() => handleTypeSelect(type.id)}
                className={cn(
                  "p-6 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-lg group",
                  state.projectType === type.id && "border-primary bg-primary/5"
                )}
                style={{ animationDelay: `${(index + 1) * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    state.projectType === type.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    {PROJECT_TYPE_ICONS[type.id]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{type.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileVideo className="w-3 h-3" />
                      <span>{type.shotCount} shots recommended</span>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1",
                    state.projectType === type.id && "text-primary"
                  )} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Reference Image Upload (IMAGE-FIRST)
  if (step === 'reference') {
    return (
      <div className="min-h-[85vh] flex flex-col p-6">
        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <Badge variant="outline" className="mb-4 gap-2">
              <Image className="w-3 h-3" />
              Step 2 of 4 — Visual Anchor
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Upload Reference Image
            </h1>
            <p className="text-muted-foreground">
              This image becomes the <strong>primary visual anchor</strong> for your entire production.
              Character identity, lighting, and environment will be analyzed and maintained across all clips.
            </p>
          </div>
          
          {/* Reference Image Upload */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <ReferenceImageUpload
              onAnalysisComplete={setReferenceImage}
              existingAnalysis={state.referenceImage}
            />
            
            {/* Info Card */}
            <Card className="p-4 bg-muted/50">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                What We Analyze
              </h4>
              <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Character Identity
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Facial Features
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Lighting Style
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Color Palette
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Environment
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary" />
                  Spatial Geometry
                </li>
              </ul>
            </Card>
            
            <div className="flex items-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('type')}
                className="gap-2"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('details')}
                disabled={!hasReferenceImage}
                className="flex-1 gap-2"
              >
                {hasReferenceImage ? (
                  <>
                    <Check className="w-4 h-4" />
                    Continue with Visual Anchor
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4" />
                    Upload Reference Image First
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Project Details
  if (step === 'details' || step === 'generate') {
    return (
      <div className="min-h-[85vh] flex flex-col p-6">
        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <Badge variant="outline" className="mb-4 gap-2">
              <Sparkles className="w-3 h-3" />
              Step 3 of 4 — {PROJECT_TYPES.find(t => t.id === state.projectType)?.name}
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Define Your Story
            </h1>
            <p className="text-muted-foreground">
              Our AI will generate a structured shot-by-shot script for your {state.projectType.replace('-', ' ')}
            </p>
          </div>
          
          {/* Show locked reference image */}
          {state.referenceImage?.analysisComplete && (
            <div className="mb-6 animate-fade-in">
              <ReferenceImageUpload
                onAnalysisComplete={setReferenceImage}
                existingAnalysis={state.referenceImage}
              />
            </div>
          )}
          
          {/* Form */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={state.projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Enter a compelling title..."
                className="text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="synopsis">Synopsis / Story Idea</Label>
              <Textarea
                id="synopsis"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Describe your story idea, key themes, characters, or specific scenes you want to include..."
                className="min-h-[200px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The more detail you provide, the better the AI can craft your shot-by-shot script
              </p>
            </div>
            
            <div className="flex items-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('reference')}
                className="gap-2"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerateScript}
                disabled={isGenerating || !state.projectTitle.trim()}
                className="flex-1 gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Shot-by-Shot Script
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Script Approval + Cinematic Audit
  return (
    <div className="min-h-[85vh] flex flex-col p-6">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6 animate-fade-in">
          <div>
            <Badge variant="outline" className="mb-4 gap-2">
              <Shield className="w-3 h-3" />
              Step 4 of 4 — Director's Audit & Approval
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              {state.projectTitle}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {state.structuredShots.length} shots
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                ~{Math.round(totalDuration / 60)} min
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {totalDialogueWords} words
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={isGenerating || isAuditing}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Regenerate
            </Button>
            {!state.cinematicAudit ? (
              <Button
                onClick={handleRunAudit}
                disabled={isAuditing || state.structuredShots.length === 0}
                className="gap-2"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Run Director's Audit
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleApproveAndContinue}
                disabled={!state.auditApproved}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Start Production ({TIER_CREDIT_COSTS[state.qualityTier].TOTAL_PER_SHOT} credits/shot)
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Shots List */}
        <div className="flex-1 grid lg:grid-cols-3 gap-6">
          {/* Shot List */}
          <div className="lg:col-span-2">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-3 pr-4">
                {state.structuredShots.map((shot, index) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    index={index}
                    isEditing={editingShot === shot.id}
                    onEdit={() => setEditingShot(editingShot === shot.id ? null : shot.id)}
                    onUpdate={(updates) => updateShot(shot.id, updates)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Cinematic Audit Panel + Quality Tier OR Summary */}
          <div className="space-y-4">
            {/* Quality Tier Selector - Always show after audit */}
            {state.cinematicAudit && (
              <QualityTierSelector
                selectedTier={state.qualityTier}
                onTierChange={setQualityTier}
                shotCount={state.structuredShots.length}
                disabled={isAuditing}
              />
            )}
            
            {state.cinematicAudit ? (
              <CinematicAuditPanel
                audit={state.cinematicAudit}
                onApprove={handleApproveAudit}
                onApplySuggestion={applyAuditSuggestion}
                isApproved={state.auditApproved}
              />
            ) : (
              <>
                <Card className="p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Shot Flow Preview
                  </h3>
                  <div className="space-y-2">
                    {state.structuredShots.slice(0, 5).map((shot) => (
                      <div key={shot.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {shot.id}
                        </Badge>
                        <span className="text-muted-foreground truncate flex-1">
                          {shot.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {shot.durationSeconds}s
                        </span>
                      </div>
                    ))}
                    {state.structuredShots.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{state.structuredShots.length - 5} more shots
                      </p>
                    )}
                  </div>
                </Card>
                
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <h3 className="font-semibold text-foreground mb-2">Iron-Clad Pipeline</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      {hasReferenceImage ? <Check className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                      Reference Image Anchor
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-primary" />
                      Unique Shot IDs assigned
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-primary" />
                      Dialogue mapped to shots
                    </li>
                    <li className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                      Director's Audit pending
                    </li>
                  </ul>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shot Card Component
function ShotCard({ 
  shot, 
  index, 
  isEditing, 
  onEdit, 
  onUpdate 
}: { 
  shot: Shot; 
  index: number; 
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<Shot>) => void;
}) {
  const [localDescription, setLocalDescription] = useState(shot.description);
  const [localDialogue, setLocalDialogue] = useState(shot.dialogue);
  
  const handleSave = () => {
    onUpdate({ description: localDescription, dialogue: localDialogue });
    onEdit();
  };
  
  return (
    <Card className={cn(
      "p-4 transition-all duration-300",
      isEditing && "ring-2 ring-primary"
    )}>
      <div className="flex items-start gap-4">
        {/* Shot Number */}
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-foreground">{index + 1}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {shot.id}
              </Badge>
              <h4 className="font-medium text-foreground">{shot.title}</h4>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {shot.durationSeconds}s
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="gap-1 h-7"
              >
                <Edit3 className="w-3 h-3" />
                {isEditing ? 'Save' : 'Edit'}
              </Button>
            </div>
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Visual Description</Label>
                <Textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  className="mt-1 min-h-[80px] text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Dialogue</Label>
                <Textarea
                  value={localDialogue}
                  onChange={(e) => setLocalDialogue(e.target.value)}
                  className="mt-1 min-h-[60px] text-sm"
                />
              </div>
              <Button size="sm" onClick={handleSave} className="gap-1">
                <Check className="w-3 h-3" />
                Save Changes
              </Button>
            </div>
          ) : (
            <>
              {/* Visual Description */}
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {shot.description}
              </p>
              
              {/* Dialogue */}
              {shot.dialogue && (
                <div className="bg-muted/50 rounded p-2 text-sm italic text-foreground/80">
                  "{shot.dialogue.slice(0, 100)}{shot.dialogue.length > 100 ? '...' : ''}"
                </div>
              )}
              
              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Mood: {shot.mood}</span>
                {shot.characters.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {shot.characters.join(', ')}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
