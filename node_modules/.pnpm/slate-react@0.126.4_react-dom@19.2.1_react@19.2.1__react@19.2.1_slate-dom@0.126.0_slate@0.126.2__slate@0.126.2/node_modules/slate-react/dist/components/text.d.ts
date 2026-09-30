import React from 'react';
import { Element, Text as SlateText, DecoratedRange } from 'slate';
import { RenderLeafProps, RenderPlaceholderProps, RenderTextProps } from './editable';
declare const MemoizedText: React.MemoExoticComponent<(props: {
    decorations: DecoratedRange[];
    isLast: boolean;
    parent: Element;
    renderPlaceholder: (props: RenderPlaceholderProps) => React.JSX.Element;
    renderLeaf?: ((props: RenderLeafProps) => React.JSX.Element) | undefined;
    renderText?: ((props: RenderTextProps) => React.JSX.Element) | undefined;
    text: SlateText;
}) => React.JSX.Element>;
export declare const DefaultText: (props: RenderTextProps) => React.JSX.Element;
export default MemoizedText;
//# sourceMappingURL=text.d.ts.map