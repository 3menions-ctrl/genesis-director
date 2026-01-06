import { StudioLayout } from '@/components/layout/StudioLayout';
import { HollywoodPipelinePanel } from '@/components/studio/HollywoodPipelinePanel';
import { LongVideoPanel } from '@/components/studio/LongVideoPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Film, Sparkles } from 'lucide-react';

export default function LongVideo() {
  return (
    <StudioLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Tabs defaultValue="hollywood" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hollywood" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Hollywood Pipeline
            </TabsTrigger>
            <TabsTrigger value="simple" className="gap-2">
              <Film className="w-4 h-4" />
              Simple Mode
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="hollywood">
            <HollywoodPipelinePanel />
          </TabsContent>
          
          <TabsContent value="simple">
            <LongVideoPanel />
          </TabsContent>
        </Tabs>
      </div>
    </StudioLayout>
  );
}
