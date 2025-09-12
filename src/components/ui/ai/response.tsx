import { cn } from '@/lib/utils';
import type { ComponentProps, HTMLAttributes } from 'react';

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Whether the response is streaming/loading
   */
  isStreaming?: boolean;
  /**
   * Whether to show a loading indicator
   */
  showLoader?: boolean;
  /**
   * Custom loading text
   */
  loadingText?: string;
  /**
   * Whether the response has an error state
   */
  hasError?: boolean;
  /**
   * Error message to display
   */
  errorMessage?: string;
};

export const Response = ({
  className,
  children,
  isStreaming = false,
  showLoader = false,
  loadingText = 'Thinking...',
  hasError = false,
  errorMessage = 'Something went wrong. Please try again.',
  ...props
}: ResponseProps) => {
  return (
    <div
      className={cn(
        'grid gap-2',
        'prose prose-sm max-w-none',
        'prose-headings:font-semibold prose-headings:text-foreground',
        'prose-p:text-foreground prose-p:leading-relaxed',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
        'prose-pre:bg-muted prose-pre:border prose-pre:border-border',
        'prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:rounded-r',
        'prose-ul:text-foreground prose-ol:text-foreground',
        'prose-li:text-foreground prose-li:marker:text-muted-foreground',
        'prose-table:text-foreground prose-th:bg-muted prose-th:font-semibold',
        'prose-hr:border-border',
        hasError && 'text-destructive',
        className
      )}
      {...props}
    >
      {hasError ? (
        <div className="flex items-center gap-2 text-destructive">
          <svg
            className="size-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="text-sm">{errorMessage}</span>
        </div>
      ) : showLoader || isStreaming ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">{loadingText}</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export type ResponseContentProps = ComponentProps<'div'>;

export const ResponseContent = ({
  className,
  children,
  ...props
}: ResponseContentProps) => (
  <div
    className={cn(
      'prose prose-sm max-w-none',
      'prose-headings:font-semibold prose-headings:text-foreground',
      'prose-p:text-foreground prose-p:leading-relaxed',
      'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
      'prose-strong:text-foreground prose-strong:font-semibold',
      'prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
      'prose-pre:bg-muted prose-pre:border prose-pre:border-border',
      'prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:rounded-r',
      'prose-ul:text-foreground prose-ol:text-foreground',
      'prose-li:text-foreground prose-li:marker:text-muted-foreground',
      'prose-table:text-foreground prose-th:bg-muted prose-th:font-semibold',
      'prose-hr:border-border',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type ResponseErrorProps = ComponentProps<'div'> & {
  message?: string;
};

export const ResponseError = ({
  className,
  message = 'Something went wrong. Please try again.',
  ...props
}: ResponseErrorProps) => (
  <div
    className={cn(
      'flex items-center gap-2 text-destructive',
      className
    )}
    {...props}
  >
    <svg
      className="size-4 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
    <span className="text-sm">{message}</span>
  </div>
);

export type ResponseLoaderProps = ComponentProps<'div'> & {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const ResponseLoader = ({
  className,
  text = 'Thinking...',
  size = 'md',
  ...props
}: ResponseLoaderProps) => {
  const sizeClasses = {
    sm: 'size-3',
    md: 'size-4',
    lg: 'size-5',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-muted-foreground',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-current border-t-transparent',
          sizeClasses[size]
        )}
      />
      <span className="text-sm">{text}</span>
    </div>
  );
};
