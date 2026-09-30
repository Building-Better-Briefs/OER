'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode
} from 'react';
import { SwipeLeftGestureIcon } from '@/components/icons/swipe-left-gesture-icon';
import { cn } from '@/lib/utils';

type HorizontalScrollHintProps = {
    children: ReactNode;
    className?: string;
    scrollClassName?: string;
    label?: string;
    /** Renders on the same row as the scroll hint (e.g. section title). */
    header?: ReactNode;
    headerClassName?: string;
};

function ScrollHintIndicator({
    show,
    label,
    className
}: {
    show: boolean;
    label: string;
    className?: string;
}) {
    return (
        <div
            aria-hidden={!show}
            className={cn(
                'flex shrink-0 items-center text-muted-foreground transition-opacity duration-500',
                show ? 'opacity-100' : 'opacity-0',
                className
            )}
            title={label}>
            <SwipeLeftGestureIcon className='h-10 w-10 scroll-hint-x max-sm:h-8 max-sm:w-8' />
            <span className='sr-only'>{label}</span>
        </div>
    );
}

export function HorizontalScrollHint({
    children,
    className,
    scrollClassName,
    label = 'Swipe sideways to see more',
    header,
    headerClassName
}: HorizontalScrollHintProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showHint, setShowHint] = useState(false);

    const updateHint = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        const canScroll = el.scrollWidth > el.clientWidth + 2;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
        setShowHint(canScroll && !atEnd);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        updateHint();

        const resizeObserver = new ResizeObserver(updateHint);
        resizeObserver.observe(el);

        el.addEventListener('scroll', updateHint, { passive: true });
        window.addEventListener('resize', updateHint);

        return () => {
            resizeObserver.disconnect();
            el.removeEventListener('scroll', updateHint);
            window.removeEventListener('resize', updateHint);
        };
    }, [updateHint]);

    return (
        <div className={className}>
            {header ? (
                <div
                    className={cn(
                        'mb-6 flex items-center justify-between gap-3 max-sm:mb-3',
                        headerClassName
                    )}>
                    <div className='min-w-0 flex-1'>{header}</div>
                    <ScrollHintIndicator show={showHint} label={label} />
                </div>
            ) : null}
            <div className='relative'>
                <div
                    ref={scrollRef}
                    className={cn('overflow-x-auto', scrollClassName)}>
                    {children}
                </div>
                <div
                    aria-hidden={!showHint}
                    className={cn(
                        'pointer-events-none absolute inset-y-0 right-0 z-10 bg-gradient-to-l from-background via-background/90 to-transparent transition-opacity duration-500',
                        header
                            ? 'w-16 max-sm:w-14'
                            : 'flex w-16 items-start justify-end pr-1 max-sm:w-14',
                        showHint ? 'opacity-100' : 'opacity-0'
                    )}>
                    {!header ? (
                        <ScrollHintIndicator
                            show={showHint}
                            label={label}
                            className='pr-1'
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
