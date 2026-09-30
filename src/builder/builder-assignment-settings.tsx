import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AssignmentLogDefinition } from '@/lib/assignment-logs';
import { BuilderAssignmentLogsDesigner } from './builder-assignment-logs-designer';

type AssignmentSettingRowProps = {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    onHide?: () => void;
    children?: React.ReactNode;
};

function AssignmentSettingRow({
    label,
    description,
    checked,
    onCheckedChange,
    onHide,
    children
}: AssignmentSettingRowProps) {
    return (
        <div className='space-y-3'>
            <label className='flex items-start gap-2 border bg-background p-3'>
                <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onCheckedChange(Boolean(value))}
                />
                <span className='space-y-1 text-sm font-light leading-snug flex-1 min-w-0'>
                    <span className='flex items-start justify-between gap-2'>
                        <span className='block font-normal'>{label}</span>
                        {onHide ? (
                            <Button
                                type='button'
                                size='icon'
                                variant='ghost'
                                onClick={onHide}
                                className='shrink-0 text-destructive hover:text-destructive h-8 w-8'
                                aria-label='Hide setting'>
                                <X className='h-4 w-4' />
                            </Button>
                        ) : null}
                    </span>
                    <span className='block text-muted-foreground'>
                        {description}
                    </span>
                </span>
            </label>
            {children}
        </div>
    );
}

type BuilderAssignmentSettingsProps = {
    showRequireLogs: boolean;
    requireLogs: boolean;
    assignmentLogs: AssignmentLogDefinition[];
    onRequireLogsChange: (checked: boolean) => void;
    onAssignmentLogsChange: (logs: AssignmentLogDefinition[]) => void;
    onHideRequireLogs?: () => void;
    showRequireAiLog: boolean;
    requireAiLog: boolean;
    onRequireAiLogChange: (checked: boolean) => void;
    onHideRequireAiLog?: () => void;
};

export function BuilderAssignmentSettings({
    showRequireLogs,
    requireLogs,
    assignmentLogs,
    onRequireLogsChange,
    onAssignmentLogsChange,
    onHideRequireLogs,
    showRequireAiLog,
    requireAiLog,
    onRequireAiLogChange,
    onHideRequireAiLog
}: BuilderAssignmentSettingsProps) {
    if (!showRequireLogs && !showRequireAiLog) {
        return null;
    }

    return (
        <div className='space-y-3 border p-3 bg-card'>
            {/* <Label className='font-normal text-sm'>Log settings</Label> */}
            <div className='space-y-3'>
            {showRequireAiLog ? (
                    <AssignmentSettingRow
                        label='AI Log'
                        description='Students complete a structured AI usage log as a submission.'
                        checked={requireAiLog}
                        onCheckedChange={onRequireAiLogChange}
                        onHide={onHideRequireAiLog}
                    />
                ) : null}
                {showRequireLogs ? (
                    <AssignmentSettingRow
                        label='Custom Logs'
                        description='Students complete structured logs as a submission.'
                        checked={requireLogs}
                        onCheckedChange={onRequireLogsChange}
                        onHide={onHideRequireLogs}>
                        {requireLogs ? (
                            <BuilderAssignmentLogsDesigner
                                logs={assignmentLogs}
                                requireLogs={requireLogs}
                                onChange={onAssignmentLogsChange}
                            />
                        ) : null}
                    </AssignmentSettingRow>
                ) : null}
                
            </div>
            <p className='text-xs font-light text-muted-foreground'>
                Students see this after the brief is published and saved.
            </p>
        </div>
    );
}
