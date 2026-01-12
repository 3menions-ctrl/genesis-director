import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';
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
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/30 h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700/30">
        <Terminal className={cn("w-3.5 h-3.5", isLive ? "text-emerald-400" : "text-zinc-500")} />
        <span className="text-xs font-medium text-zinc-300">Activity</span>
        {isLive && (
          <motion.div 
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <ScrollArea ref={scrollRef} className="h-36 px-3 py-2">
        <AnimatePresence mode="popLayout">
          {logs.slice(-30).map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                {log.time.split(':').slice(1).join(':')}
              </span>
              <div className={cn(
                "w-1 h-1 rounded-full mt-1.5 shrink-0",
                log.type === 'success' && "bg-emerald-400",
                log.type === 'error' && "bg-rose-400",
                log.type === 'warning' && "bg-amber-400",
                log.type === 'info' && "bg-zinc-500"
              )} />
              <span className={cn(
                "text-[11px] leading-relaxed",
                log.type === 'success' && "text-emerald-400",
                log.type === 'error' && "text-rose-400",
                log.type === 'warning' && "text-amber-400",
                log.type === 'info' && "text-zinc-400"
              )}>
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="flex items-center justify-center h-28 text-zinc-600 text-[11px]">
            No activity yet
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
