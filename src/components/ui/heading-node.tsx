import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { type VariantProps, cva } from 'class-variance-authority';
import { PlateElement } from 'platejs/react';

import { RICH_TEXT_HEADING_CLASSES } from '@/lib/rich-text-heading-classes';

const headingVariants = cva(
  'relative data-[nav-target=true]:rounded-md data-[nav-target=true]:bg-(--color-highlight)',
  {
    variants: {
      variant: {
        h1: RICH_TEXT_HEADING_CLASSES.h1,
        h2: RICH_TEXT_HEADING_CLASSES.h2,
        h3: RICH_TEXT_HEADING_CLASSES.h3,
        h4: RICH_TEXT_HEADING_CLASSES.h4,
        h5: RICH_TEXT_HEADING_CLASSES.h5,
        h6: RICH_TEXT_HEADING_CLASSES.h6,
      },
    },
  }
);

export function HeadingElement({
  variant = 'h1',
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) {
  return (
    <PlateElement
      as={variant!}
      className={headingVariants({ variant })}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H1Element(props: PlateElementProps) {
  return <HeadingElement variant="h1" {...props} />;
}

export function H2Element(props: PlateElementProps) {
  return <HeadingElement variant="h2" {...props} />;
}

export function H3Element(props: PlateElementProps) {
  return <HeadingElement variant="h3" {...props} />;
}

export function H4Element(props: PlateElementProps) {
  return <HeadingElement variant="h4" {...props} />;
}

export function H5Element(props: PlateElementProps) {
  return <HeadingElement variant="h5" {...props} />;
}

export function H6Element(props: PlateElementProps) {
  return <HeadingElement variant="h6" {...props} />;
}
