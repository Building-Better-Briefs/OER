import { Editor, Operation } from '../../index';
/**
 * The set of properties that cannot be set using set_node.
 */
export declare const NON_SETTABLE_NODE_PROPERTIES: string[];
/**
 * The set of properties that cannot be set using set_selection.
 */
export declare const NON_SETTABLE_SELECTION_PROPERTIES: string[];
export interface GeneralTransforms {
    /**
     * Transform the editor by an operation.
     */
    transform: (editor: Editor, op: Operation) => void;
}
export declare const GeneralTransforms: GeneralTransforms;
//# sourceMappingURL=general.d.ts.map