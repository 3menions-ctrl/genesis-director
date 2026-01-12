import { useState } from 'react';
import { Plus, Clock, Users, Film, Globe, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUniverseContinuity } from '@/hooks/useUniverses';
import type { UniverseContinuityEvent } from '@/types/universe';
import { cn } from '@/lib/utils';

interface UniverseTimelineProps {
  universeId: string;
  canEdit?: boolean;
}

const EVENT_TYPE_CONFIG = {
  story_event: { icon: Film, color: 'bg-blue-500', label: 'Story Event' },
  character_change: { icon: Users, color: 'bg-purple-500', label: 'Character Change' },
  world_change: { icon: Globe, color: 'bg-green-500', label: 'World Change' },
  timeline_marker: { icon: Clock, color: 'bg-orange-500', label: 'Timeline Marker' },
};

export function UniverseTimeline({ universeId, canEdit = false }: UniverseTimelineProps) {
  const { events, isLoading, addEvent, updateEvent, deleteEvent } = useUniverseContinuity(universeId);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'story_event' as const,
    date_in_universe: '',
    is_canon: true,
  });

  const handleAdd = async () => {
    if (!newEvent.title.trim()) return;
    
    await addEvent.mutateAsync({
      ...newEvent,
      timeline_position: (events?.length || 0) + 1,
    });
    
    setNewEvent({
      title: '',
      description: '',
      event_type: 'story_event',
      date_in_universe: '',
      is_canon: true,
    });
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading timeline...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Universe Timeline</h3>
        {canEdit && (
          <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-1" />
            Add Event
          </Button>
        )}
      </div>

      {/* Add new event form */}
      {isAdding && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Timeline Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Event title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={newEvent.event_type}
                onValueChange={(v) => setNewEvent({ ...newEvent, event_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="In-universe date"
                value={newEvent.date_in_universe}
                onChange={(e) => setNewEvent({ ...newEvent, date_in_universe: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newEvent.is_canon}
                  onCheckedChange={(c) => setNewEvent({ ...newEvent, is_canon: c })}
                />
                <Label className="text-sm">Canon</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={addEvent.isPending}>
                  <Check className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        {/* Events */}
        <div className="space-y-4">
          {events?.length === 0 && !isAdding && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No events yet. Start building your universe's timeline!
              </CardContent>
            </Card>
          )}

          {events?.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG];
            const Icon = config?.icon || Clock;

            return (
              <div key={event.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={cn(
                  "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center",
                  config?.color || 'bg-muted'
                )}>
                  <Icon className="h-3 w-3 text-white" />
                </div>

                <Card className={cn(!event.is_canon && "opacity-60 border-dashed")}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{event.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {config?.label || event.event_type}
                          </Badge>
                          {!event.is_canon && (
                            <Badge variant="secondary" className="text-xs">Non-canon</Badge>
                          )}
                          {event.date_in_universe && (
                            <span className="text-xs text-muted-foreground">
                              {event.date_in_universe}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteEvent.mutate(event.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
