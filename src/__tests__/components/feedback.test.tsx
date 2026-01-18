/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock matchMedia for reduced motion detection
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});
import {
  LoadingState,
  ErrorState,
  SuccessState,
  InlineLoader,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonStats,
  // Premium skeleton presets
  SkeletonChart,
  SkeletonTradeRow,
  SkeletonLeaderboard,
  SkeletonAchievement,
  SkeletonLessonCard,
  SkeletonWatchlist,
  SkeletonDashboard,
} from '@/components/ui/feedback';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => {
  const React = require('react');

  // Filter out framer-motion specific props
  const filterMotionProps = (props: Record<string, unknown>) => {
    const motionProps = [
      'animate', 'initial', 'exit', 'transition', 'variants',
      'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
      'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
      'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
    ];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (!motionProps.includes(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  };

  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...filterMotionProps(props)}>{children}</div>
      )),
      p: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLParagraphElement>) => (
        <p ref={ref} {...filterMotionProps(props)}>{children}</p>
      )),
      h3: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLHeadingElement>) => (
        <h3 ref={ref} {...filterMotionProps(props)}>{children}</h3>
      )),
      span: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLSpanElement>) => (
        <span ref={ref} {...filterMotionProps(props)}>{children}</span>
      )),
      button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
        <button ref={ref} {...filterMotionProps(props)}>{children}</button>
      )),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useMotionValue: () => ({ set: jest.fn() }),
    useSpring: (value: unknown) => value,
    useTransform: () => 0,
  };
});

