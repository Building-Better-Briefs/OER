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
    metadataFromForm,
    metadataToForm,
    writeBrief,
    type LocalBriefRecord
} from '@/lib/brief-store';
import { IndividualGroupPresetTabs } from '@/components/individual-group-field';
import { toast } from 'sonner';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';

const schema = z
    .object({
        programme: z.string().trim().min(1, 'Programme is required'),
        module: z.string().trim().min(1, 'Module is required'),
        title: z.string().trim().min(1, 'Title is required'),
        lecturer: z.string().trim().min(1, 'Lecturer is required'),
        startDate: z.string().min(1, 'Start date is required'),
        submissionDate: z.string().min(1, 'Submission date is required'),
        individualGroup: z.string().trim().min(1, 'Required')
    })
    .refine(
        (d) => {
            const start = new Date(d.startDate);
            const sub = new Date(d.submissionDate);
            return !Number.isNaN(start.getTime()) && sub > start;
        },
        { message: 'Submission must be after start', path: ['submissionDate'] }
    );

type FormValues = z.infer<typeof schema>;

export function BriefDetailsPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState<LocalBriefRecord | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        mode: 'onChange',
        defaultValues: {
            programme: '',
            module: '',
            title: '',
            lecturer: '',
            startDate: '',
            submissionDate: '',
            individualGroup: 'Individual'
        }
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

    return (
        <div className='flex flex-1 flex-col px-4 py-8 sm:px-6'>
            <div className='mx-auto max-w-2xl'>
                <Button variant='ghost' className='mb-4' asChild>
                    <Link to={OFFLINE_ROUTES.dashboard}>← Back</Link>
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
                    <IndividualGroupPresetTabs
                        value={form.watch('individualGroup')}
                        onChange={(v) =>
                            form.setValue('individualGroup', v, {
                                shouldValidate: true
                            })
                        }
                    />
                    <Button type='submit' disabled={!form.formState.isValid}>
                        {mode === 'create' ? 'Continue to builder' : 'Save and open builder'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
