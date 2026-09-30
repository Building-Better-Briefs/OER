import { addDays } from 'date-fns';

export type SchedulePhaseTiming = {
    timingMode?: 'date' | 'weeks';
    startDate?: string;
    endDate?: string;
    weekStart?: number;
    weekEnd?: number;
};

/**
 * Converts a schedule phase to start/end ms within the assignment window.
 * Week `w` spans [assignmentStart + (w-1)*7d, assignmentStart + w*7d) (half-open).
 */
export function getPhaseTimelineIntervalMs(
    phase: SchedulePhaseTiming,
    assignmentStart: Date,
    assignmentEnd: Date
): { startMs: number; endMs: number } | null {
    const winStart = assignmentStart.getTime();
    const winEnd = assignmentEnd.getTime();
    if (!Number.isFinite(winStart) || !Number.isFinite(winEnd) || winEnd <= winStart) {
        return null;
    }

    let phaseStartMs: number;
    let phaseEndMs: number;

    if (phase.timingMode === 'weeks') {
        const ws = Number(phase.weekStart);
        const we = Number(phase.weekEnd);
        if (!Number.isFinite(ws) || !Number.isFinite(we)) return null;
        const weekStart = Math.max(1, Math.floor(ws));
        const weekEnd = Math.max(weekStart, Math.floor(we));
        const start = addDays(assignmentStart, (weekStart - 1) * 7);
        const endExclusive = addDays(assignmentStart, weekEnd * 7);
        phaseStartMs = start.getTime();
        phaseEndMs = endExclusive.getTime();
    } else {
        if (!phase.startDate?.trim() || !phase.endDate?.trim()) return null;
        const start = new Date(phase.startDate);
        const end = new Date(phase.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        phaseStartMs = start.getTime();
        phaseEndMs = end.getTime();
        if (phaseEndMs <= phaseStartMs) {
            phaseEndMs = phaseStartMs + 24 * 60 * 60 * 1000;
        }
    }

    const clampedStart = Math.max(phaseStartMs, winStart);
    const clampedEnd = Math.min(phaseEndMs, winEnd);
    if (clampedStart >= clampedEnd) return null;

    return { startMs: clampedStart, endMs: clampedEnd };
}

const SCHEDULE_CHART_VARS = [
    '--chart-1',
    '--chart-2',
    '--chart-3',
    '--chart-4',
    '--chart-5'
] as const;

const ASSIGNMENT_PROGRESS_BASE = '#B0CFC7';
const ASSIGNMENT_PROGRESS_STRIPE = '#134F47';

function diagonalStripeFill(baseColor: string, stripeColor: string) {
    return {
        backgroundColor: baseColor,
        backgroundImage: `repeating-linear-gradient(-45deg, ${stripeColor}, ${stripeColor} 1px, ${baseColor} 2px, ${baseColor} 8px)`
    };
}

/** Assignment timeline bar: mint fill with diagonal stripes in the same palette */
export const SCHEDULE_ASSIGNMENT_PROGRESS_FILL = diagonalStripeFill(
    ASSIGNMENT_PROGRESS_BASE,
    ASSIGNMENT_PROGRESS_STRIPE
);

/** Gantt phase bar: chart color fill with darker stripes from the same hue */
export function scheduleGanttBarFill(phaseIndex: number) {
    const chartVar = SCHEDULE_CHART_VARS[phaseIndex % SCHEDULE_CHART_VARS.length];
    const base = `var(${chartVar})`;
    const stripe = `color-mix(in oklch, ${base} 72%,rgba(255, 255, 255, 0.68))`;
    return diagonalStripeFill(base, stripe);
}
