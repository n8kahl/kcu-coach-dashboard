'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Minus,
  TrendingUp,
  Square,
  Type,
  Trash2,
  MousePointer,
  Hash,
} from 'lucide-react';

// Drawing tool types
export type DrawingToolType =
  | 'select'
  | 'horizontal_line'
  | 'trend_line'
  | 'rectangle'
  | 'fibonacci'
  | 'text';

// Drawing object types
export interface Drawing {
  id: string;
  type: DrawingToolType;
  color: string;
  lineWidth: number;
  data: DrawingData;
  locked?: boolean;
  visible?: boolean;
}

export interface Point {
  price: number;
  time: number;
}

export interface HorizontalLineData {
  price: number;
  label?: string;
}

export interface TrendLineData {
  startPoint: Point;
  endPoint: Point;
  extendLeft?: boolean;
  extendRight?: boolean;
}

export interface RectangleData {
  topLeft: Point;
  bottomRight: Point;
  fillColor?: string;
  fillOpacity?: number;
}

export interface FibonacciData {
  startPoint: Point;
  endPoint: Point;
  levels: number[]; // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
  showLabels?: boolean;
}

export interface TextData {
  point: Point;
  text: string;
  fontSize?: number;
  backgroundColor?: string;
}

export type DrawingData =
  | HorizontalLineData
  | TrendLineData
  | RectangleData
  | FibonacciData
  | TextData;

// Temp drawing state during creation
interface TempDrawingState {
  type: DrawingToolType;
  startPoint: Point;
  previewEndPoint?: Point;
}

// Default colors for drawings
const DRAWING_COLORS = [
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ffffff', // White
];

// Fibonacci default levels
const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

interface DrawingToolsProps {
  selectedTool: DrawingToolType;
  onToolChange: (tool: DrawingToolType) => void;
  drawings: Drawing[];
  onDrawingsChange: (drawings: Drawing[]) => void;
  onDrawingStart?: () => void;
  onDrawingEnd?: (drawing: Drawing) => void;
  selectedDrawingId?: string | null;
  onDrawingSelect?: (id: string | null) => void;
  className?: string;
}

