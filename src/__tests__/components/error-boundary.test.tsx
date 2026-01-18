import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, InlineError, AsyncErrorFallback } from '@/components/error-boundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should have refresh and home buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });
});

describe('InlineError', () => {
  it('should render error message', () => {
    render(<InlineError message="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    render(<InlineError message="Error" onRetry={onRetry} />);

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<InlineError message="Error" onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should not render retry button when onRetry not provided', () => {
    render(<InlineError message="Error" />);

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});

describe('AsyncErrorFallback', () => {
  it('should render error message', () => {
    const error = new Error('Async error occurred');
    render(
      <AsyncErrorFallback error={error} resetErrorBoundary={jest.fn()} />
    );

    expect(screen.getByText('Async error occurred')).toBeInTheDocument();
  });

  it('should render try again button', () => {
    render(
      <AsyncErrorFallback
        error={new Error('Error')}
        resetErrorBoundary={jest.fn()}
      />
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should call resetErrorBoundary when try again clicked', () => {
    const resetFn = jest.fn();
    render(
      <AsyncErrorFallback error={new Error('Error')} resetErrorBoundary={resetFn} />
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(resetFn).toHaveBeenCalled();
  });
});
