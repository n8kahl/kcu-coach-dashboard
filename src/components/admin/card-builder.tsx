'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
// import { toPng } from 'html-to-image'; // TODO: Install html-to-image
import {
  Upload,
  Image as ImageIcon,
  Type,
  Layout,
  Palette,
  Download,
  Save,
  Trash2,
  Move,
  Plus,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Eye,
  EyeOff,
  Copy,
  Undo,
  Redo,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TextElement {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  align: 'left' | 'center' | 'right';
  maxWidth?: number;
}

interface ImageElement {
  id: string;
  type: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

interface StatElement {
  id: string;
  type: 'stat';
  label: string;
  value: string;
  x: number;
  y: number;
  labelColor: string;
  valueColor: string;
}

type CanvasElement = TextElement | ImageElement | StatElement;

interface CardTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  backgroundImage?: string;
  elements: CanvasElement[];
}

const defaultTemplate: CardTemplate = {
  id: 'default',
  name: 'Default Win Card',
  width: 400,
  height: 500,
  background: 'linear-gradient(135deg, #161616 0%, #1a1a1a 100%)',
  elements: [
    {
      id: 'header',
      type: 'text',
      content: 'KCU TRADING',
      x: 20,
      y: 20,
      fontSize: 14,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#f59e0b',
      align: 'left',
    },
    {
      id: 'title',
      type: 'text',
      content: 'TRADE WIN',
      x: 200,
      y: 200,
      fontSize: 32,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#f59e0b',
      align: 'center',
      maxWidth: 360,
    },
    {
      id: 'stat1',
      type: 'stat',
      label: 'P&L',
      value: '+$423.50',
      x: 40,
      y: 280,
      labelColor: '#737373',
      valueColor: '#22c55e',
    },
    {
      id: 'stat2',
      type: 'stat',
      label: 'RETURN',
      value: '+12.3%',
      x: 220,
      y: 280,
      labelColor: '#737373',
      valueColor: '#22c55e',
    },
  ],
};

export function CardBuilder() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<CardTemplate>(defaultTemplate);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<CardTemplate[]>([defaultTemplate]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const selectedElement = template.elements.find((el) => el.id === selectedElementId);

  // Save to history
  const saveToHistory = useCallback((newTemplate: CardTemplate) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newTemplate);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setTemplate(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setTemplate(history[historyIndex + 1]);
    }
  };

  // Update element
  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    const newTemplate: CardTemplate = {
      ...template,
      elements: template.elements.map((el) =>
        el.id === id ? { ...el, ...updates } as CanvasElement : el
      ),
    };
    setTemplate(newTemplate);
    saveToHistory(newTemplate);
  };

  // Add element
  const addElement = (type: 'text' | 'image' | 'stat') => {
    const id = `${type}-${Date.now()}`;
    let newElement: CanvasElement;

    switch (type) {
      case 'text':
        newElement = {
          id,
          type: 'text',
          content: 'New Text',
          x: template.width / 2,
          y: template.height / 2,
          fontSize: 16,
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#f5f5f5',
          align: 'center',
        };
        break;
      case 'stat':
        newElement = {
          id,
          type: 'stat',
          label: 'LABEL',
          value: 'VALUE',
          x: template.width / 2,
          y: template.height / 2,
          labelColor: '#737373',
          valueColor: '#f5f5f5',
        };
        break;
      case 'image':
        fileInputRef.current?.click();
        return;
      default:
        return;
    }

    const newTemplate = {
      ...template,
      elements: [...template.elements, newElement],
    };
    setTemplate(newTemplate);
    saveToHistory(newTemplate);
    setSelectedElementId(id);
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const id = `image-${Date.now()}`;
      const newElement: ImageElement = {
        id,
        type: 'image',
        src,
        x: template.width / 2 - 50,
        y: template.height / 2 - 50,
        width: 100,
        height: 100,
        opacity: 1,
      };

      const newTemplate = {
        ...template,
        elements: [...template.elements, newElement],
      };
      setTemplate(newTemplate);
      saveToHistory(newTemplate);
      setSelectedElementId(id);
    };
    reader.readAsDataURL(file);
  };

  // Delete element
  const deleteElement = (id: string) => {
    const newTemplate = {
      ...template,
      elements: template.elements.filter((el) => el.id !== id),
    };
    setTemplate(newTemplate);
    saveToHistory(newTemplate);
    setSelectedElementId(null);
  };

  // Duplicate element
  const duplicateElement = (id: string) => {
    const element = template.elements.find((el) => el.id === id);
    if (!element) return;

    const newElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      x: element.x + 20,
      y: element.y + 20,
    };

    const newTemplate = {
      ...template,
      elements: [...template.elements, newElement],
    };
    setTemplate(newTemplate);
    saveToHistory(newTemplate);
    setSelectedElementId(newElement.id);
  };

  // Move element in layer order
  const moveElement = (id: string, direction: 'up' | 'down') => {
    const index = template.elements.findIndex((el) => el.id === id);
    if (index === -1) return;

    const newElements = [...template.elements];
    const newIndex = direction === 'up' ? index + 1 : index - 1;

    if (newIndex < 0 || newIndex >= newElements.length) return;

    [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];

    const newTemplate = { ...template, elements: newElements };
    setTemplate(newTemplate);
    saveToHistory(newTemplate);
  };

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    setIsDragging(true);

    const element = template.elements.find((el) => el.id === elementId);
    if (!element) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setDragOffset({
      x: e.clientX - canvasRect.left - element.x * zoom,
      y: e.clientY - canvasRect.top - element.y * zoom,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - dragOffset.x) / zoom;
    const y = (e.clientY - canvasRect.top - dragOffset.y) / zoom;

    updateElement(selectedElementId, { x: Math.round(x), y: Math.round(y) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Export as PNG
  const exportAsPng = async () => {
    if (!canvasRef.current) return;

    try {
      // TODO: Implement with html-to-image when installed
      console.log('Export functionality requires html-to-image package');
      alert('Export functionality coming soon!');
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Left Panel - Tools */}
      <div className="w-64 space-y-4 overflow-y-auto">
        {/* Add Elements */}
        <Card>
          <CardHeader title="Add Elements" />
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addElement('text')}
                className="p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-colors flex flex-col items-center gap-1"
              >
                <Type className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">Text</span>
              </button>
              <button
                onClick={() => addElement('image')}
                className="p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-colors flex flex-col items-center gap-1"
              >
                <ImageIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">Image</span>
              </button>
              <button
                onClick={() => addElement('stat')}
                className="p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-colors flex flex-col items-center gap-1"
              >
                <Layout className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">Stat</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Layers */}
        <Card>
          <CardHeader
            title="Layers"
            action={
              <Badge variant="default" size="sm">{template.elements.length}</Badge>
            }
          />
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {template.elements.slice().reverse().map((element) => (
                <div
                  key={element.id}
                  onClick={() => setSelectedElementId(element.id)}
                  className={cn(
                    'flex items-center gap-2 p-2 cursor-pointer transition-colors',
                    selectedElementId === element.id
                      ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  )}
                >
                  {element.type === 'text' && <Type className="w-4 h-4" />}
                  {element.type === 'image' && <ImageIcon className="w-4 h-4" />}
                  {element.type === 'stat' && <Layout className="w-4 h-4" />}
                  <span className="text-xs truncate flex-1">
                    {element.type === 'text'
                      ? (element as TextElement).content.slice(0, 20)
                      : element.type === 'stat'
                      ? (element as StatElement).label
                      : 'Image'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Canvas Settings */}
        <Card>
          <CardHeader title="Canvas" />
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">Grid</span>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn(
                    'p-1.5',
                    showGrid ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                  )}
                >
                  {showGrid ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">Zoom</span>
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xs text-[var(--text-primary)] w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Save className="w-4 h-4" />}>
              Save Template
            </Button>
            <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportAsPng}>
              Export PNG
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          className="flex-1 overflow-auto bg-[var(--bg-tertiary)] flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: template.width,
              height: template.height,
              background: template.background,
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              border: '2px solid var(--accent-primary)',
            }}
            onClick={() => setSelectedElementId(null)}
          >
            {/* Grid overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(245,158,11,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.1) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            )}

            {/* Elements */}
            {template.elements.map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={selectedElementId === element.id}
                onMouseDown={(e) => handleMouseDown(e, element.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-72 overflow-y-auto">
        {selectedElement ? (
          <ElementProperties
            element={selectedElement}
            onUpdate={(updates) => updateElement(selectedElement.id, updates)}
            onDelete={() => deleteElement(selectedElement.id)}
            onDuplicate={() => duplicateElement(selectedElement.id)}
            onMoveUp={() => moveElement(selectedElement.id, 'up')}
            onMoveDown={() => moveElement(selectedElement.id, 'down')}
          />
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Layers className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-tertiary)]">
                Select an element to edit its properties
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Canvas Element Renderer
interface CanvasElementProps {
  element: CanvasElement;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

function CanvasElement({ element, isSelected, onMouseDown }: CanvasElementProps) {
  const baseStyles = {
    position: 'absolute' as const,
    left: element.x,
    top: element.y,
    cursor: 'move',
    outline: isSelected ? '2px solid var(--accent-primary)' : 'none',
    outlineOffset: '2px',
  };

  if (element.type === 'text') {
    const textElement = element as TextElement;
    return (
      <div
        style={{
          ...baseStyles,
          fontSize: textElement.fontSize,
          fontWeight: textElement.fontWeight,
          fontStyle: textElement.fontStyle,
          color: textElement.color,
          textAlign: textElement.align,
          maxWidth: textElement.maxWidth,
          transform: 'translate(-50%, -50%)',
        }}
        onMouseDown={onMouseDown}
      >
        {textElement.content}
      </div>
    );
  }

  if (element.type === 'image') {
    const imageElement = element as ImageElement;
    return (
      <img
        src={imageElement.src}
        alt=""
        style={{
          ...baseStyles,
          width: imageElement.width,
          height: imageElement.height,
          opacity: imageElement.opacity,
          objectFit: 'cover',
        }}
        onMouseDown={onMouseDown}
        draggable={false}
      />
    );
  }

  if (element.type === 'stat') {
    const statElement = element as StatElement;
    return (
      <div
        style={{
          ...baseStyles,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
        onMouseDown={onMouseDown}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: statElement.labelColor,
          }}
        >
          {statElement.label}
        </span>
        <span
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: statElement.valueColor,
          }}
        >
          {statElement.value}
        </span>
      </div>
    );
  }

  return null;
}

// Element Properties Panel
interface ElementPropertiesProps {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ElementProperties({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: ElementPropertiesProps) {
  return (
    <Card>
      <CardHeader
        title={element.type.charAt(0).toUpperCase() + element.type.slice(1)}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--error)]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        }
      />
      <CardContent>
        <div className="space-y-4">
          {/* Position */}
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">Position</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="X"
                type="number"
                value={element.x}
                onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Y"
                type="number"
                value={element.y}
                onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Text Properties */}
          {element.type === 'text' && (
            <>
              <div>
                <Textarea
                  label="Content"
                  value={(element as TextElement).content}
                  onChange={(e) => onUpdate({ content: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Font Size"
                  type="number"
                  value={(element as TextElement).fontSize}
                  onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 16 })}
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">Color</p>
                  <input
                    type="color"
                    value={(element as TextElement).color}
                    onChange={(e) => onUpdate({ color: e.target.value })}
                    className="w-full h-10 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">Style</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdate({ fontWeight: (element as TextElement).fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={cn(
                      'p-2',
                      (element as TextElement).fontWeight === 'bold'
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    )}
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ fontStyle: (element as TextElement).fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={cn(
                      'p-2',
                      (element as TextElement).fontStyle === 'italic'
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    )}
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ align: 'left' })}
                    className={cn(
                      'p-2',
                      (element as TextElement).align === 'left'
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    )}
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ align: 'center' })}
                    className={cn(
                      'p-2',
                      (element as TextElement).align === 'center'
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    )}
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ align: 'right' })}
                    className={cn(
                      'p-2',
                      (element as TextElement).align === 'right'
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    )}
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Image Properties */}
          {element.type === 'image' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Width"
                  type="number"
                  value={(element as ImageElement).width}
                  onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 100 })}
                />
                <Input
                  label="Height"
                  type="number"
                  value={(element as ImageElement).height}
                  onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">
                  Opacity: {Math.round((element as ImageElement).opacity * 100)}%
                </p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={(element as ImageElement).opacity}
                  onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Stat Properties */}
          {element.type === 'stat' && (
            <>
              <Input
                label="Label"
                value={(element as StatElement).label}
                onChange={(e) => onUpdate({ label: e.target.value })}
              />
              <Input
                label="Value"
                value={(element as StatElement).value}
                onChange={(e) => onUpdate({ value: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">Label Color</p>
                  <input
                    type="color"
                    value={(element as StatElement).labelColor}
                    onChange={(e) => onUpdate({ labelColor: e.target.value })}
                    className="w-full h-10 bg-transparent cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">Value Color</p>
                  <input
                    type="color"
                    value={(element as StatElement).valueColor}
                    onChange={(e) => onUpdate({ valueColor: e.target.value })}
                    className="w-full h-10 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
