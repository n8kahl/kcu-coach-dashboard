'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useContentStudio,
  type ModuleWithLessons,
  type TreeItem,
} from './ContentStudioContext';
import type { CourseLesson, CourseModule } from '@/types/learning';
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileVideo,
  Edit3,
  Trash2,
  MoreVertical,
  Loader2,
} from 'lucide-react';

// ============================================
// Sortable Tree Item Component
// ============================================

interface SortableTreeItemProps {
  item: TreeItem;
  isSelected: boolean;
  onSelect: () => void;
  onToggleExpand?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  depth?: number;
}

function SortableTreeItem({
  item,
  isSelected,
  onSelect,
  onToggleExpand,
  onEdit,
  onDelete,
  depth = 0,
}: SortableTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isModule = item.type === 'module';
  const moduleData = isModule ? (item.data as ModuleWithLessons) : null;
  const lessonData = !isModule ? (item.data as CourseLesson) : null;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50'
            : 'hover:bg-[var(--bg-tertiary)] border border-transparent',
          isDragging && 'ring-2 ring-[var(--accent-primary)]'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={onSelect}
      >
        <button
          className="p-0.5 cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {isModule && onToggleExpand && (
          <button
            className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {moduleData?.isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        <div
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
            isModule ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'
          )}
        >
          {isModule ? (
            <FolderOpen className="w-3.5 h-3.5" />
          ) : (
            <FileVideo className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {isModule ? moduleData?.title : lessonData?.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">
            {isModule
              ? `${moduleData?.lessons?.length || 0} lessons`
              : lessonData?.lessonNumber}
          </p>
        </div>

        {!isModule && lessonData && (
          <Badge
            variant={lessonData.isPublished ? 'success' : 'default'}
            size="sm"
            className="flex-shrink-0"
          >
            {lessonData.isPublished ? 'Live' : 'Draft'}
          </Badge>
        )}

        {/* Actions Menu Button */}
        <div className="relative">
          <button
            className={cn(
              'p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-opacity',
              showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Actions Dropdown Menu */}
          {showMenu && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] py-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md shadow-lg">
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit?.();
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete?.();
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Course Tree Component
// ============================================

interface CourseTreeProps {
  onEditModule: (module: CourseModule) => void;
  onDeleteModule: (module: ModuleWithLessons) => void;
  onDeleteLesson: (lesson: CourseLesson) => void;
}

export function CourseTree({
  onEditModule,
  onDeleteModule,
  onDeleteLesson,
}: CourseTreeProps) {
  const {
    selectedCourse,
    loading,
    modules,
    treeItems,
    selectedItem,
    setSelectedItem,
    setEditedLesson,
    setModules,
    toggleModuleExpand,
    reorderModules,
    reorderLessons,
    moveLessonToModule,
  } = useContentStudio();

  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle selecting an item
  const handleSelectItem = (item: TreeItem) => {
    setSelectedItem(item);

    if (item.type === 'lesson') {
      setEditedLesson(item.data as CourseLesson);
    } else {
      setEditedLesson(null);
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = treeItems.find((i) => i.id === active.id);
    const overItem = treeItems.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Handle module reordering
    if (activeItem.type === 'module' && overItem.type === 'module') {
      const oldIndex = modules.findIndex((m) => `module-${m.id}` === active.id);
      const newIndex = modules.findIndex((m) => `module-${m.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newModules = arrayMove(modules, oldIndex, newIndex);
        setModules(newModules);
        reorderModules(newModules.map((m) => m.id));
      }
    }

    // Handle lesson reordering
    if (activeItem.type === 'lesson') {
      const activeLesson = activeItem.data as CourseLesson;
      const sourceModuleId = activeLesson.moduleId;

      // Determine target module
      let targetModuleId: string;
      let targetIndex: number;

      if (overItem.type === 'module') {
        // Dropped onto a module - add to end of that module
        targetModuleId = (overItem.data as ModuleWithLessons).id;
        targetIndex = (overItem.data as ModuleWithLessons).lessons?.length || 0;
      } else if (overItem.type === 'lesson') {
        // Dropped onto a lesson - get that lesson's module
        const overLesson = overItem.data as CourseLesson;
        targetModuleId = overLesson.moduleId;

        const targetModule = modules.find((m) => m.id === targetModuleId);
        if (targetModule) {
          targetIndex = targetModule.lessons.findIndex((l) => `lesson-${l.id}` === over.id);
        } else {
          return;
        }
      } else {
        return;
      }

      // Same module reordering
      if (sourceModuleId === targetModuleId) {
        setModules((prev) =>
          prev.map((m) => {
            if (m.id === sourceModuleId) {
              const oldIndex = m.lessons.findIndex((l) => `lesson-${l.id}` === active.id);
              const newIndex = m.lessons.findIndex((l) => `lesson-${l.id}` === over.id);
              if (oldIndex !== -1 && newIndex !== -1) {
                const newLessons = arrayMove(m.lessons, oldIndex, newIndex);
                reorderLessons(m.id, newLessons.map((l) => l.id));
                return { ...m, lessons: newLessons };
              }
            }
            return m;
          })
        );
      } else {
        // Cross-module move
        await moveLessonToModule(activeLesson.id, targetModuleId, targetIndex);
      }
    }
  };

  if (!selectedCourse) {
    return null;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border-primary)]">
        <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
          Course Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={treeItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {treeItems.map((item) => (
                  <SortableTreeItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItem?.id === item.id}
                    onSelect={() => handleSelectItem(item)}
                    onToggleExpand={
                      item.type === 'module'
                        ? () => toggleModuleExpand((item.data as ModuleWithLessons).id)
                        : undefined
                    }
                    onEdit={() => {
                      if (item.type === 'module') {
                        onEditModule(item.data as CourseModule);
                      } else {
                        handleSelectItem(item);
                      }
                    }}
                    onDelete={() => {
                      if (item.type === 'module') {
                        onDeleteModule(item.data as ModuleWithLessons);
                      } else {
                        onDeleteLesson(item.data as CourseLesson);
                      }
                    }}
                    depth={item.parentId ? 1 : 0}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId && (
                <div className="bg-[var(--bg-card)] border border-[var(--accent-primary)] rounded-md px-3 py-2 shadow-lg">
                  {treeItems.find((i) => i.id === activeId)?.type === 'module'
                    ? (treeItems.find((i) => i.id === activeId)?.data as ModuleWithLessons)?.title
                    : (treeItems.find((i) => i.id === activeId)?.data as CourseLesson)?.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
