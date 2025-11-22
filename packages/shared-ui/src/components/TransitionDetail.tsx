'use client';

import React from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { getTransitionName } from '@onpoint/shared-types';

/**
 * TransitionDetail Component
 * 
 * Renders detail view content with View Transitions API metadata.
 * Elements are coordinated with TransitionLink via matching transition:name attributes.
 * 
 * The View Transitions API will:
 * 1. Capture the starting state from the list view
 * 2. Morph elements smoothly as the page transitions
 * 3. Reveal the detail view with smooth animations
 * 
 * @example
 * ```tsx
 * <TransitionDetail item={item}>
 *   <TransitionDetail.Image />
 *   <TransitionDetail.Title />
 *   <TransitionDetail.Description />
 *   <TransitionDetail.Price />
 * </TransitionDetail>
 * ```
 */

interface TransitionDetailProps {
  item: FashionItem;
  children: React.ReactNode;
  className?: string;
}

interface ImageProps {
  alt?: string;
  className?: string;
  priority?: boolean;
}

interface TitleProps {
  className?: string;
}

interface DescriptionProps {
  className?: string;
}

interface PriceProps {
  className?: string;
  showCurrency?: boolean;
}

/**
 * Main TransitionDetail container
 */
const TransitionDetailRoot: React.FC<TransitionDetailProps> = ({
  item,
  children,
  className = '',
}) => {
  return (
    <div className={className} data-transition-item-id={item.id}>
      {children}
    </div>
  );
};

/**
 * Image with transition metadata
 */
const Image: React.FC<ImageProps & { item: FashionItem }> = ({
  item,
  alt,
  className = '',
  priority = true,
}) => {
  const transitionName = getTransitionName(item.id, 'image');

  return (
    <img
      src={item.cover}
      alt={alt || item.name}
      className={className}
      style={{
        viewTransitionName: transitionName,
        contain: 'layout style paint',
      } as React.CSSProperties}
      {...(priority && { loading: 'eager' })}
    />
  );
};

/**
 * Title with transition metadata
 */
const Title: React.FC<TitleProps & { item: FashionItem }> = ({
  item,
  className = '',
}) => {
  const transitionName = getTransitionName(item.id, 'title');

  return (
    <h1
      className={className}
      style={{
        viewTransitionName: transitionName,
        contain: 'layout style paint',
      } as React.CSSProperties}
    >
      {item.name}
    </h1>
  );
};

/**
 * Description with transition metadata
 */
const Description: React.FC<DescriptionProps & { item: FashionItem }> = ({
  item,
  className = '',
}) => {
  const transitionName = getTransitionName(item.id, 'description');

  return (
    <p
      className={className}
      style={{
        viewTransitionName: transitionName,
        contain: 'layout style paint',
      } as React.CSSProperties}
    >
      {item.description}
    </p>
  );
};

/**
 * Price with transition metadata
 */
const Price: React.FC<PriceProps & { item: FashionItem }> = ({
  item,
  className = '',
  showCurrency = true,
}) => {
  const transitionName = getTransitionName(item.id, 'price');
  const price = showCurrency ? `$${item.price}` : `${item.price}`;

  return (
    <div
      className={className}
      style={{
        viewTransitionName: transitionName,
        contain: 'layout style paint',
      } as React.CSSProperties}
    >
      {price}
    </div>
  );
};

/**
 * Compound component pattern - enables flexible composition
 */
export const TransitionDetail = Object.assign(TransitionDetailRoot, {
  Image: ({ item, ...props }: ImageProps & { item: FashionItem }) =>
    <Image item={item} {...props} />,
  Title: ({ item, ...props }: TitleProps & { item: FashionItem }) =>
    <Title item={item} {...props} />,
  Description: ({ item, ...props }: DescriptionProps & { item: FashionItem }) =>
    <Description item={item} {...props} />,
  Price: ({ item, ...props }: PriceProps & { item: FashionItem }) =>
    <Price item={item} {...props} />,
});

export default TransitionDetail;
