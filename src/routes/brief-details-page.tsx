import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    createBrief,
    getBrief,
    INSTITUTIONAL_POLICY_LABEL_MAX,
    INSTITUTIONAL_POLICY_URL_MAX,
    metadataFromForm,
    metadataToForm,
    writeBrief,
    type LocalBriefRecord
} from '@/lib/brief-store';
import { IndividualGroupField } from '@/components/individual-group-field';
import { getInstitutionAiPolicy } from '@/lib/institution-config';
import { toast } from 'sonner';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';

const institutionalPolicyUrlPattern = /^https?:\/\//i;

const schema = z
    .object({
        programme: z.string().trim().min(1, 'Programme is required'),
        module: z.string().trim().min(1, 'Module is required'),
        title: z.string().trim().min(1, 'Title is required'),
        lecturer: z.string().trim().min(1, 'Lecturer is required'),
        startDate: z.string().min(1, 'Start date is required'),
        submissionDate: z.string().min(1, 'Submission date is required'),
        individualGroup: z.string().trim().min(1, 'Required'),
        institutionalPolicyLabel: z
            .string()
            .max(
                INSTITUTIONAL_POLICY_LABEL_MAX,
                `Link text must be at most ${INSTITUTIONAL_POLICY_LABEL_MAX} characters`
            ),
        institutionalPolicyUrl: z
            .string()
            .max(
                INSTITUTIONAL_POLICY_URL_MAX,
                `URL must be at most ${INSTITUTIONAL_POLICY_URL_MAX} characters`
            )
    })
    .refine(
        (d) => {
            const start = new Date(d.startDate);
            const sub = new Date(d.submissionDate);
            return !Number.isNaN(start.getTime()) && sub > start;
        },
        { message: 'Submission must be after start', path: ['submissionDate'] }
    )
    .superRefine((d, ctx) => {
        const label = d.institutionalPolicyLabel.trim();
        const url = d.institutionalPolicyUrl.trim();
        if (!label && !url) {
            return;
        }
        if (!label) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Link text is required when a URL is provided',
                path: ['institutionalPolicyLabel']
            });
        }
        if (!url) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'URL is required when link text is provided',
                path: ['institutionalPolicyUrl']
            });
        } else if (!institutionalPolicyUrlPattern.test(url)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'URL must start with http:// or https://',
                path: ['institutionalPolicyUrl']
            });
        }
    });

type FormValues = z.infer<typeof schema>;

function createDefaultFormValues(): FormValues {
    const institution = getInstitutionAiPolicy();
    return {
        programme: '',
        module: '',
        title: '',
        lecturer: '',
        startDate: '',
        submissionDate: '',
        individualGroup: 'Individual',
        institutionalPolicyLabel: institution.label,
        institutionalPolicyUrl: institution.url
    };
}

export function BriefDetailsPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState<LocalBriefRecord | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        mode: 'onChange',
        defaultValues: createDefaultFormValues()
    });

    useEffect(() => {
        if (mode === 'edit' && id) {
            void getBrief(id).then((b) => {
                if (!b) {
                    toast.error('Brief not found');
                    navigate(OFFLINE_ROUTES.dashboard);
                    return;
                }
                setRecord(b);
                form.reset(metadataToForm(b));
            });
        }
    }, [mode, id, form, navigate]);

    const onSubmit = form.handleSubmit(async (values) => {
        try {
            const metadata = metadataFromForm(values);
            if (mode === 'create') {
                const created = await createBrief(metadata);
                toast.success('Brief created');
                navigate(`/briefs/${created.id}/builder`);
                return;
            }
            if (!record) return;
            const updated: LocalBriefRecord = {
                ...record,
                metadata,
                updatedAt: new Date().toISOString()
            };
            const result = await writeBrief(updated, record.revision);
            if (!result.ok) {
                toast.error('Could not save details');
                return;
            }
            toast.success('Details saved');
            navigate(`/briefs/${record.id}/builder`);
        } catch {
            toast.error('Invalid form data');
        }
    });

    const backHref =
        mode === 'edit' && id
            ? OFFLINE_ROUTES.briefBuilder(id)
            : OFFLINE_ROUTES.dashboard;

    const {
        institutionalPolicyLabel: institutionalPolicyLabelError,
        institutionalPolicyUrl: institutionalPolicyUrlError
    } = form.formState.errors;

    return (
        <div className='flex flex-1 flex-col px-4 py-8 sm:px-6'>
            <div className='mx-auto max-w-2xl'>
                <Button variant='ghost' className='mb-4' asChild>
                    <Link to={backHref}>← Back</Link>
                </Button>
                <h1 className='text-2xl font-extralight tracking-tight'>
                    {mode === 'create' ? 'Create brief' : 'Edit details'}
                </h1>
                <form onSubmit={(e) => void onSubmit(e)} className='mt-8 space-y-6'>
                    <div className='space-y-2'>
                        <Label htmlFor='programme'>Programme</Label>
                        <Input id='programme' {...form.register('programme')} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='module'>Module</Label>
                        <Input id='module' {...form.register('module')} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='title'>Assignment title</Label>
                        <Input id='title' {...form.register('title')} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='lecturer'>Lecturer(s)</Label>
                        <Textarea id='lecturer' {...form.register('lecturer')} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='startDate'>Start date</Label>
                        <Input
                            id='startDate'
                            type='date'
                            {...form.register('startDate')}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='submissionDate'>Submission date and time</Label>
                        <Input
                            id='submissionDate'
                            type='datetime-local'
                            {...form.register('submissionDate')}
                        />
                    </div>
                    <IndividualGroupField
                        value={form.watch('individualGroup')}
                        onChange={(v) =>
                            form.setValue('individualGroup', v, {
                                shouldValidate: true
                            })
                        }
                    />
                    <fieldset className='space-y-4 border-t border-foreground/10 pt-6'>
                        <legend className='text-sm font-normal'>
                            Institutional policy
                        </legend>
                        <p className='text-xs font-light text-muted-foreground'>
                            Optional link shown in the student brief footer.
                        </p>
                        <div className='space-y-2'>
                            <Label htmlFor='institutionalPolicyLabel'>
                                Link text
                            </Label>
                            <Input
                                id='institutionalPolicyLabel'
                                {...form.register('institutionalPolicyLabel')}
                            />
                            {institutionalPolicyLabelError ? (
                                <p className='text-sm text-destructive'>
                                    {institutionalPolicyLabelError.message}
                                </p>
                            ) : null}
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='institutionalPolicyUrl'>URL</Label>
                            <Input
                                id='institutionalPolicyUrl'
                                type='url'
                                placeholder='https://'
                                {...form.register('institutionalPolicyUrl')}
                            />
                            {institutionalPolicyUrlError ? (
                                <p className='text-sm text-destructive'>
                                    {institutionalPolicyUrlError.message}
                                </p>
                            ) : null}
                        </div>
                    </fieldset>
                    <Button type='submit' disabled={!form.formState.isValid}>
                        {mode === 'create' ? 'Continue to builder' : 'Save and open builder'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
