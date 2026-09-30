import React from 'react';

import type { TListElement } from 'platejs';

import { isOrderedList } from '@platejs/list';
import {
  useTodoListElement,
  useTodoListElementState,
} from '@platejs/list/react';
import {
  BlockPlaceholderPlugin,
  type PlateElementProps,
  type RenderNodeWrapper,
  usePluginOption,
  useReadOnly,
} from 'platejs/react';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const config: Record<
  string,
  {
    Li: React.FC<
      PlateElementProps & {
        lineBreakBadge?: React.ReactNode;
        placeholder?: string;
      }
    >;
    Marker: React.FC<PlateElementProps>;
  }
> = {
  todo: {
    Li: TodoLi,
    Marker: TodoMarker,
  },
};

export const BlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;

  // eslint-disable-next-line react/display-name -- vendored Plate registry component; RenderNodeWrapper's contract expects an inline factory return.
  return (props) => <List {...props} />;
};

function List(props: PlateElementProps & { lineBreakBadge?: React.ReactNode }) {
  const { indent, listStart, listStyleType } = props.element as TListElement & {
    indent?: number;
  };
  const { Li, Marker } = config[listStyleType] ?? {};
  const ListTag = isOrderedList(props.element) ? 'ol' : 'ul';
  const marginLeft = indent ? `${indent * 24}px` : undefined;
  const placeholder = usePluginOption(
    BlockPlaceholderPlugin,
    'placeholder',
    props.element
  );

  return (
    <ListTag
      className='relative m-0 p-0'
      style={{ listStyleType, marginLeft }}
      start={listStart}>
      {Marker && <Marker {...props} />}
      {Li ? (
        <Li {...props} placeholder={placeholder} />
      ) : (
        <ListItem placeholder={placeholder} lineBreakBadge={props.lineBreakBadge}>
          {props.children}
        </ListItem>
      )}
    </ListTag>
  );
}

function ListItem({
  children,
  lineBreakBadge,
  placeholder,
}: {
  children: React.ReactNode;
  lineBreakBadge?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <li
      className={cn(placeholder && 'notebook-list-item--placeholder')}
      data-placeholder={placeholder}>
      {children}
      {lineBreakBadge}
    </li>
  );
}

function TodoMarker(props: PlateElementProps) {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();

  return (
    <div contentEditable={false}>
      <Checkbox
        className={cn(
          '-left-6 absolute top-1',
          readOnly && 'pointer-events-none'
        )}
        {...checkboxProps}
      />
    </div>
  );
}

function TodoLi(
  props: PlateElementProps & {
    lineBreakBadge?: React.ReactNode;
    placeholder?: string;
  }
) {
  return (
    <li
      className={cn(
        'list-none',
        props.placeholder && 'notebook-list-item--placeholder',
        (props.element.checked as boolean) &&
          'text-muted-foreground line-through'
      )}
      data-placeholder={props.placeholder}
    >
      {props.children}
      {props.lineBreakBadge}
    </li>
  );
}
