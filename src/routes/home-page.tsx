import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BuildingBetterBriefsSections } from '@/components/building-better-briefs-sections';
import { BuildingBetterBriefsReadMoreSheet } from '@/components/building-better-briefs-read-more-sheet';
import { blocksForSummary } from '@/content/building-better-briefs';
import { requestPersistentStorage } from '@/lib/brief-store';
import {
    BUILDING_BETTER_BRIEFS_PDF_FILENAME,
    BUILDING_BETTER_BRIEFS_PDF_URL,
    OFFLINE_ROUTES
} from '@/lib/offline-routes';

export function HomePage() {
    const [readMoreOpen, setReadMoreOpen] = useState(false);

    return (
        <div className='flex flex-1 flex-col px-4 py-8 sm:px-6'>
            <div className='mx-auto w-full max-w-[80rem]'>
                <BuildingBetterBriefsSections blocks={blocksForSummary()} />

                <div className='mt-8 flex flex-wrap gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => setReadMoreOpen(true)}>
                        Read more
                    </Button>
                    <Button variant='outline' asChild>
                        <a
                            href={BUILDING_BETTER_BRIEFS_PDF_URL}
                            download={BUILDING_BETTER_BRIEFS_PDF_FILENAME}>
                            Download the PDF
                        </a>
                    </Button>
                    <Button asChild>
                        <Link
                            to={OFFLINE_ROUTES.dashboard}
                            onClick={() => void requestPersistentStorage()}>
                            Use the brief builder
                        </Link>
                    </Button>
                </div>
            </div>

            <BuildingBetterBriefsReadMoreSheet
                open={readMoreOpen}
                onOpenChange={setReadMoreOpen}
            />
        </div>
    );
}
