export const MOUSE_HEATMAP_GRID_COLS = 40;
export const MOUSE_HEATMAP_GRID_ROWS = 80;

export type MouseHeatmapCell = {
    gridX: number;
    gridY: number;
    hitCount: number;
};

export type MouseHeatmapSnapshot = {
    gridCols: number;
    gridRows: number;
    cells: MouseHeatmapCell[];
    totalHits: number;
    contributingSessions: number;
};

function getDocumentOffset(el: HTMLElement): { left: number; top: number } {
    let left = 0;
    let top = 0;
    let node: HTMLElement | null = el;

    while (node) {
        left += node.offsetLeft;
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    }

    return { left, top };
}

export function pointerToHeatmapGrid(
    contentEl: HTMLElement,
    clientX: number,
    clientY: number
): { gridX: number; gridY: number } | null {
    const width = contentEl.offsetWidth;
    const height = contentEl.offsetHeight;
    if (width <= 0 || height <= 0) {
        return null;
    }

    const { left, top } = getDocumentOffset(contentEl);
    const relativeX = clientX + window.scrollX - left;
    const relativeY = clientY + window.scrollY - top;

    if (
        relativeX < 0 ||
        relativeY < 0 ||
        relativeX > width ||
        relativeY > height
    ) {
        return null;
    }

    const xNorm = relativeX / width;
    const yNorm = relativeY / height;

    const gridX = Math.min(
        MOUSE_HEATMAP_GRID_COLS - 1,
        Math.max(0, Math.floor(xNorm * MOUSE_HEATMAP_GRID_COLS))
    );
    const gridY = Math.min(
        MOUSE_HEATMAP_GRID_ROWS - 1,
        Math.max(0, Math.floor(yNorm * MOUSE_HEATMAP_GRID_ROWS))
    );

    return { gridX, gridY };
}

export function isValidHeatmapGridCell(
    gridX: number,
    gridY: number
): boolean {
    return (
        Number.isInteger(gridX) &&
        Number.isInteger(gridY) &&
        gridX >= 0 &&
        gridX < MOUSE_HEATMAP_GRID_COLS &&
        gridY >= 0 &&
        gridY < MOUSE_HEATMAP_GRID_ROWS
    );
}
