/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Glow,
  Spotlight,
  Shine,
  GradientBorder,
  PulseIndicator,
  AnimatedCounter,
  ValueChange,
} from '@/components/ui/effects';

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

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');

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
    useMotionValue: () => ({ set: jest.fn() }),
    useSpring: (value: unknown) => value,
    useTransform: () => 0,
  };
});

describe('Glow', () => {
  it('renders children correctly', () => {
    render(
      <Glow>
        <div data-testid="glow-child">Content</div>
      </Glow>
    );
    expect(screen.getByTestId('glow-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Glow className="custom-glow">
        <div>Content</div>
      </Glow>
    );
    expect(container.firstChild).toHaveClass('custom-glow');
  });

  it.each(['gold', 'profit', 'loss', 'info', 'custom'] as const)(
    'supports %s color variant',
    (color) => {
      const { container } = render(
        <Glow color={color}>
          <div>Content</div>
        </Glow>
      );
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it('supports hover-only mode', () => {
    const { container } = render(
      <Glow hoverOnly>
        <div>Content</div>
      </Glow>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('Spotlight', () => {
  it('renders children correctly', () => {
    render(
      <Spotlight>
        <div data-testid="spotlight-child">Content</div>
      </Spotlight>
    );
    expect(screen.getByTestId('spotlight-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Spotlight className="custom-spotlight">
        <div>Content</div>
      </Spotlight>
    );
    expect(container.firstChild).toHaveClass('custom-spotlight');
  });

  it('applies custom size', () => {
    render(
      <Spotlight size={300}>
        <div data-testid="sized-spotlight">Content</div>
      </Spotlight>
    );
    expect(screen.getByTestId('sized-spotlight')).toBeInTheDocument();
  });
});

describe('Shine', () => {
  it('renders children correctly', () => {
    render(
      <Shine>
        <div data-testid="shine-child">Content</div>
      </Shine>
    );
    expect(screen.getByTestId('shine-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Shine className="custom-shine">
        <div>Content</div>
      </Shine>
    );
    expect(container.firstChild).toHaveClass('custom-shine');
  });

  it('supports custom angle', () => {
    render(
      <Shine angle={90}>
        <div data-testid="angled-shine">Content</div>
      </Shine>
    );
    expect(screen.getByTestId('angled-shine')).toBeInTheDocument();
  });
});

describe('GradientBorder', () => {
  it('renders children correctly', () => {
    render(
      <GradientBorder>
        <div data-testid="gradient-child">Content</div>
      </GradientBorder>
    );
    expect(screen.getByTestId('gradient-child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <GradientBorder className="custom-gradient">
        <div>Content</div>
      </GradientBorder>
    );
    expect(container.firstChild).toHaveClass('custom-gradient');
  });

  it('supports custom border width', () => {
    const { container } = render(
      <GradientBorder borderWidth={4}>
        <div>Content</div>
      </GradientBorder>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('supports custom colors', () => {
    render(
      <GradientBorder colors={['#ff0000', '#00ff00', '#0000ff']}>
        <div data-testid="colored-gradient">Content</div>
      </GradientBorder>
    );
    expect(screen.getByTestId('colored-gradient')).toBeInTheDocument();
  });
});

describe('PulseIndicator', () => {
  it('renders correctly', () => {
    const { container } = render(<PulseIndicator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders %s size', (size) => {
    const { container } = render(<PulseIndicator size={size} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it.each(['green', 'red', 'gold', 'blue'] as const)(
    'renders %s color',
    (color) => {
      const { container } = render(<PulseIndicator color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it('can disable animation', () => {
    const { container } = render(<PulseIndicator animate={false} />);
    // When not animated, there should be no ping element
    expect(container.querySelectorAll('.animate-ping').length).toBe(0);
  });

  it('shows animation when enabled', () => {
    const { container } = render(<PulseIndicator animate={true} />);
    expect(container.querySelector('.animate-ping')).toBeInTheDocument();
  });
});

describe('AnimatedCounter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the value', () => {
    render(<AnimatedCounter value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnimatedCounter value={50} className="custom-counter" />
    );
    expect(container.firstChild).toHaveClass('custom-counter');
  });

  it('uses custom format function', () => {
    render(
      <AnimatedCounter
        value={1234.5}
        format={(v) => `$${v.toFixed(2)}`}
      />
    );
    expect(screen.getByText('$1234.50')).toBeInTheDocument();
  });

  it('supports prefix and suffix', () => {
    render(<AnimatedCounter value={50} prefix="$" suffix="%" />);
    expect(screen.getByText('$50%')).toBeInTheDocument();
  });

  it('supports decimal places', () => {
    render(<AnimatedCounter value={123.456} decimals={2} />);
    expect(screen.getByText('123.46')).toBeInTheDocument();
  });
});

describe('ValueChange', () => {
  it('renders positive change correctly', () => {
    render(<ValueChange value={150} previousValue={100} />);
    expect(screen.getByText(/\+50\.00/)).toBeInTheDocument();
  });

  it('renders negative change correctly', () => {
    render(<ValueChange value={50} previousValue={100} />);
    expect(screen.getByText(/-50\.00/)).toBeInTheDocument();
  });

  it('applies correct color for profit', () => {
    const { container } = render(
      <ValueChange value={150} previousValue={100} />
    );
    expect(container.firstChild).toHaveClass('text-[var(--profit)]');
  });

  it('applies correct color for loss', () => {
    const { container } = render(
      <ValueChange value={50} previousValue={100} />
    );
    expect(container.firstChild).toHaveClass('text-[var(--loss)]');
  });

  it('shows arrow by default', () => {
    render(<ValueChange value={150} previousValue={100} />);
    expect(screen.getByText('▲')).toBeInTheDocument();
  });

  it('hides arrow when showArrow is false', () => {
    render(
      <ValueChange value={150} previousValue={100} showArrow={false} />
    );
    expect(screen.queryByText('▲')).not.toBeInTheDocument();
  });

  it('shows percentage when showPercent is true', () => {
    render(
      <ValueChange value={150} previousValue={100} showPercent={true} />
    );
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
  });

  it('uses custom format function', () => {
    render(
      <ValueChange
        value={150}
        previousValue={100}
        format={(v) => `$${v.toFixed(0)}`}
      />
    );
    expect(screen.getByText(/\$50/)).toBeInTheDocument();
  });
});
