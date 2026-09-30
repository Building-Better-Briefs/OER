'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    getPhaseTimelineIntervalMs,
    scheduleGanttBarFill,
    type SchedulePhaseTiming
} from '@/lib/schedule-phase-timeline';

const BAR_BG = [
    'bg-chart-1',
    'bg-chart-2',
    'bg-chart-3',
    'bg-chart-4',
    'bg-chart-5'
] as const;

export type ScheduleGanttPhase = SchedulePhaseTiming & {
    title?: string;
    instructions?: unknown;
};

export type ScheduleGanttLayout = 'responsive' | 'mobile' | 'desktop';

type ScheduleGanttProps = {
    phases: ScheduleGanttPhase[];
    assignmentStart: Date;
    assignmentEnd: Date;
    /** Used for the “today” marker; pass from parent so render stays pure. */
    now: Date;
    compact?: boolean;
    /**
     * `responsive`: mobile/desktop chrome follows viewport (`sm` breakpoint).
     * `mobile` | `desktop`: force that chrome — use when preview lives in a
     * narrow container but the viewport is still wide (e.g. builder mobile preview).
     */
    layout?: ScheduleGanttLayout;
    className?: string;
};

function noopSubscribe(): () => void {
    return () => {};
}

const PHASE_TOOLTIP_DATE_FMT = 'd MMM yyyy';

/** Calendar range shown in phase hover tooltip (aligned with timeline week semantics). */
function getPhaseTooltipDateRange(
    phase: SchedulePhaseTiming,
    assignmentStart: Date
): { start: Date; end: Date } | null {
    if (phase.timingMode === 'weeks') {
        const ws = Number(phase.weekStart);
        const we = Number(phase.weekEnd);
        if (!Number.isFinite(ws) || !Number.isFinite(we)) return null;
        const weekStart = Math.max(1, Math.floor(ws));
        const weekEnd = Math.max(weekStart, Math.floor(we));
        const rangeStart = addDays(assignmentStart, (weekStart - 1) * 7);
        const rangeEndInclusive = addDays(assignmentStart, weekEnd * 7 - 1);
        return { start: rangeStart, end: rangeEndInclusive };
    }
    const sd = phase.startDate?.trim();
    const ed = phase.endDate?.trim();
    if (!sd || !ed) return null;
    const start = new Date(sd);
    const end = new Date(ed);
    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return null;
    }
    return { start, end };
}

function PhaseDetailBody({
    phaseTitle,
    barBgClass,
    dateLine,
    variant
}: {
    phaseTitle: string;
    barBgClass: (typeof BAR_BG)[number];
    dateLine: string;
    variant: 'tooltip' | 'popover';
}) {
    const titleRow = (
        <span
            className={cn(
                'flex items-center gap-2 font-medium',
                variant === 'tooltip' ? 'text-background' : 'text-foreground'
            )}>
            <span
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    barBgClass,
                    variant === 'tooltip'
                        ? 'ring-1 ring-background/40'
                        : 'ring-1 ring-border'
                )}
                aria-hidden
            />
            {phaseTitle}
        </span>
    );
    const dateRow = (
        <span
            className={cn(
                'font-normal tabular-nums text-xs',
                variant === 'tooltip'
                    ? 'text-background opacity-95'
                    : 'text-muted-foreground'
            )}>
            {dateLine}
        </span>
    );
    return (
        <div className='flex flex-col gap-1 text-left'>
            {titleRow}
            {dateRow}
        </div>
    );
}

