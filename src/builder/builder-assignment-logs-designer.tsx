import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    createDefaultAssignmentLogDefinition,
    createFieldId,
    createMilestoneId,
    MAX_ASSIGNMENT_LOGS,
    type AssignmentLogDefinition,
    type AssignmentLogSharing
} from '@/lib/assignment-logs';

type BuilderAssignmentLogsDesignerProps = {
    logs: AssignmentLogDefinition[];
    requireLogs: boolean;
    onChange: (logs: AssignmentLogDefinition[]) => void;
};

export function BuilderAssignmentLogsDesigner({
    logs,
    requireLogs,
    onChange
}: BuilderAssignmentLogsDesignerProps) {
    function updateLog(
        logId: string,
        patch: Partial<AssignmentLogDefinition>
    ) {
        onChange(
            logs.map((log) =>
                log.id === logId ? { ...log, ...patch } : log
            )
        );
    }

    function removeLog(logId: string) {
        if (requireLogs && logs.length <= 1) {
            return;
        }
        onChange(logs.filter((log) => log.id !== logId));
    }

    function addLog() {
        if (logs.length >= MAX_ASSIGNMENT_LOGS) {
            return;
        }
        onChange([...logs, createDefaultAssignmentLogDefinition()]);
    }

    return (
        <div className='space-y-4 border bg-background p-3'>
            {logs.map((log) => (
                <div key={log.id} className='space-y-3 border p-3'>
                    <div className='flex items-start justify-between gap-2'>
                        <div className='space-y-2 flex-1 min-w-0'>
                            <Label className='text-xs font-light text-muted-foreground'>
                                Log title
                            </Label>
                            <Input
                                value={log.title}
                                onChange={(event) =>
                                    updateLog(log.id, {
                                        title: event.target.value
                                    })
                                }
                                className='rounded-none'
                            />
                        </div>
                        <Button
                            type='button'
                            size='icon'
                            variant='ghost'
                            className='shrink-0 text-destructive hover:text-destructive'
                            disabled={requireLogs && logs.length <= 1}
                            onClick={() => removeLog(log.id)}
                            aria-label='Remove log'>
                            <Trash2 className='h-4 w-4' />
                        </Button>
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-xs font-light text-muted-foreground'>
                            Sharing
                        </Label>
                        <div className='flex gap-2'>
                            {(['individual', 'shared'] as AssignmentLogSharing[]).map(
                                (mode) => (
                                    <Button
                                        key={mode}
                                        type='button'
                                        size='sm'
                                        variant={
                                            log.sharing === mode
                                                ? 'default'
                                                : 'outline'
                                        }
                                        className='rounded-none font-light'
                                        onClick={() =>
                                            updateLog(log.id, { sharing: mode })
                                        }>
                                        {mode === 'individual'
                                            ? 'Individual'
                                            : 'Shared team'}
                                    </Button>
                                )
                            )}
                        </div>
                        <p className='text-xs font-light text-muted-foreground'>
                            Existing student teams keep the mode they started
                            with.
                        </p>
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-xs font-light text-muted-foreground'>
                            Fields
                        </Label>
                        {log.fields.map((field) => (
                            <div
                                key={field.id}
                                className='flex items-center gap-2'>
                                <Input
                                    value={field.label}
                                    onChange={(event) =>
                                        updateLog(log.id, {
                                            fields: log.fields.map((item) =>
                                                item.id === field.id
                                                    ? {
                                                          ...item,
                                                          label:
                                                              event.target.value
                                                      }
                                                    : item
                                            )
                                        })
                                    }
                                    className='rounded-none'
                                />
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='ghost'
                                    className='shrink-0 text-destructive hover:text-destructive'
                                    disabled={log.fields.length <= 1}
                                    onClick={() =>
                                        updateLog(log.id, {
                                            fields: log.fields.filter(
                                                (item) => item.id !== field.id
                                            )
                                        })
                                    }
                                    aria-label='Remove field'>
                                    <Trash2 className='h-4 w-4' />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            className='rounded-none font-light'
                            disabled={log.fields.length >= 20}
                            onClick={() =>
                                updateLog(log.id, {
                                    fields: [
                                        ...log.fields,
                                        {
                                            id: createFieldId(),
                                            label: 'New field'
                                        }
                                    ]
                                })
                            }>
                            <Plus className='h-3 w-3' />
                            Add field
                        </Button>
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-xs font-light text-muted-foreground'>
                            Seeded milestones (optional)
                        </Label>
                        {log.seededMilestones.map((milestone) => (
                            <div
                                key={milestone.id}
                                className='grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]'>
                                <Input
                                    value={milestone.name}
                                    onChange={(event) =>
                                        updateLog(log.id, {
                                            seededMilestones:
                                                log.seededMilestones.map(
                                                    (item) =>
                                                        item.id === milestone.id
                                                            ? {
                                                                  ...item,
                                                                  name:
                                                                      event
                                                                          .target
                                                                          .value
                                                              }
                                                            : item
                                                )
                                        })
                                    }
                                    className='rounded-none'
                                    placeholder='Milestone name'
                                />
                                <Input
                                    type='date'
                                    value={milestone.date}
                                    onChange={(event) =>
                                        updateLog(log.id, {
                                            seededMilestones:
                                                log.seededMilestones.map(
                                                    (item) =>
                                                        item.id === milestone.id
                                                            ? {
                                                                  ...item,
                                                                  date:
                                                                      event
                                                                          .target
                                                                          .value
                                                              }
                                                            : item
                                                )
                                        })
                                    }
                                    className='rounded-none'
                                />
                                <Input
                                    type='date'
                                    value={milestone.endDate ?? ''}
                                    onChange={(event) =>
                                        updateLog(log.id, {
                                            seededMilestones:
                                                log.seededMilestones.map(
                                                    (item) =>
                                                        item.id === milestone.id
                                                            ? {
                                                                  ...item,
                                                                  endDate:
                                                                      event
                                                                          .target
                                                                          .value
                                                              }
                                                            : item
                                                )
                                        })
                                    }
                                    className='rounded-none'
                                />
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='ghost'
                                    className='text-destructive hover:text-destructive'
                                    onClick={() =>
                                        updateLog(log.id, {
                                            seededMilestones:
                                                log.seededMilestones.filter(
                                                    (item) =>
                                                        item.id !== milestone.id
                                                )
                                        })
                                    }
                                    aria-label='Remove milestone'>
                                    <Trash2 className='h-4 w-4' />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            className='rounded-none font-light'
                            disabled={log.seededMilestones.length >= 40}
                            onClick={() =>
                                updateLog(log.id, {
                                    seededMilestones: [
                                        ...log.seededMilestones,
                                        {
                                            id: createMilestoneId(),
                                            name: 'Milestone',
                                            date: ''
                                        }
                                    ]
                                })
                            }>
                            <Plus className='h-3 w-3' />
                            Add milestone
                        </Button>
                    </div>
                </div>
            ))}

            <Button
                type='button'
                size='sm'
                variant='outline'
                className='rounded-none font-light'
                disabled={logs.length >= MAX_ASSIGNMENT_LOGS}
                onClick={addLog}>
                <Plus className='h-3 w-3' />
                Add log
            </Button>
        </div>
    );
}
