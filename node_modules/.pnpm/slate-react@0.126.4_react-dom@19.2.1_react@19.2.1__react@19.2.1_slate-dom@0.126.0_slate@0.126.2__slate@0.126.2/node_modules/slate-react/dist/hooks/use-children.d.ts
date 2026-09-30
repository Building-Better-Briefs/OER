import React from 'react';
import { Ancestor, Element, DecoratedRange } from 'slate';
import { RenderChunkProps, RenderElementProps, RenderLeafProps, RenderPlaceholderProps, RenderTextProps } from '../components/editable';
/**
 * Children.
 */
declare const useChildren: (props: {
    decorations: DecoratedRange[];
    node: Ancestor;
    renderElement?: ((props: RenderElementProps) => React.JSX.Element) | undefined;
    renderChunk?: ((props: RenderChunkProps) => React.JSX.Element) | undefined;
    renderPlaceholder: (props: RenderPlaceholderProps) => React.JSX.Element;
    renderText?: ((props: RenderTextProps) => React.JSX.Element) | undefined;
    renderLeaf?: ((props: RenderLeafProps) => React.JSX.Element) | undefined;
}) => React.JSX.Element | React.JSX.Element[];
export default useChildren;
//# sourceMappingURL=use-children.d.ts.map