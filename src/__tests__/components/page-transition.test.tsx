/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  PageTransition,
  FadeIn,
  StaggerChildren,
  StaggerItem,
  ScaleIn,
  AnimatedNumber,
  PulseOnChange,
} from '@/components/layout/page-transition';

// Mock next/navigation
const mockPathname = jest.fn(() => '/test');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

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
      span: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLSpanElement>) => (
        <span ref={ref} {...filterMotionProps(props)}>{children}</span>
      )),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

// Mock matchMedia for reduced motion detection
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('PageTransition', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    mockPathname.mockReturnValue('/test');
  });

  it('renders children correctly', () => {
    render(
      <PageTransition>
        <div data-testid="child">Test Content</div>
      </PageTransition>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageTransition className="custom-class">
        <div>Content</div>
      </PageTransition>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders without animation when disabled', () => {
    const { container } = render(
      <PageTransition disabled>
        <div>Content</div>
      </PageTransition>
    );
    // When disabled, it renders a plain div instead of motion.div
    expect(container.firstChild?.nodeName).toBe('DIV');
  });
});

describe('FadeIn', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('renders children correctly', () => {
    render(
      <FadeIn>
        <div data-testid="fade-child">Fade Content</div>
      </FadeIn>
    );
    expect(screen.getByTestId('fade-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FadeIn className="fade-custom">
        <div>Content</div>
      </FadeIn>
    );
    expect(container.firstChild).toHaveClass('fade-custom');
  });

  it('supports different directions', () => {
    const directions = ['up', 'down', 'left', 'right', 'none'] as const;
    directions.forEach(direction => {
      const { container, unmount } = render(
        <FadeIn direction={direction}>
          <div>Content</div>
        </FadeIn>
      );
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    });
  });
});

describe('StaggerChildren and StaggerItem', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('renders children in StaggerChildren', () => {
    render(
      <StaggerChildren>
        <StaggerItem>Item 1</StaggerItem>
        <StaggerItem>Item 2</StaggerItem>
        <StaggerItem>Item 3</StaggerItem>
      </StaggerChildren>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('applies className to StaggerChildren', () => {
    const { container } = render(
      <StaggerChildren className="stagger-container">
        <StaggerItem>Item</StaggerItem>
      </StaggerChildren>
    );
    expect(container.firstChild).toHaveClass('stagger-container');
  });

  it('applies className to StaggerItem', () => {
    render(
      <StaggerChildren>
        <StaggerItem className="stagger-item-class">
          <span data-testid="item">Item</span>
        </StaggerItem>
      </StaggerChildren>
    );
    const item = screen.getByTestId('item').parentElement;
    expect(item).toHaveClass('stagger-item-class');
  });
});

describe('ScaleIn', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('renders children correctly', () => {
    render(
      <ScaleIn>
        <div data-testid="scale-child">Scale Content</div>
      </ScaleIn>
    );
    expect(screen.getByTestId('scale-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ScaleIn className="scale-custom">
        <div>Content</div>
      </ScaleIn>
    );
    expect(container.firstChild).toHaveClass('scale-custom');
  });

  it('renders with spring animation prop', () => {
    render(
      <ScaleIn spring>
        <div data-testid="spring-child">Spring Content</div>
      </ScaleIn>
    );
    expect(screen.getByTestId('spring-child')).toBeInTheDocument();
  });
});

describe('AnimatedNumber', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the initial value', () => {
    render(<AnimatedNumber value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnimatedNumber value={50} className="number-custom" />
    );
    expect(container.firstChild).toHaveClass('number-custom');
  });

  it('uses custom format function', () => {
    render(
      <AnimatedNumber
        value={1234.567}
        format={(v) => `$${v.toFixed(2)}`}
      />
    );
    expect(screen.getByText('$1234.57')).toBeInTheDocument();
  });

  it('respects reduced motion preference', () => {
    mockMatchMedia(true);
    render(<AnimatedNumber value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('PulseOnChange', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders children correctly', () => {
    render(
      <PulseOnChange triggerKey="key1">
        <div data-testid="pulse-child">Pulse Content</div>
      </PulseOnChange>
    );
    expect(screen.getByTestId('pulse-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PulseOnChange triggerKey="key1" className="pulse-custom">
        <div>Content</div>
      </PulseOnChange>
    );
    expect(container.firstChild).toHaveClass('pulse-custom');
  });

  it('supports different color variants', () => {
    const colors = ['gold', 'profit', 'loss', 'default'] as const;
    colors.forEach(color => {
      const { unmount } = render(
        <PulseOnChange triggerKey="key" color={color}>
          <div>Content</div>
        </PulseOnChange>
      );
      unmount();
    });
  });
});

describe('Reduced Motion Support', () => {
  it('respects prefers-reduced-motion for PageTransition', () => {
    mockMatchMedia(true);
    render(
      <PageTransition>
        <div data-testid="reduced-motion">Content</div>
      </PageTransition>
    );
    expect(screen.getByTestId('reduced-motion')).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion for FadeIn', () => {
    mockMatchMedia(true);
    render(
      <FadeIn>
        <div data-testid="reduced-fade">Content</div>
      </FadeIn>
    );
    expect(screen.getByTestId('reduced-fade')).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion for ScaleIn', () => {
    mockMatchMedia(true);
    render(
      <ScaleIn>
        <div data-testid="reduced-scale">Content</div>
      </ScaleIn>
    );
    expect(screen.getByTestId('reduced-scale')).toBeInTheDocument();
  });
});
