import React, { ComponentProps } from 'react';
import { Element } from 'slate';
import { Key } from 'slate-dom';
import { RenderChunkProps } from './editable';
import { ChunkAncestor as TChunkAncestor, ChunkTree as TChunkTree } from '../chunking';
declare const ChunkAncestor: <C extends TChunkAncestor>(props: {
    root: TChunkTree;
    ancestor: C;
    renderElement: (node: Element, index: number, key: Key) => React.JSX.Element;
    renderChunk?: ((props: RenderChunkProps) => React.JSX.Element) | undefined;
}) => React.JSX.Element[];
declare const ChunkTree: (props: ComponentProps<typeof ChunkAncestor<TChunkTree>>) => React.JSX.Element;
export default ChunkTree;
//# sourceMappingURL=chunk-tree.d.ts.map