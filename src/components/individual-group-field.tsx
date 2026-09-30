'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const INDIVIDUAL_GROUP_PRESETS = [
    { label: 'Individual', value: 'Individual' },
    { label: 'Group', value: 'Group' },
    {
        label: 'Group (n–n)',
        value: 'Group project (n–n students)'
    }
] as const;

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
                const isActive = value === preset.value;

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
