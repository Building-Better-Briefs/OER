import { BriefStatusField } from '@/components/brief-status-field';
import { useBriefBuilder } from './brief-builder-context';

type BuilderBriefStatusFieldProps = {
    className?: string;
};

export function BuilderBriefStatusField({
    className
}: BuilderBriefStatusFieldProps) {
    const {
        briefStatus,
        setBriefStatus,
        isStatusSaving,
        showPublishHint,
        dismissPublishHint
    } = useBriefBuilder();

    return (
        <BriefStatusField
            value={briefStatus}
            onChange={(status) => {
                void setBriefStatus(status);
            }}
            isSaving={isStatusSaving}
            showPublishHint={showPublishHint}
            onDismissPublishHint={dismissPublishHint}
            className={className}
        />
    );
}
