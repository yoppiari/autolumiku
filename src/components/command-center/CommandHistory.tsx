/**
 * Command History Component
 * Epic 3: Story 3.5 - Display command history with quick replay
 */

'use client';

import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: Date;
  success: boolean;
  result?: any;
}

interface CommandHistoryProps {
  history: CommandHistoryItem[];
  onSelectCommand: (command: string) => void;
}

export function CommandHistory({ history, onSelectCommand }: CommandHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Belum ada riwayat perintah</p>
        <p className="text-xs mt-1">Perintah Anda akan muncul di sini</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => onSelectCommand(item.command)}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                {item.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.command}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(item.timestamp, {
                    addSuffix: true,
                    locale: idLocale,
                  })}
                </p>
                {item.result?.message && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {item.result.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
