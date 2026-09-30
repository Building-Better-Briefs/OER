import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useBriefBuilder } from './brief-builder-context';
import { cn } from '@/lib/utils';

type SelfAssessmentLinkOptionFieldsProps = {
    canOfferLink: boolean;
};

export function SelfAssessmentLinkOptionFields({
    canOfferLink
}: SelfAssessmentLinkOptionFieldsProps) {
    const { selfAssessmentLinkEnabled, setSelfAssessmentLinkEnabled } =
        useBriefBuilder();

    return (
        <div
            className='space-y-2 border p-3 bg-card'
            data-tour='brief-builder-self-assessment-link'>
            <Label className='font-normal text-sm'>Student viewer options</Label>
            <label
                className={cn(
                    'flex items-start gap-2 border bg-background p-3',
                    !canOfferLink && 'opacity-60'
                )}>
                <Checkbox
                    checked={selfAssessmentLinkEnabled && canOfferLink}
                    disabled={!canOfferLink}
                    onCheckedChange={(checked) =>
                        setSelfAssessmentLinkEnabled(Boolean(checked))
                    }
                />
                <span className='text-sm font-light leading-snug'>
                    Includes a link to the student self-assessment form
                </span>
            </label>
            {!canOfferLink ? (
                <p className='text-xs font-light text-muted-foreground'>
                    Add at least one rubric criterion above to enable this link.
                </p>
            ) : null}
        </div>
    );
}
