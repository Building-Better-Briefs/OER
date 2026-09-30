import {
    customSubsectionBlockId,
    getCustomSubsectionRestoreLabel,
    parseCustomSubsectionBlockId,
    type CustomSubsection
} from '@/lib/custom-subsections';
import { isProjectDetailSubsectionVisible } from '@/lib/project-detail-subsections';

function arrayMove<T>(array: T[], from: number, to: number): T[] {
    const result = array.slice();
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
}

export const BUILTIN_PROJECT_DETAIL_BLOCK_IDS = [
    'project-overview-content',
    'learning-outcomes',
    'key-expectations',
    'deliverables',
    'resources'
] as const;

export type BuiltinProjectDetailBlockId =
    (typeof BUILTIN_PROJECT_DETAIL_BLOCK_IDS)[number];

export const BUILTIN_PROJECT_DETAIL_BLOCK_LABELS: Record<
    BuiltinProjectDetailBlockId,
    string
> = {
    'project-overview-content': 'Project Overview',
    'learning-outcomes': 'Learning Outcomes Assessed',
    'key-expectations': 'Key Expectations',
    deliverables: 'Deliverables',
    resources: 'Resources'
};

export function getProjectDetailBlockLabel(
    blockId: string,
    customSubsections: CustomSubsection[]
): string {
    if (isBuiltinProjectDetailBlockId(blockId)) {
        return BUILTIN_PROJECT_DETAIL_BLOCK_LABELS[blockId];
    }

    const customId = parseCustomSubsectionBlockId(blockId);
    if (customId) {
        const subsection = customSubsections.find(
            (entry) => entry.id === customId
        );
        if (subsection) {
            return getCustomSubsectionRestoreLabel(subsection);
        }
    }

    return 'Custom subsection';
}

export function isBuiltinProjectDetailBlockId(
    blockId: string
): blockId is BuiltinProjectDetailBlockId {
    return (BUILTIN_PROJECT_DETAIL_BLOCK_IDS as readonly string[]).includes(
        blockId
    );
}

export function isCustomProjectDetailBlockId(blockId: string): boolean {
    return blockId.startsWith('custom:');
}

export function defaultProjectDetailBlockOrder(
    customSubsections: CustomSubsection[]
): string[] {
    return [
        ...BUILTIN_PROJECT_DETAIL_BLOCK_IDS,
        ...customSubsections.map((s) => customSubsectionBlockId(s.id))
    ];
}

export function buildProjectDetailBlockOrderWithInserts(
    customSubsections: CustomSubsection[],
    insertAfterPerCustom: Array<BuiltinProjectDetailBlockId | undefined>
): string[] {
    const order: string[] = [...BUILTIN_PROJECT_DETAIL_BLOCK_IDS];

    customSubsections.forEach((subsection, index) => {
        const blockId = customSubsectionBlockId(subsection.id);
        const after =
            insertAfterPerCustom[index] ?? 'resources';
        const insertIndex = order.indexOf(after);
        if (insertIndex === -1) {
            order.push(blockId);
        } else {
            order.splice(insertIndex + 1, 0, blockId);
        }
    });

    return order;
}

export function normalizeProjectDetailBlockOrder(
    order: unknown,
    customSubsections: CustomSubsection[],
    templateBuiltinIds: readonly string[] = BUILTIN_PROJECT_DETAIL_BLOCK_IDS
): string[] {
    const customIds = new Set(
        customSubsections.map((s) => customSubsectionBlockId(s.id))
    );

    let working = Array.isArray(order)
        ? order.filter((id): id is string => typeof id === 'string')
        : [];

    if (working.length === 0) {
        working = defaultProjectDetailBlockOrder(customSubsections);
    }

    const seen = new Set<string>();
    const merged: string[] = [];

    for (const id of working) {
        if (seen.has(id)) continue;
        if (isBuiltinProjectDetailBlockId(id)) {
            seen.add(id);
            merged.push(id);
            continue;
        }
        if (isCustomProjectDetailBlockId(id) && customIds.has(id)) {
            seen.add(id);
            merged.push(id);
        }
    }

    for (const builtinId of templateBuiltinIds) {
        if (!seen.has(builtinId)) {
            seen.add(builtinId);
            merged.push(builtinId);
        }
    }

    for (const customId of customIds) {
        if (!seen.has(customId)) {
            seen.add(customId);
            merged.push(customId);
        }
    }

    return merged;
}

export function isProjectDetailBlockVisible(
    blockId: string,
    hiddenBuiltin: string[] | undefined | null,
    hiddenCustom: string[] | undefined | null
): boolean {
    if (isBuiltinProjectDetailBlockId(blockId)) {
        return isProjectDetailSubsectionVisible(blockId, hiddenBuiltin);
    }
    const customId = parseCustomSubsectionBlockId(blockId);
    if (!customId) return false;
    return !hiddenCustom?.includes(customId);
}

export function getVisibleProjectDetailBlockIds(
    order: string[],
    hiddenBuiltin: string[] | undefined | null,
    hiddenCustom: string[] | undefined | null
): string[] {
    return order.filter((blockId) =>
        isProjectDetailBlockVisible(blockId, hiddenBuiltin, hiddenCustom)
    );
}

export function reorderVisibleProjectDetailBlocks(
    fullOrder: string[],
    hiddenBuiltin: string[] | undefined | null,
    hiddenCustom: string[] | undefined | null,
    activeId: string,
    overId: string
): string[] | null {
    const visible = getVisibleProjectDetailBlockIds(
        fullOrder,
        hiddenBuiltin,
        hiddenCustom
    );
    const oldIndex = visible.indexOf(activeId);
    const newIndex = visible.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return null;
    }

    const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
    let visibleCursor = 0;
    return fullOrder.map((blockId) => {
        if (
            !isProjectDetailBlockVisible(
                blockId,
                hiddenBuiltin,
                hiddenCustom
            )
        ) {
            return blockId;
        }
        const next = reorderedVisible[visibleCursor];
        visibleCursor += 1;
        return next;
    });
}
