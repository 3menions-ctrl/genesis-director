import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PipelineLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ProductionActivityLogProps {
  logs: PipelineLog[];
  isLive: boolean;
}

export function ProductionActivityLog({ logs, isLive }: ProductionActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="glass-card h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Terminal className={cn("w-4 h-4", isLive ? "text-success" : "text-muted-foreground")} />
          <CardTitle className="text-sm">Activity Log</CardTitle>
          {isLive && (
            <motion.div 
              className="w-2 h-2 rounded-full bg-success"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea ref={scrollRef} className="h-40 px-4 pb-4">
          <AnimatePresence mode="popLayout">
            {logs.slice(-30).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 py-1"
              >
                <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                  {log.time.split(':').slice(1).join(':')}
                </span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  log.type === 'success' && "bg-success",
                  log.type === 'error' && "bg-destructive",
                  log.type === 'warning' && "bg-warning",
                  log.type === 'info' && "bg-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs leading-relaxed",
                  log.type === 'success' && "text-success",
                  log.type === 'error' && "text-destructive",
                  log.type === 'warning' && "text-warning",
                  log.type === 'info' && "text-muted-foreground"
                )}>
                  {log.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
              No activity yet
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}