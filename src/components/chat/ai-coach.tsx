/**
 * Floating AI Coach Button - DEPRECATED
 *
 * @deprecated This component has been replaced by the AI Command Center panel.
 * New users should use:
 * - AICommandCenter (right-side panel)
 * - useAIContext().openPanel() to open programmatically
 * - Cmd+J keyboard shortcut to toggle
 *
 * This file is kept for reference but is no longer rendered in the dashboard layout.
 * See: src/components/ai/AICommandCenter.tsx
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { RichContentRenderer } from './rich-content';
import type { RichContent } from '@/types';
import {
  Bot,
  Send,
  X,
  MessageSquare,
  Loader2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  richContent?: RichContent[];
}

const SUGGESTED_PROMPTS = [
  'Explain the LTP framework',
  'How do I identify a patience candle?',
  'Review my last trade',
  'What makes a good support level?',
];

export function AICoach() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        richContent: data.richContent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center',
          'bg-[var(--accent-primary)] text-[var(--bg-primary)]',
          'shadow-[var(--shadow-glow)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]',
          'transition-shadow duration-300',
          isOpen && 'hidden'
        )}
      >
        <Bot className="w-6 h-6" />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] flex flex-col"
          >
            <Card
              variant="elevated"
              padding="none"
              className="flex flex-col h-full overflow-hidden border-[var(--accent-primary-muted)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--accent-primary-glow)] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">KCU Coach</h3>
                    <p className="text-xs text-[var(--text-tertiary)]">AI Trading Mentor</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-[var(--accent-primary-glow)] flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-[var(--accent-primary)]" />
                    </div>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-2">
                      Hey trader! How can I help?
                    </h4>
                    <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-[280px]">
                      Ask me anything about the LTP framework, your trades, or trading psychology.
                    </p>
                    <div className="space-y-2 w-full">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage(prompt)}
                          className="w-full p-3 text-left text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-primary-muted)] hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          <MessageSquare className="w-4 h-4 inline-block mr-2 text-[var(--accent-primary)]" />
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'flex-row-reverse' : ''
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
                          </div>
                        ) : (
                          <Avatar size="sm" />
                        )}
                        <div
                          className={cn(
                            'max-w-[85%]',
                            message.role === 'user' ? '' : ''
                          )}
                        >
                          <div
                            className={cn(
                              'p-3 text-sm',
                              message.role === 'user'
                                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                            )}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          {/* Rich Content (only for assistant messages) */}
                          {message.role === 'assistant' && message.richContent && message.richContent.length > 0 && (
                            <RichContentRenderer content={message.richContent} className="mt-2" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                      >
                        <div className="w-8 h-8 bg-[var(--accent-primary-glow)] flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
                        </div>
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3">
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]"
              >
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask your coach..."
                    rows={1}
                    className={cn(
                      'flex-1 resize-none bg-[var(--bg-primary)] border border-[var(--border-primary)]',
                      'p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                      'focus:outline-none focus:border-[var(--accent-primary)]',
                      'transition-colors'
                    )}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!input.trim() || isLoading}
                    icon={<Send className="w-4 h-4" />}
                  />
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
