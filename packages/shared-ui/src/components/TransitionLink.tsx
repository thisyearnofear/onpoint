'use client';

import React from 'react';
import Link from 'next/link';
import type { FashionItem } from '@onpoint/shared-types';

/**
 * TransitionLink Component
 * 
 * Wrapper around Next.js Link that enables View Transitions API
 * for smooth, coordinated animations between pages.
 * 
 * Works in conjunction with TransitionDetail component to morph
 * elements from list/card views to detail views.
 * 
 * @example
 * ```tsx
 * <TransitionLink href={`/item/${item.slug}`} item={item}>
 *   <FashionItemCard item={item} />
 * </TransitionLink>
 * ```
 */

interface TransitionLinkProps {
  href: string;
  item: FashionItem;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export const TransitionLink = React.forwardRef<
  HTMLAnchorElement,
  TransitionLinkProps
>(({ href, item, children, className, onClick }, ref) => {
  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      onClick={onClick}
      // Store item data in data attributes for transition context
      data-transition-item-id={item.id}
      data-transition-item-slug={item.slug}
    >
      {children}
    </Link>
  );
});

TransitionLink.displayName = 'TransitionLink';

export default TransitionLink;
