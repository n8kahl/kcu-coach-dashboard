'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Clipboard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ScreenshotAnalysisResult } from '@/app/api/trades/analyze-screenshot/route';

interface ScreenshotAnalyzerProps {
  onAnalysisComplete?: (analysis: ScreenshotAnalysisResult, imageData: string) => void;
  onApplyToForm?: (analysis: ScreenshotAnalysisResult) => void;
  className?: string;
}

type AnalysisState = 'idle' | 'dragging' | 'loading' | 'success' | 'error';

export function ScreenshotAnalyzer({
  onAnalysisComplete,
  onApplyToForm,
  className,
}: ScreenshotAnalyzerProps) {
  const [state, setState] = useState<AnalysisState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScreenshotAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await processImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Process image file
  const processImage = useCallback(async (file: File) => {
    setState('loading');
    setError(null);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setImagePreview(imageData);

      try {
        const response = await fetch('/api/trades/analyze-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze screenshot');
        }

        const data = await response.json();
        setAnalysis(data.analysis);
        setState('success');
        onAnalysisComplete?.(data.analysis, imageData);
      } catch (err) {
        console.error('Screenshot analysis error:', err);
        setError(err instanceof Error ? err.message : 'Analysis failed');
        setState('error');
      }
    };

    reader.onerror = () => {
      setError('Failed to read image file');
      setState('error');
    };

    reader.readAsDataURL(file);
  }, [onAnalysisComplete]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== 'loading') {
      setState('dragging');
    }
  }, [state]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === 'dragging') {
      setState('idle');
    }
  }, [state]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        await processImage(file);
      } else {
        setError('Please drop an image file');
        setState('error');
      }
    }
  }, [processImage]);

  // Handle file input change
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImage(file);
    }
  }, [processImage]);

  // Reset state
  const handleReset = useCallback(() => {
    setState('idle');
    setImagePreview(null);
    setAnalysis(null);
    setError(null);
    setShowDetails(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Apply analysis to form
  const handleApply = useCallback(() => {
    if (analysis) {
      onApplyToForm?.(analysis);
    }
  }, [analysis, onApplyToForm]);

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-[var(--profit)]" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-[var(--loss)]" />;
      default:
        return <Minus className="w-4 h-4 text-[var(--text-tertiary)]" />;
    }
  };

  // Get LTP badge color
  const getLtpBadgeVariant = (compliant: boolean) => {
    return compliant ? 'success' : 'default';
  };

  // Calculate overall LTP score
  const getLtpScore = () => {
    if (!analysis) return 0;
    const { level, trend, patience } = analysis.ltpAssessment;
    return [level.compliant, trend.compliant, patience.compliant].filter(Boolean).length;
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader
        title="Chart Screenshot Analyzer"
        action={
          (imagePreview || analysis) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              icon={<X className="w-4 h-4" />}
            >
              Clear
            </Button>
          )
        }
      />
      <CardContent>
        {/* Drop zone / Preview area */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => state === 'idle' && fileInputRef.current?.click()}
          className={cn(
            'relative min-h-[200px] border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer',
            state === 'idle' && 'border-[var(--border-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]',
            state === 'dragging' && 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10',
            state === 'loading' && 'border-[var(--accent-primary)] cursor-wait',
            state === 'success' && 'border-[var(--profit)] cursor-default',
            state === 'error' && 'border-[var(--loss)]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <AnimatePresence mode="wait">
            {/* Idle state */}
            {state === 'idle' && !imagePreview && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <Upload className="w-8 h-8 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[var(--text-primary)] font-medium mb-1">
                  Drop chart screenshot here
                </p>
                <p className="text-sm text-[var(--text-tertiary)] mb-4">
                  or click to browse, or paste from clipboard (Ctrl+V)
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <Clipboard className="w-4 h-4" />
                  <span>Supports PNG, JPG, WebP</span>
                </div>
              </motion.div>
            )}

            {/* Dragging state */}
            {state === 'dragging' && (
              <motion.div
                key="dragging"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6"
              >
                <div className="w-16 h-16 mb-4 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-[var(--accent-primary)]" />
                </div>
                <p className="text-[var(--accent-primary)] font-medium">
                  Drop to analyze
                </p>
              </motion.div>
            )}

            {/* Loading state with preview */}
            {state === 'loading' && imagePreview && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6"
              >
                <div className="relative w-full max-w-sm mb-4 rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Chart preview"
                    className="w-full h-auto opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin mb-2" />
                      <p className="text-white text-sm font-medium">Analyzing chart...</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Success state with analysis */}
            {state === 'success' && analysis && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4"
              >
                {/* Image preview thumbnail */}
                {imagePreview && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-[var(--border-primary)]">
                    <img
                      src={imagePreview}
                      alt="Chart"
                      className="w-full h-32 object-cover object-center"
                    />
                  </div>
                )}

                {/* Quick summary */}
                <div className="space-y-3">
                  {/* Symbol, Direction, Trend */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {analysis.symbol && (
                      <Badge variant="gold" className="text-base font-bold">
                        {analysis.symbol}
                      </Badge>
                    )}
                    {analysis.suggestedDirection && (
                      <Badge
                        variant={analysis.suggestedDirection === 'long' ? 'success' : 'error'}
                      >
                        {analysis.suggestedDirection === 'long' ? 'LONG' : 'SHORT'}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      {getTrendIcon(analysis.trend)}
                      <span className="text-sm text-[var(--text-secondary)] capitalize">
                        {analysis.trend}
                      </span>
                    </div>
                    {analysis.timeframe && (
                      <span className="text-sm text-[var(--text-tertiary)]">
                        {analysis.timeframe}
                      </span>
                    )}
                  </div>

                  {/* Setup type and risk */}
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{analysis.setupType}</Badge>
                    <Badge
                      variant={
                        analysis.riskLevel === 'conservative'
                          ? 'success'
                          : analysis.riskLevel === 'moderate'
                          ? 'warning'
                          : 'error'
                      }
                    >
                      {analysis.riskLevel}
                    </Badge>
                    <span className="text-sm text-[var(--text-tertiary)]">
                      Confidence: {analysis.confidence}%
                    </span>
                  </div>

                  {/* LTP Assessment */}
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        LTP Compliance ({getLtpScore()}/3)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <Badge
                          variant={getLtpBadgeVariant(analysis.ltpAssessment.level.compliant)}
                          className="mb-1"
                        >
                          {analysis.ltpAssessment.level.compliant ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </Badge>
                        <p className="text-xs text-[var(--text-tertiary)]">Level</p>
                      </div>
                      <div className="text-center">
                        <Badge
                          variant={getLtpBadgeVariant(analysis.ltpAssessment.trend.compliant)}
                          className="mb-1"
                        >
                          {analysis.ltpAssessment.trend.compliant ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </Badge>
                        <p className="text-xs text-[var(--text-tertiary)]">Trend</p>
                      </div>
                      <div className="text-center">
                        <Badge
                          variant={getLtpBadgeVariant(analysis.ltpAssessment.patience.compliant)}
                          className="mb-1"
                        >
                          {analysis.ltpAssessment.patience.compliant ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </Badge>
                        <p className="text-xs text-[var(--text-tertiary)]">Patience</p>
                      </div>
                    </div>
                  </div>

                  {/* Analysis text */}
                  <p className="text-sm text-[var(--text-secondary)]">
                    {analysis.analysis}
                  </p>

                  {/* Expandable details */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show details
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {showDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pt-2">
                          {/* Levels */}
                          {(analysis.levels.support.length > 0 || analysis.levels.resistance.length > 0) && (
                            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                              <p className="text-xs font-medium text-[var(--text-primary)] mb-2">Key Levels</p>
                              {analysis.levels.support.length > 0 && (
                                <div className="mb-1">
                                  <span className="text-xs text-[var(--profit)]">Support: </span>
                                  <span className="text-xs text-[var(--text-secondary)]">
                                    {analysis.levels.support.map(l => `$${l}`).join(', ')}
                                  </span>
                                </div>
                              )}
                              {analysis.levels.resistance.length > 0 && (
                                <div>
                                  <span className="text-xs text-[var(--loss)]">Resistance: </span>
                                  <span className="text-xs text-[var(--text-secondary)]">
                                    {analysis.levels.resistance.map(l => `$${l}`).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* LTP Details */}
                          <div className="space-y-2">
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Level: </span>
                              <span className="text-[var(--text-secondary)]">{analysis.ltpAssessment.level.reason}</span>
                            </div>
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Trend: </span>
                              <span className="text-[var(--text-secondary)]">{analysis.ltpAssessment.trend.reason}</span>
                            </div>
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Patience: </span>
                              <span className="text-[var(--text-secondary)]">{analysis.ltpAssessment.patience.reason}</span>
                            </div>
                          </div>

                          {/* Pattern */}
                          {analysis.pattern && (
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Pattern: </span>
                              <span className="text-[var(--text-secondary)]">{analysis.pattern}</span>
                            </div>
                          )}

                          {/* Candlestick patterns */}
                          {analysis.candlestickPatterns.length > 0 && (
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Candlestick Patterns: </span>
                              <span className="text-[var(--text-secondary)]">
                                {analysis.candlestickPatterns.join(', ')}
                              </span>
                            </div>
                          )}

                          {/* Indicators */}
                          {analysis.indicators.length > 0 && (
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">Indicators: </span>
                              <span className="text-[var(--text-secondary)]">
                                {analysis.indicators.join(', ')}
                              </span>
                            </div>
                          )}

                          {/* Price targets */}
                          {(analysis.entryPrice || analysis.stopLoss || analysis.targets.length > 0) && (
                            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                              <p className="text-xs font-medium text-[var(--text-primary)] mb-2">Suggested Levels</p>
                              {analysis.entryPrice && (
                                <div className="text-xs mb-1">
                                  <span className="text-[var(--text-tertiary)]">Entry: </span>
                                  <span className="text-[var(--text-primary)] font-mono">${analysis.entryPrice}</span>
                                </div>
                              )}
                              {analysis.stopLoss && (
                                <div className="text-xs mb-1">
                                  <span className="text-[var(--loss)]">Stop: </span>
                                  <span className="text-[var(--text-primary)] font-mono">${analysis.stopLoss}</span>
                                </div>
                              )}
                              {analysis.targets.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-[var(--profit)]">Targets: </span>
                                  <span className="text-[var(--text-primary)] font-mono">
                                    {analysis.targets.map(t => `$${t}`).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Apply button */}
                  {onApplyToForm && (
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleApply}
                      icon={<Check className="w-4 h-4" />}
                    >
                      Apply to Trade Form
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="w-16 h-16 mb-4 rounded-full bg-[var(--loss)]/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-[var(--loss)]" />
                </div>
                <p className="text-[var(--loss)] font-medium mb-1">Analysis Failed</p>
                <p className="text-sm text-[var(--text-tertiary)] mb-4">{error}</p>
                <Button variant="secondary" size="sm" onClick={handleReset}>
                  Try Again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScreenshotAnalyzer;
