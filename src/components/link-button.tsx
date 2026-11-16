import { ChevronRightIcon, ExternalLinkIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * No text links anywhere, only buttons (Roshan, 16-11-2026: text links "look very unprofessional"). Every way to another
 * page, a feature or another site, and every fold-out, is the outlined button: at least 44 px high, an icon before its
 * words, as wide as its words unless the caller widens it (`w-full` for a page's main way on). The element stays what it
 * was: a link stays a link and a summary a summary, so roles and names don't change.
 */
export function linkButtonClass(className?: string): string {
  return cn(buttonVariants({ variant: 'outline' }), 'w-fit max-w-full', className);
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  /** What it opens; decoration only, the words name it. */
  icon: LucideIcon;
  /** `rtl:rotate-180` for an icon that points along the reading direction (back, previous, next). */
  iconClassName?: string;
};

/** A way to another page of the app, in the button look. */
export function LinkButton({ icon: Icon, iconClassName, className, children, ...props }: LinkButtonProps) {
  return (
    <Link {...props} className={linkButtonClass(className)}>
      <Icon aria-hidden="true" className={iconClassName} />
      {children}
    </Link>
  );
}

/** A way to another site, opened in a new tab, in the button look. `rel` stays overridable for the app's own pages. */
export function ExternalLinkButton({
  className,
  children,
  rel = 'noopener noreferrer',
  ...props
}: Omit<ComponentProps<'a'>, 'target'>) {
  return (
    <a {...props} target="_blank" rel={rel} className={linkButtonClass(className)}>
      <ExternalLinkIcon aria-hidden="true" />
      {children}
    </a>
  );
}

/**
 * A fold-out's summary in the button look, without the browser's marker. Its chevron points along the reading direction
 * and turns down once its own `<details>` opens: the selector names the summary's parent, so a fold-out inside an open
 * one keeps its chevron until it opens itself.
 */
export function FoldSummary({ className, children, ...props }: ComponentProps<'summary'>) {
  return (
    <summary
      {...props}
      className={linkButtonClass(cn('cursor-pointer list-none [&::-webkit-details-marker]:hidden', className))}
    >
      <ChevronRightIcon
        aria-hidden="true"
        className="transition-transform rtl:-scale-x-100 [details[open]>summary>&]:rotate-90 rtl:[details[open]>summary>&]:-rotate-90"
      />
      {children}
    </summary>
  );
}
