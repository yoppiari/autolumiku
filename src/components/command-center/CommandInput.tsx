/**
 * Command Input Component
 * Epic 3: Story 3.1 - Text-based command input with suggestions
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  isProcessing: boolean;
  tenantId: string;
  userId: string;
}

export function CommandInput({ onSubmit, isProcessing, tenantId, userId }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions as user types
  useEffect(() => {
    if (input.length >= 2) {
      fetchSuggestions(input);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [input]);

  const fetchSuggestions = async (partialInput: string) => {
    try {
      const response = await fetch('/api/v1/commands/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partialInput,
          tenantId,
          userId,
          limit: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions.map((s: any) => s.command));
        setShowSuggestions(data.suggestions.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSubmit(input);
      setInput('');
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Contoh: tampilkan semua mobil Toyota, update harga mobil ID-xxx..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="pr-10"
          />
        </div>
        <Button type="submit" disabled={!input.trim() || isProcessing}>
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => selectSuggestion(suggestion)}
            >
              <p className="text-sm">{suggestion}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