function PhaseTooltipWrap({
    phaseTitle,
    assignmentStart,
    phase,
    barBgClass,
    side,
    align,
    className,
    children,
    tapMode,
    hydrated
}: {
    phaseTitle: string;
    assignmentStart: Date;
    phase: ScheduleGanttPhase;
    /** Matches the Gantt track bar fill (`BAR_BG` entry). */
    barBgClass: (typeof BAR_BG)[number];
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    className?: string;
    children: ReactNode;
    /** Touch / narrow layout: open details on tap instead of hover tooltip. */
    tapMode?: boolean;
    /** Skip Radix on SSR / first paint to keep React useId aligned with the client. */
    hydrated: boolean;
}) {
    if (!hydrated) {
        return (
            <span
                className={cn(
                    'inline-flex min-w-0 max-w-full',
                    tapMode && 'touch-manipulation rounded-none text-left',
                    className
                )}>
                {children}
            </span>
        );
    }

    const range = getPhaseTooltipDateRange(phase, assignmentStart);
    const tooltipDateFmt = tapMode ? 'd MMM yy' : PHASE_TOOLTIP_DATE_FMT;
    const dateLine = range
        ? `${format(range.start, tooltipDateFmt)} – ${format(range.end, tooltipDateFmt)}`
        : 'Timing not set';

    if (tapMode) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type='button'
                        className={cn(
                            'inline-flex min-w-0 max-w-full cursor-pointer touch-manipulation rounded-none border border-transparent text-left outline-none transition-colors',
                            'hover:bg-muted/60 active:bg-muted/80',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            className
                        )}>
                        {children}
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side={side === 'right' ? 'right' : 'top'}
                    align={align ?? 'start'}
                    sideOffset={8}
                    className='w-auto max-w-[min(90vw,18rem)] border-border p-3 shadow-md'>
                    <PhaseDetailBody
                        phaseTitle={phaseTitle}
                        barBgClass={barBgClass}
                        dateLine={dateLine}
                        variant='popover'
                    />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={0}
                    className={cn(
                        'inline-flex min-w-0 max-w-full cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-none',
                        className
                    )}>
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent side={side} align={align} sideOffset={6}>
                <PhaseDetailBody
                    phaseTitle={phaseTitle}
                    barBgClass={barBgClass}
                    dateLine={dateLine}
                    variant='tooltip'
                />
            </TooltipContent>
        </Tooltip>
    );
}

function axisTicks(start: Date, end: Date, count: number): Date[] {
    const a = start.getTime();
    const b = end.getTime();
    const span = Math.max(b - a, 1);
    const steps = Math.max(2, count);
    return Array.from({ length: steps }, (_, i) => {
        const t = a + (span * i) / (steps - 1);
        return new Date(t);
    });
}

function ScheduleAxis({
    ticks,
    compact,
    relaxLabelClamp
}: {
    ticks: Date[];
    compact: boolean;
    /** Wider scroll layout: show full date labels without narrow breakpoints clipping text */
    relaxLabelClamp?: boolean;
}) {
    return (
        <div
            className={cn(
                'relative min-h-[1.8rem] shrink-0 overflow-x-auto',
                compact ? 'min-w-0' : ''
            )}>
            <div className='relative w-full min-w-[10rem] pb-1'>
                {ticks.map((d, i) => {
                    const n = ticks.length;
                    const pct = n <= 1 ? 0 : (i / (n - 1)) * 100;
                    const isFirst = i === 0;
                    const isLast = i === n - 1 && n > 1;
                    const useShortYear = compact || relaxLabelClamp;
                    const label = format(
                        d,
                        useShortYear ? 'd MMM yy' : 'd MMM yyyy'
                    );
                    return (
                        <span
                            key={i}
                            className={cn(
                                'schedule-gantt-axis-label absolute top-2 whitespace-nowrap font-normal tabular-nums text-foreground/85 sm:max-w-none',
                                compact
                                    ? 'text-[10px]'
                                    : relaxLabelClamp
                                      ? 'text-[10px]'
                                      : 'text-xs',
                                !relaxLabelClamp &&
                                    'max-sm:max-w-[42%] max-sm:truncate',
                                isFirst && 'left-0 text-left',
                                isLast && 'text-right'
                            )}
                            style={
                                isFirst
                                    ? undefined
                                    : isLast
                                      ? {
                                            left: '100%',
                                            transform: 'translateX(-100%)'
                                        }
                                      : {
                                            left: `${pct}%`,
                                            transform: 'translateX(-50%)'
                                        }
                            }
                            title={format(d, 'd MMM yyyy')}>
                            {label}
                        </span>
                    );
                })}
                <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-border/80' />
            </div>
        </div>
    );
}