describe('LoadingState', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<LoadingState />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading content')).toBeInTheDocument();
    });

    it('renders with custom text', () => {
      render(<LoadingState text="Loading your data..." />);
      // Text appears in both visible and sr-only elements
      expect(screen.getAllByText('Loading your data...')[0]).toBeInTheDocument();
    });

    it('renders with custom aria-label', () => {
      render(<LoadingState aria-label="Fetching trades" />);
      expect(screen.getByLabelText('Fetching trades')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders spinner variant by default', () => {
      const { container } = render(<LoadingState variant="spinner" />);
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders dots variant', () => {
      render(<LoadingState variant="dots" />);
      // Dots variant should render 3 animated dots
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('renders pulse variant', () => {
      render(<LoadingState variant="pulse" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders skeleton variant', () => {
      const { container } = render(<LoadingState variant="skeleton" />);
      expect(container.querySelectorAll('.skeleton')).toHaveLength(3);
    });
  });

  describe('sizes', () => {
    it.each(['sm', 'md', 'lg', 'xl'] as const)('renders %s size', (size) => {
      render(<LoadingState size={size} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('fullPage mode', () => {
    it('adds min-height class when fullPage is true', () => {
      const { container } = render(<LoadingState fullPage />);
      expect(container.firstChild).toHaveClass('min-h-[50vh]');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<LoadingState text="Loading" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-busy', 'true');
    });

    it('includes screen reader only text', () => {
      render(<LoadingState text="Loading data" />);
      expect(screen.getByText('Loading data', { selector: '.sr-only' })).toBeInTheDocument();
    });
  });
});

describe('ErrorState', () => {
  describe('rendering', () => {
    it('renders with message only', () => {
      render(<ErrorState message="Something went wrong" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders with title and message', () => {
      render(
        <ErrorState
          title="Connection Error"
          message="Unable to connect to server"
        />
      );
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to server')).toBeInTheDocument();
    });
  });

  describe('severity variants', () => {
    it.each(['error', 'warning', 'info'] as const)('renders %s severity', (severity) => {
      render(<ErrorState message="Test message" severity={severity} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('retry functionality', () => {
    it('renders retry button when onRetry is provided', () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Failed" onRetry={onRetry} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls onRetry when button is clicked', () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Failed" onRetry={onRetry} />);
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders custom retry text', () => {
      render(
        <ErrorState
          message="Failed"
          onRetry={() => {}}
          retryText="Reload Page"
        />
      );
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });

    it('shows loading state when retrying', () => {
      render(
        <ErrorState
          message="Failed"
          onRetry={() => {}}
          isRetrying={true}
        />
      );
      // When loading, button shows spinner without text, so we just check it's disabled
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Check spinner is present (now using border-t-transparent class on the spinner span)
      expect(button.querySelector('.border-t-transparent')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders inline error in compact mode', () => {
      const { container } = render(
        <ErrorState message="Invalid input" compact />
      );
      expect(container.firstChild).toHaveClass('flex', 'items-center');
    });
  });

  describe('custom action', () => {
    it('renders custom action component', () => {
      render(
        <ErrorState
          message="Failed"
          action={<button>Custom Action</button>}
        />
      );
      expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<ErrorState message="Error occurred" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });
});

describe('SuccessState', () => {
  it('renders with message', () => {
    render(<SuccessState message="Operation completed successfully" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('renders with title and message', () => {
    render(
      <SuccessState
        title="Trade Saved!"
        message="Your trade has been recorded."
      />
    );
    expect(screen.getByText('Trade Saved!')).toBeInTheDocument();
    expect(screen.getByText('Your trade has been recorded.')).toBeInTheDocument();
  });

  it('renders custom action', () => {
    render(
      <SuccessState
        message="Done"
        action={<button>Continue</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<SuccessState message="Success" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('InlineLoader', () => {
  it('renders with default props', () => {
    const { container } = render(<InlineLoader />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it.each(['xs', 'sm', 'md'] as const)('renders %s size', (size) => {
    const { container } = render(<InlineLoader size={size} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it.each(['default', 'gold', 'white'] as const)('renders %s color', (color) => {
    const { container } = render(<InlineLoader color={color} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is hidden from screen readers', () => {
    const { container } = render(<InlineLoader />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Skeleton', () => {
  describe('variants', () => {
    it('renders rectangular variant by default', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('skeleton');
    });

    it('renders text variant with lines', () => {
      const { container } = render(<Skeleton variant="text" lines={3} />);
      expect(container.querySelectorAll('.skeleton')).toHaveLength(3);
    });

    it('renders circular variant', () => {
      const { container } = render(<Skeleton variant="circular" />);
      expect(container.firstChild).toHaveClass('rounded-full');
    });
  });

  describe('dimensions', () => {
    it('applies width as number', () => {
      const { container } = render(<Skeleton width={100} />);
      expect(container.firstChild).toHaveStyle({ width: '100px' });
    });

    it('applies width as string', () => {
      const { container } = render(<Skeleton width="50%" />);
      expect(container.firstChild).toHaveStyle({ width: '50%' });
    });

    it('applies height', () => {
      const { container } = render(<Skeleton height={50} />);
      expect(container.firstChild).toHaveStyle({ height: '50px' });
    });
  });

  it('is hidden from screen readers', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Skeleton Presets', () => {
  describe('SkeletonCard', () => {
    it('renders card skeleton structure', () => {
      const { container } = render(<SkeletonCard />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonCard className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('SkeletonTable', () => {
    it('renders correct number of rows', () => {
      const { container } = render(<SkeletonTable rows={3} columns={4} />);
      // 1 header + 3 data rows
      const rows = container.querySelectorAll('.flex.gap-4');
      expect(rows.length).toBe(4);
    });

    it('uses default values', () => {
      const { container } = render(<SkeletonTable />);
      // Default: 5 rows + 1 header = 6 total
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('SkeletonStats', () => {
    it('renders correct number of stat cards', () => {
      const { container } = render(<SkeletonStats count={6} />);
      const statCards = container.querySelectorAll('.p-4.border');
      expect(statCards).toHaveLength(6);
    });

    it('uses default count of 4', () => {
      const { container } = render(<SkeletonStats />);
      const statCards = container.querySelectorAll('.p-4.border');
      expect(statCards).toHaveLength(4);
    });
  });
});

describe('Integration', () => {
  it('LoadingState and ErrorState can be conditionally rendered', () => {
    const TestComponent = ({ isLoading, error }: { isLoading: boolean; error?: string }) => {
      if (isLoading) return <LoadingState text="Loading data" />;
      if (error) return <ErrorState message={error} />;
      return <div>Content</div>;
    };

    const { rerender } = render(<TestComponent isLoading={true} />);
    // Use getAllByText since text appears in both visible element and sr-only
    expect(screen.getAllByText('Loading data')[0]).toBeInTheDocument();

    rerender(<TestComponent isLoading={false} error="Failed to load" />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();

    rerender(<TestComponent isLoading={false} />);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

/* =============================================================================
 * PREMIUM SKELETON PRESETS TESTS
 * Tests for trading-specific skeleton patterns
 * ============================================================================= */

describe('Premium Skeleton Presets', () => {
  describe('SkeletonChart', () => {
    it('renders chart skeleton structure', () => {
      const { container } = render(<SkeletonChart />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('applies custom height', () => {
      const { container } = render(<SkeletonChart height={400} />);
      // Find the chart area container which has the dynamic height
      const chartArea = container.querySelector('.relative.bg-\\[var\\(--bg-elevated\\)\\]');
      expect(chartArea).toHaveStyle({ height: '400px' });
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonChart className="custom-chart" />);
      expect(container.firstChild).toHaveClass('custom-chart');
    });

    it('is hidden from screen readers', () => {
      const { container } = render(<SkeletonChart />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('SkeletonTradeRow', () => {
    it('renders trade row skeleton structure', () => {
      const { container } = render(<SkeletonTradeRow />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonTradeRow className="custom-row" />);
      expect(container.firstChild).toHaveClass('custom-row');
    });

    it('renders circular avatar skeleton', () => {
      const { container } = render(<SkeletonTradeRow />);
      expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    });
  });

  describe('SkeletonLeaderboard', () => {
    it('renders correct number of entries', () => {
      const { container } = render(<SkeletonLeaderboard count={3} />);
      // Each entry has a circular avatar
      const avatars = container.querySelectorAll('.rounded-full');
      expect(avatars.length).toBe(3);
    });

    it('uses default count of 5', () => {
      const { container } = render(<SkeletonLeaderboard />);
      const avatars = container.querySelectorAll('.rounded-full');
      expect(avatars.length).toBe(5);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonLeaderboard className="custom-leaderboard" />);
      expect(container.firstChild).toHaveClass('custom-leaderboard');
    });
  });

  describe('SkeletonAchievement', () => {
    it('renders achievement skeleton structure', () => {
      const { container } = render(<SkeletonAchievement />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonAchievement className="custom-achievement" />);
      expect(container.firstChild).toHaveClass('custom-achievement');
    });
  });

  describe('SkeletonLessonCard', () => {
    it('renders lesson card skeleton structure', () => {
      const { container } = render(<SkeletonLessonCard />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonLessonCard className="custom-lesson" />);
      expect(container.firstChild).toHaveClass('custom-lesson');
    });

    it('includes thumbnail skeleton', () => {
      const { container } = render(<SkeletonLessonCard />);
      // Thumbnail is a 160px height skeleton
      const skeletons = container.querySelectorAll('.skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('SkeletonWatchlist', () => {
    it('renders correct number of items', () => {
      const { container } = render(<SkeletonWatchlist count={6} />);
      // Each item has circular avatar skeleton
      const avatars = container.querySelectorAll('.rounded-full');
      expect(avatars.length).toBe(6);
    });

    it('uses default count of 4', () => {
      const { container } = render(<SkeletonWatchlist />);
      const avatars = container.querySelectorAll('.rounded-full');
      expect(avatars.length).toBe(4);
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonWatchlist className="custom-watchlist" />);
      expect(container.firstChild).toHaveClass('custom-watchlist');
    });
  });

  describe('SkeletonDashboard', () => {
    it('renders full dashboard skeleton structure', () => {
      const { container } = render(<SkeletonDashboard />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
    });

    it('includes stats section', () => {
      const { container } = render(<SkeletonDashboard />);
      // Stats grid has 4 cards
      const statCards = container.querySelectorAll('.grid-cols-2.md\\:grid-cols-4 > .p-4');
      expect(statCards.length).toBe(4);
    });

    it('includes chart section', () => {
      const { container } = render(<SkeletonDashboard />);
      // Chart has bg-elevated area
      expect(container.querySelector('.bg-\\[var\\(--bg-elevated\\)\\]')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<SkeletonDashboard className="custom-dashboard" />);
      expect(container.firstChild).toHaveClass('custom-dashboard');
    });

    it('is hidden from screen readers', () => {
      const { container } = render(<SkeletonDashboard />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
