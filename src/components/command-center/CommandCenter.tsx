/**
 * Command Center - Main Interface
 * Epic 3: Story 3.1 - Natural Language Control Center
 *
 * Zero-tech-barrier interface for controlling the platform
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { CommandInput } from './CommandInput';
import { CommandHistory } from './CommandHistory';
import { CommandResult } from './CommandResult';
import { CommandSuggestions } from './CommandSuggestions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, HelpCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: Date;
  success: boolean;
  result?: any;
}

interface CommandCenterProps {
  tenantId: string;
  userId: string;
}

// ============================================================================
// Command Center Component
// ============================================================================

export function CommandCenter({ tenantId, userId }: CommandCenterProps) {
  // State
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Load command history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('command-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCommandHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      } catch (error) {
        console.error('Failed to load command history:', error);
      }
    }
  }, []);

  // Save command history to localStorage
  useEffect(() => {
    if (commandHistory.length > 0) {
      localStorage.setItem('command-history', JSON.stringify(commandHistory));
    }
  }, [commandHistory]);

  // ============================================================================
  // Command Execution
  // ============================================================================

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    setIsProcessing(true);
    setShowSuggestions(false);

    try {
      // Parse command
      const parseResponse = await fetch('/api/v1/commands/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          tenantId,
          userId,
          context: {
            recentCommands: commandHistory.slice(-5).map(h => h.command),
          },
        }),
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse command');
      }

      const parseData = await parseResponse.json();

      // Check if needs clarification
      if (parseData.parsedCommand.needsClarification) {
        setCurrentResult({
          type: 'clarification',
          data: parseData.parsedCommand,
        });

        addToHistory(command, false, {
          type: 'clarification',
          message: 'Command needs clarification',
        });

        return;
      }

      // Execute command
      const executeResponse = await fetch('/api/v1/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsedCommand: parseData.parsedCommand,
          tenantId,
          userId,
          context: {
            recentCommands: commandHistory.slice(-5).map(h => h.command),
          },
        }),
      });

      if (!executeResponse.ok) {
        throw new Error('Failed to execute command');
      }

      const executeData = await executeResponse.json();

      // Set result
      setCurrentResult({
        type: 'result',
        data: executeData.result,
      });

      // Add to history
      addToHistory(command, executeData.result.success, executeData.result);

    } catch (error: any) {
      console.error('Command execution failed:', error);

      const errorResult = {
        success: false,
        message: error.message || 'Terjadi kesalahan saat memproses perintah',
        error: {
          code: 'EXECUTION_FAILED',
          message: error.message,
          recoverySuggestions: [
            'Coba ulangi perintah',
            'Ketik "help" untuk bantuan',
          ],
          canRetry: true,
        },
      };

      setCurrentResult({
        type: 'result',
        data: errorResult,
      });

      addToHistory(command, false, errorResult);
    } finally {
      setIsProcessing(false);
    }
  }, [tenantId, userId, commandHistory]);

  // ============================================================================
  // History Management
  // ============================================================================

  const addToHistory = (command: string, success: boolean, result?: any) => {
    const historyItem: CommandHistoryItem = {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      success,
      result,
    };

    setCommandHistory(prev => [historyItem, ...prev].slice(0, 50)); // Keep last 50
  };

  const clearHistory = () => {
    setCommandHistory([]);
    localStorage.removeItem('command-history');
  };

  // ============================================================================
  // Help
  // ============================================================================

  const showHelp = async () => {
    await executeCommand('help');
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground">
          Kontrol showroom Anda menggunakan perintah natural dalam Bahasa Indonesia
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Input & Result */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Command Input Card */}
          <Card>
            <CardHeader>
              <CardTitle>Perintah</CardTitle>
              <CardDescription>
                Ketik perintah Anda dalam Bahasa Indonesia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommandInput
                onSubmit={executeCommand}
                isProcessing={isProcessing}
                tenantId={tenantId}
                userId={userId}
              />

              {/* Quick Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={showHelp}
                  className="flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Bantuan</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                >
                  {showSuggestions ? 'Sembunyikan' : 'Tampilkan'} Saran
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Command Suggestions */}
          {showSuggestions && (
            <CommandSuggestions
              onSelectCommand={executeCommand}
              tenantId={tenantId}
              userId={userId}
            />
          )}

          {/* Command Result */}
          {currentResult && (
            <CommandResult
              result={currentResult}
              onRetry={(cmd) => executeCommand(cmd)}
            />
          )}
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    <span>Riwayat</span>
                  </CardTitle>
                  <CardDescription>
                    {commandHistory.length} perintah terakhir
                  </CardDescription>
                </div>
                {commandHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <CommandHistory
                history={commandHistory}
                onSelectCommand={executeCommand}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