export function ScheduleGantt({
    phases,
    assignmentStart,
    assignmentEnd,
    now,
    compact = false,
    layout: layoutProp = 'responsive',
    className
}: ScheduleGanttProps) {
    const layout = layoutProp;
    const mounted = useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false
    );

    const winStartMs = assignmentStart.getTime();
    const winEndMs = assignmentEnd.getTime();
    const totalMs = Math.max(winEndMs - winStartMs, 1);
    const nowMs = now.getTime();
    const showTodayMarker =
        nowMs >= winStartMs &&
        nowMs <= winEndMs &&
        Number.isFinite(winStartMs) &&
        Number.isFinite(winEndMs);
    /** Percent position for “today” line — only after mount to avoid SSR/client time & float mismatch */
    const todayPctRounded =
        mounted && showTodayMarker
            ? Math.round(((nowMs - winStartMs) / totalMs) * 100 * 10000) / 10000
            : null;

    const desktopTickCount = compact ? 2 : 4;
    const mobileTickCount = compact ? 4 : 8;
    const desktopTicks = axisTicks(
        assignmentStart,
        assignmentEnd,
        desktopTickCount
    );
    const mobileTicks = axisTicks(
        assignmentStart,
        assignmentEnd,
        mobileTickCount
    );

    /** Wider strip than the viewport so the timeline can be panned on small screens */
    const scrollStripMinWidthPx = Math.round(
        Math.min(720, Math.max(300, (totalMs / 86400000) * 6))
    );

    const renderTrackRow = (
        phase: ScheduleGanttPhase,
        idx: number,
        options: {
            tapMode: boolean;
            showTopBorder: boolean;
            trackVariant: 'mobile' | 'desktop';
        }
    ) => {
        const interval = getPhaseTimelineIntervalMs(
            phase,
            assignmentStart,
            assignmentEnd
        );
        const title = phase.title?.trim() || `Phase ${idx + 1}`;
        const leftPct = interval
            ? ((interval.startMs - winStartMs) / totalMs) * 100
            : 0;
        const widthPct = interval
            ? ((interval.endMs - interval.startMs) / totalMs) * 100
            : 0;
        const barColor = BAR_BG[idx % BAR_BG.length];

        return (
            <PhaseTooltipWrap
                key={`track-${idx}`}
                phaseTitle={title}
                assignmentStart={assignmentStart}
                phase={phase}
                barBgClass={barColor}
                side='top'
                align='center'
                tapMode={options.tapMode}
                hydrated={mounted}
                className={cn(
                    'relative rounded-none bg-muted/50 min-w-[10rem] border-border w-full',
                    options.trackVariant === 'mobile'
                        ? 'h-8'
                        : 'h-7',
                    options.showTopBorder &&
                        (options.trackVariant === 'mobile' ||
                        layout === 'desktop'
                            ? 'border-t border-border'
                            : 'sm:border-t')
                )}>
                {interval ? (
                    <div
                        className='absolute top-1/2 -translate-y-1/2 h-4 rounded-none ring-1 ring-border/60 shadow-sm z-[1]'
                        style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(widthPct, 0.35)}%`,
                            maxWidth: `${100 - leftPct}%`,
                            ...scheduleGanttBarFill(idx)
                        }}
                    />
                ) : (
                    <span
                        className={cn(
                            'absolute inset-0 flex items-center px-2 font-light text-muted-foreground pointer-events-none',
                            compact ? 'text-[10px]' : 'text-xs'
                        )}>
                        Timing not set
                    </span>
                )}
            </PhaseTooltipWrap>
        );
    };

    const mobileWrapperClass =
        layout === 'mobile'
            ? 'flex flex-col gap-2'
            : layout === 'desktop'
              ? 'hidden'
              : 'flex flex-col gap-2 sm:hidden';

    const desktopWrapperClass =
        layout === 'desktop'
            ? 'flex flex-row gap-x-3 items-stretch'
            : layout === 'mobile'
              ? 'hidden'
              : 'hidden sm:flex sm:flex-row sm:gap-x-3 sm:items-stretch';

    const mobileHintClass =
        layout === 'mobile'
            ? 'schedule-gantt-hint mb-2 block text-[10px] font-light leading-snug text-muted-foreground'
            : layout === 'desktop'
              ? 'hidden'
              : 'schedule-gantt-hint mb-2 hidden max-sm:block text-[10px] font-light leading-snug text-muted-foreground';

    return (
        <TooltipProvider delayDuration={mounted ? 250 : 0}>
            <div
                data-schedule-gantt
                data-schedule-gantt-layout={layout}
                className={cn(
                    'rounded-none bg-muted/20 border border-border',
                    layout === 'mobile' ? 'border-0' : 'max-sm:border-0',
                    compact ? 'mt-3 p-2.5 max-sm:p-2' : 'mt-5 p-4 max-sm:p-3',
                    className
                )}>
                <p
                    className={cn(
                        'schedule-gantt-caption font-light text-muted-foreground mb-2 sm:mb-2',
                        compact ? 'text-[10px]' : 'text-xs'
                    )}>
                    Timeline
                    {mounted && showTodayMarker ? (
                        <span className='text-brand'>
                            {' '}
                            · Today
                        </span>
                    ) : null}
                </p>
                <p className={mobileHintClass}>
                    Scroll horizontally for the full timeline. Tap a phase name
                    or bar for start and end dates.
                </p>

                {/* Mobile: sticky phase labels + scrollable timeline */}
                <div className={mobileWrapperClass}>
                    <div className='-mx-1 overflow-x-auto overflow-y-visible px-1 pb-1'>
                        <div className='flex min-w-0 items-stretch gap-2'>
                            <div
                                className='sticky left-0 z-[6] flex w-[min(7.25rem,28vw)] shrink-0 flex-col gap-2 border-r border-border/80 bg-muted/40 py-0 pr-2 pl-0.5 backdrop-blur-sm'>
                                <div
                                    className='min-h-[1.8rem] shrink-0 pb-1'
                                    aria-hidden
                                />
                                {phases.map((phase, idx) => {
                                    const title =
                                        phase.title?.trim() ||
                                        `Phase ${idx + 1}`;
                                    const barColor =
                                        BAR_BG[idx % BAR_BG.length];
                                    return (
                                        <PhaseTooltipWrap
                                            key={`m-label-${idx}`}
                                            phaseTitle={title}
                                            assignmentStart={assignmentStart}
                                            phase={phase}
                                            barBgClass={barColor}
                                            side='right'
                                            align='start'
                                            tapMode
                                            hydrated={mounted}
                                            className='w-full items-center min-h-8 py-1'>
                                            <p
                                                className={cn(
                                                    'schedule-gantt-phase-label line-clamp-2 w-full font-normal leading-snug',
                                                    compact
                                                        ? 'text-[10px]'
                                                        : 'text-[11px]'
                                                )}>
                                                {title}
                                            </p>
                                        </PhaseTooltipWrap>
                                    );
                                })}
                            </div>
                            <div
                                className='relative flex min-w-0 flex-1 flex-col gap-2'
                                style={{
                                    minWidth: scrollStripMinWidthPx
                                }}>
                                <ScheduleAxis
                                    ticks={mobileTicks}
                                    compact={compact}
                                    relaxLabelClamp
                                />
                                {phases.map((phase, idx) =>
                                    renderTrackRow(phase, idx, {
                                        tapMode: true,
                                        showTopBorder: idx > 0,
                                        trackVariant: 'mobile'
                                    })
                                )}
                                {todayPctRounded !== null ? (
                                    <div
                                        className='pointer-events-none absolute z-10 top-0 bottom-0 w-px bg-brand opacity-90'
                                        style={{
                                            left: `${todayPctRounded}%`
                                        }}
                                        aria-hidden
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop */}
                <div className={desktopWrapperClass}>
                    <div className='flex flex-col gap-2 min-w-[7rem] max-w-[11rem] shrink-0'>
                        <div className='min-h-[1.8rem] shrink-0 pb-1' aria-hidden />
                        {phases.map((phase, idx) => {
                            const title =
                                phase.title?.trim() || `Phase ${idx + 1}`;
                            const barColor = BAR_BG[idx % BAR_BG.length];
                            return (
                                <PhaseTooltipWrap
                                    key={idx}
                                    phaseTitle={title}
                                    assignmentStart={assignmentStart}
                                    phase={phase}
                                    barBgClass={barColor}
                                    side='right'
                                    align='start'
                                    tapMode={false}
                                    hydrated={mounted}
                                    className='w-full items-center min-h-8 sm:min-h-7 py-1'>
                                    <p
                                        className={cn(
                                            'font-normal truncate w-full',
                                            compact ? 'text-xs' : 'text-sm'
                                        )}>
                                        {title}
                                    </p>
                                </PhaseTooltipWrap>
                            );
                        })}
                    </div>

                    <div className='relative flex flex-col gap-2 flex-1 min-w-0 min-w-[10rem]'>
                        <ScheduleAxis
                            ticks={desktopTicks}
                            compact={compact}
                        />

                        {phases.map((phase, idx) =>
                            renderTrackRow(phase, idx, {
                                tapMode: false,
                                showTopBorder: idx > 0,
                                trackVariant: 'desktop'
                            })
                        )}

                        {todayPctRounded !== null ? (
                            <div
                                className='pointer-events-none absolute z-10 top-0 bottom-0 w-px bg-brand opacity-90'
                                style={{ left: `${todayPctRounded}%` }}
                                aria-hidden
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
