'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const GROUP_PROJECT_RANGE_PLACEHOLDER = 'n–n';

export const INDIVIDUAL_GROUP_PRESETS = [
    { label: 'Individual', value: 'Individual' },
    { label: 'Group', value: 'Group' },
    {
        label: 'Group (n–n)',
        value: `Group project (${GROUP_PROJECT_RANGE_PLACEHOLDER} students)`
    }
] as const;

export const GROUP_PROJECT_RANGE_TEMPLATE = INDIVIDUAL_GROUP_PRESETS[2].value;

const GROUP_PROJECT_RANGE_PATTERN =
    /^Group project \((.+)\ students\)$/;

export function isGroupProjectRangeValue(value: string): boolean {
    return GROUP_PROJECT_RANGE_PATTERN.test(value);
}

export function parseGroupProjectRange(value: string): string {
    const match = value.match(GROUP_PROJECT_RANGE_PATTERN);
    return match?.[1] ?? GROUP_PROJECT_RANGE_PLACEHOLDER;
}

export function formatGroupProjectRange(range: string): string {
    const trimmed = range.trim();
    return `Group project (${trimmed || GROUP_PROJECT_RANGE_PLACEHOLDER} students)`;
}

type IndividualGroupPresetTabsProps = {
    value: string;
    onChange: (value: string) => void;
};

export function IndividualGroupPresetTabs({
    value,
    onChange
}: IndividualGroupPresetTabsProps) {
    return (
        <div
            role='group'
            aria-label='Individual or group presets'
            className='flex flex-wrap gap-2'>
            {INDIVIDUAL_GROUP_PRESETS.map((preset) => {
                const isActive =
                    preset.label === 'Group (n–n)'
                        ? isGroupProjectRangeValue(value)
                        : value === preset.value;

                return (
                    <Badge
                        key={preset.value}
                        variant={isActive ? 'default' : 'outline'}
                        role='button'
                        tabIndex={0}
                        aria-pressed={isActive}
                        className={cn('cursor-pointer')}
                        onClick={() => onChange(preset.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onChange(preset.value);
                            }
                        }}>
                        {preset.label}
                    </Badge>
                );
            })}
        </div>
    );
}

type IndividualGroupFieldProps = {
    value: string;
    onChange: (value: string) => void;
};

export function IndividualGroupField({
    value,
    onChange
}: IndividualGroupFieldProps) {
    const showRangeInput = isGroupProjectRangeValue(value);
    const range = showRangeInput ? parseGroupProjectRange(value) : '';

    return (
        <div className='space-y-2'>
            <Label>Individual or group</Label>
            <IndividualGroupPresetTabs value={value} onChange={onChange} />
            {showRangeInput ? (
                <div className='space-y-2'>
                    <Label htmlFor='individual-group-range'>
                        Group size (students)
                    </Label>
                    <Input
                        id='individual-group-range'
                        value={range}
                        placeholder={GROUP_PROJECT_RANGE_PLACEHOLDER}
                        onChange={(event) =>
                            onChange(formatGroupProjectRange(event.target.value))
                        }
                        aria-describedby='individual-group-range-hint'
                    />
                    <p
                        id='individual-group-range-hint'
                        className='text-sm text-muted-foreground'>
                        e.g. 3–5
                    </p>
                </div>
            ) : null}
        </div>
    );
}
