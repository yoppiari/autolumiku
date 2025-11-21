/**
 * Voice Input Component
 * Epic 3: Story 3.2 - Voice input support for accessibility
 *
 * Uses Web Speech API for voice recognition
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  isProcessing: boolean;
}

type RecognitionStatus = 'idle' | 'listening' | 'processing' | 'error';

export function VoiceInput({ onTranscript, isProcessing }: VoiceInputProps) {
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Browser Anda tidak mendukung voice input. Gunakan Chrome, Edge, atau Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Indonesian
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
      setError('');
      setTranscript('');
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        setTranscript(final);
        setStatus('processing');
      }
    };

    recognition.onend = () => {
      if (status === 'listening') {
        setStatus('idle');
      }

      if (transcript && status === 'processing') {
        onTranscript(transcript);
        setTranscript('');
        setInterimTranscript('');
        setStatus('idle');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      let errorMessage = 'Terjadi kesalahan saat mendengarkan suara';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Tidak ada suara terdeteksi. Coba lagi.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone tidak tersedia. Periksa pengaturan perangkat Anda.';
          break;
        case 'not-allowed':
          errorMessage = 'Izin microphone ditolak. Mohon izinkan akses microphone.';
          break;
        case 'network':
          errorMessage = 'Koneksi internet diperlukan untuk voice recognition.';
          break;
      }

      setError(errorMessage);
      setStatus('error');
      setTranscript('');
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || status === 'listening' || isProcessing) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setError('Gagal memulai voice recognition');
      setStatus('error');
    }
  }, [status, isProcessing]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || status !== 'listening') {
      return;
    }

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  }, [status]);

  // Clear error
  const clearError = () => {
    setError('');
    setStatus('idle');
  };

  if (!isSupported) {
    return (
      <Card className="p-6 border-destructive">
        <div className="text-center space-y-2">
          <MicOff className="w-12 h-12 mx-auto text-destructive" />
          <p className="text-sm font-medium">Voice Input Tidak Didukung</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Voice Button */}
      <div className="flex flex-col items-center gap-4">
        <Button
          type="button"
          size="lg"
          variant={status === 'listening' ? 'destructive' : 'default'}
          onClick={status === 'listening' ? stopListening : startListening}
          disabled={isProcessing || status === 'processing'}
          className="w-32 h-32 rounded-full"
        >
          {status === 'listening' ? (
            <div className="flex flex-col items-center gap-2">
              <Mic className="w-12 h-12 animate-pulse" />
              <span className="text-xs">Mendengarkan...</span>
            </div>
          ) : status === 'processing' || isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-12 h-12 animate-spin" />
              <span className="text-xs">Memproses...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Mic className="w-12 h-12" />
              <span className="text-xs">Tekan untuk mulai</span>
            </div>
          )}
        </Button>

        {status === 'listening' && (
          <AudioVisualizer isActive={true} />
        )}
      </div>

      {/* Transcript Display */}
      {(transcript || interimTranscript) && (
        <Card className="p-4">
          <div className="flex items-start gap-2">
            <Volume2 className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">Yang Anda ucapkan:</p>
              <p className="text-sm">
                {transcript}
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {interimTranscript}
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && status === 'error' && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <div className="flex items-start gap-2">
            <MicOff className="w-4 h-4 mt-1 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive mb-1">Error</p>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={clearError}
                className="mt-2"
              >
                Coba Lagi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Instructions */}
      {status === 'idle' && !error && (
        <Card className="p-4 bg-muted">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Tips:</strong> Ucapkan perintah dengan jelas dalam Bahasa Indonesia.
            <br />
            Contoh: "Tampilkan semua mobil Toyota" atau "Update harga mobil Avanza"
          </p>
        </Card>
      )}
    </div>
  );
}
