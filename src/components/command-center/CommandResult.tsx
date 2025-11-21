/**
 * Command Result Display
 * Epic 3: Story 3.1 & 3.4 - Display command execution results with error recovery
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';

interface CommandResultProps {
  result: {
    type: 'result' | 'clarification';
    data: any;
  };
  onRetry?: (command: string) => void;
}

export function CommandResult({ result, onRetry }: CommandResultProps) {
  if (result.type === 'clarification') {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <CardTitle>Perlu Klarifikasi</CardTitle>
          </div>
          <CardDescription>
            Perintah Anda kurang jelas. Mohon berikan informasi lebih spesifik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.data.clarificationQuestions && (
            <div className="space-y-2">
              {result.data.clarificationQuestions.map((question: string, index: number) => (
                <p key={index} className="text-sm">{question}</p>
              ))}
            </div>
          )}

          {result.data.alternatives && result.data.alternatives.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Maksud Anda:</p>
              <div className="space-y-2">
                {result.data.alternatives.map((alt: any, index: number) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onRetry?.(alt.originalCommand)}
                  >
                    {alt.intent}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const { data } = result;

  if (data.success) {
    return (
      <Card className="border-green-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle>Berhasil</CardTitle>
          </div>
          <CardDescription>{data.message}</CardDescription>
        </CardHeader>
        {data.data && (
          <CardContent>
            <ResultDataDisplay data={data.data} />
          </CardContent>
        )}
        {data.suggestions && data.suggestions.length > 0 && (
          <CardContent>
            <p className="text-sm font-medium mb-2">Saran perintah selanjutnya:</p>
            <div className="space-y-1">
              {data.suggestions.map((suggestion: string, index: number) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onRetry?.(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // Error result
  return (
    <Card className="border-red-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600" />
          <CardTitle>Gagal</CardTitle>
        </div>
        <CardDescription>{data.message}</CardDescription>
      </CardHeader>
      {data.error && (
        <CardContent className="space-y-4">
          {data.error.recoverySuggestions && data.error.recoverySuggestions.length > 0 && (
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Saran:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {data.error.recoverySuggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="text-sm">{suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {data.error.canRetry && (
            <Button
              variant="outline"
              onClick={() => onRetry?.(data.originalCommand || '')}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Helper component to display result data
function ResultDataDisplay({ data }: { data: any }) {
  if (Array.isArray(data)) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Hasil: {data.length} item</p>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {data.slice(0, 10).map((item: any, index: number) => (
            <div key={index} className="text-sm border-l-2 pl-2 py-1">
              {JSON.stringify(item, null, 2)}
            </div>
          ))}
          {data.length > 10 && (
            <p className="text-xs text-muted-foreground">
              ...dan {data.length - 10} item lainnya
            </p>
          )}
        </div>
      </div>
    );
  }

  if (typeof data === 'object') {
    return (
      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  return <p className="text-sm">{String(data)}</p>;
}
