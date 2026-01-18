'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="w-full overflow-x-auto">
        <table
          ref={ref}
          className={cn('w-full border-collapse', className)}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <thead ref={ref} className={cn('', className)} {...props}>
        {children}
      </thead>
    );
  }
);

TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <tbody ref={ref} className={cn('', className)} {...props}>
        {children}
      </tbody>
    );
  }
);

TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
  selected?: boolean;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, hoverable = true, selected = false, children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-[var(--border-primary)]',
          hoverable && 'hover:bg-[var(--bg-card-hover)] transition-colors duration-150',
          selected && 'bg-[var(--accent-primary-glow)]',
          className
        )}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
}

const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable = false, sorted = null, children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'text-left px-4 py-3',
          'text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]',
          'border-b border-[var(--border-primary)]',
          sortable && 'cursor-pointer hover:text-[var(--text-secondary)]',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-1.5">
          {children}
          {sortable && sorted && (
            <span className="text-[var(--accent-primary)]">
              {sorted === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  mono?: boolean;
}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, mono = false, children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn(
          'px-4 py-3 text-sm text-[var(--text-primary)]',
          mono && 'font-mono tabular-nums',
          className
        )}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