export function DrawingTools({
  selectedTool,
  onToolChange,
  drawings,
  onDrawingsChange,
  onDrawingStart,
  onDrawingEnd,
  selectedDrawingId,
  onDrawingSelect,
  className,
}: DrawingToolsProps) {
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[0]);
  const [lineWidth, setLineWidth] = useState(1);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools: { type: DrawingToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { type: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select', shortcut: 'V' },
    { type: 'horizontal_line', icon: <Minus className="w-4 h-4" />, label: 'Horizontal Line', shortcut: 'H' },
    { type: 'trend_line', icon: <TrendingUp className="w-4 h-4" />, label: 'Trend Line', shortcut: 'T' },
    { type: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle', shortcut: 'R' },
    { type: 'fibonacci', icon: <Hash className="w-4 h-4" />, label: 'Fibonacci', shortcut: 'F' },
    { type: 'text', icon: <Type className="w-4 h-4" />, label: 'Text', shortcut: 'X' },
  ];

  // Delete selected drawing
  const handleDeleteSelected = useCallback(() => {
    if (selectedDrawingId) {
      onDrawingsChange(drawings.filter(d => d.id !== selectedDrawingId));
      onDrawingSelect?.(null);
    }
  }, [selectedDrawingId, drawings, onDrawingsChange, onDrawingSelect]);

  // Clear all drawings
  const handleClearAll = useCallback(() => {
    if (drawings.length > 0 && confirm('Clear all drawings?')) {
      onDrawingsChange([]);
      onDrawingSelect?.(null);
    }
  }, [drawings.length, onDrawingsChange, onDrawingSelect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          onToolChange('select');
          break;
        case 'h':
          onToolChange('horizontal_line');
          break;
        case 't':
          onToolChange('trend_line');
          break;
        case 'r':
          onToolChange('rectangle');
          break;
        case 'f':
          onToolChange('fibonacci');
          break;
        case 'x':
          onToolChange('text');
          break;
        case 'delete':
        case 'backspace':
          if (selectedDrawingId) {
            e.preventDefault();
            handleDeleteSelected();
          }
          break;
        case 'escape':
          onToolChange('select');
          onDrawingSelect?.(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange, selectedDrawingId, handleDeleteSelected, onDrawingSelect]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Tool Buttons */}
      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-1">
        {tools.map(tool => (
          <button
            key={tool.type}
            onClick={() => onToolChange(tool.type)}
            className={cn(
              'p-2 rounded transition-colors relative group',
              selectedTool === tool.type
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {tool.shortcut}
            </span>
          </button>
        ))}

        {/* Separator */}
        <div className="w-px h-6 bg-[var(--border-primary)] mx-1" />

        {/* Color Picker */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={cn(
              'p-2 rounded transition-colors hover:bg-[var(--bg-tertiary)]',
              showColorPicker && 'bg-[var(--bg-tertiary)]'
            )}
            title="Line Color"
          >
            <div
              className="w-4 h-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: selectedColor }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute top-full mt-1 left-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-2 shadow-xl z-50">
              <div className="grid grid-cols-4 gap-1">
                {DRAWING_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setShowColorPicker(false);
                    }}
                    className={cn(
                      'w-6 h-6 rounded border transition-transform hover:scale-110',
                      selectedColor === color
                        ? 'border-white scale-110'
                        : 'border-[var(--border-primary)]'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line Width */}
        <select
          value={lineWidth}
          onChange={e => setLineWidth(Number(e.target.value))}
          className="p-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)]"
          title="Line Width"
        >
          <option value={1}>1px</option>
          <option value={2}>2px</option>
          <option value={3}>3px</option>
          <option value={4}>4px</option>
        </select>

        {/* Separator */}
        <div className="w-px h-6 bg-[var(--border-primary)] mx-1" />

        {/* Delete */}
        <button
          onClick={handleDeleteSelected}
          disabled={!selectedDrawingId}
          className={cn(
            'p-2 rounded transition-colors',
            selectedDrawingId
              ? 'text-red-400 hover:bg-red-500/20'
              : 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
          )}
          title="Delete Selected (Del)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Drawings List */}
      {drawings.length > 0 && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
            <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase">
              Drawings ({drawings.length})
            </span>
            <button
              onClick={handleClearAll}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {drawings.map(drawing => (
              <button
                key={drawing.id}
                onClick={() => onDrawingSelect?.(drawing.id === selectedDrawingId ? null : drawing.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  drawing.id === selectedDrawingId
                    ? 'bg-[var(--accent-primary)]/20'
                    : 'hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <div
                  className="w-3 h-0.5"
                  style={{ backgroundColor: drawing.color }}
                />
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {getDrawingLabel(drawing)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to get drawing label
function getDrawingLabel(drawing: Drawing): string {
  switch (drawing.type) {
    case 'horizontal_line': {
      const data = drawing.data as HorizontalLineData;
      return `H-Line @ ${data.price.toFixed(2)}`;
    }
    case 'trend_line':
      return 'Trend Line';
    case 'rectangle':
      return 'Rectangle Zone';
    case 'fibonacci':
      return 'Fibonacci Retracement';
    case 'text': {
      const data = drawing.data as TextData;
      return `Text: ${data.text.slice(0, 20)}${data.text.length > 20 ? '...' : ''}`;
    }
    default:
      return 'Drawing';
  }
}

// Hook for managing drawing state
export function useDrawingTools() {
  const [selectedTool, setSelectedTool] = useState<DrawingToolType>('select');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempDrawing, setTempDrawing] = useState<TempDrawingState | null>(null);

  // Create a new drawing
  const createDrawing = useCallback(
    (type: DrawingToolType, data: DrawingData, color: string = '#ef4444', lineWidth: number = 1): Drawing => {
      return {
        id: `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        color,
        lineWidth,
        data,
        locked: false,
        visible: true,
      };
    },
    []
  );

  // Add a drawing
  const addDrawing = useCallback((drawing: Drawing) => {
    setDrawings(prev => [...prev, drawing]);
  }, []);

  // Update a drawing
  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings(prev =>
      prev.map(d => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  // Delete a drawing
  const deleteDrawing = useCallback((id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedDrawingId === id) {
      setSelectedDrawingId(null);
    }
  }, [selectedDrawingId]);

  // Handle click on chart for drawing
  const handleChartClick = useCallback(
    (price: number, time: number) => {
      if (selectedTool === 'select') {
        // Handle selection
        return;
      }

      if (selectedTool === 'horizontal_line') {
        const drawing = createDrawing('horizontal_line', { price });
        addDrawing(drawing);
        setSelectedTool('select');
        return;
      }

      if (!isDrawing) {
        // Start drawing
        setIsDrawing(true);
        setTempDrawing({
          type: selectedTool,
          startPoint: { price, time },
        });
      } else {
        // Complete drawing
        if (tempDrawing) {
          let finalData: DrawingData;

          switch (selectedTool) {
            case 'trend_line':
              finalData = {
                startPoint: tempDrawing.startPoint,
                endPoint: { price, time },
                extendLeft: false,
                extendRight: false,
              } as TrendLineData;
              break;
            case 'rectangle':
              finalData = {
                topLeft: tempDrawing.startPoint,
                bottomRight: { price, time },
                fillOpacity: 0.2,
              } as RectangleData;
              break;
            case 'fibonacci':
              finalData = {
                startPoint: tempDrawing.startPoint,
                endPoint: { price, time },
                levels: DEFAULT_FIB_LEVELS,
                showLabels: true,
              } as FibonacciData;
              break;
            case 'text':
              finalData = {
                point: { price, time },
                text: 'Note',
                fontSize: 12,
              } as TextData;
              break;
            default:
              return;
          }

          const drawing = createDrawing(selectedTool, finalData);
          addDrawing(drawing);
        }

        setIsDrawing(false);
        setTempDrawing(null);
        setSelectedTool('select');
      }
    },
    [selectedTool, isDrawing, tempDrawing, createDrawing, addDrawing]
  );

  // Handle mouse move for preview
  const handleChartMouseMove = useCallback(
    (price: number, time: number) => {
      if (isDrawing && tempDrawing) {
        setTempDrawing({
          ...tempDrawing,
          previewEndPoint: { price, time },
        });
      }
    },
    [isDrawing, tempDrawing]
  );

  // Cancel current drawing
  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setTempDrawing(null);
  }, []);

  return {
    selectedTool,
    setSelectedTool,
    drawings,
    setDrawings,
    selectedDrawingId,
    setSelectedDrawingId,
    isDrawing,
    tempDrawing,
    createDrawing,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    handleChartClick,
    handleChartMouseMove,
    cancelDrawing,
  };
}

// Export types
export { DEFAULT_FIB_LEVELS, DRAWING_COLORS };
export default DrawingTools;
