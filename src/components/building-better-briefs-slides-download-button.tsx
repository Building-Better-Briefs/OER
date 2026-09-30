import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    BUILDING_BETTER_BRIEFS_PDF_FILENAME,
    BUILDING_BETTER_BRIEFS_PDF_URL
} from '@/lib/offline-routes';

export function BuildingBetterBriefsSlidesDownloadButton() {
    return (
        <Button variant='outline' asChild>
            <a
                href={BUILDING_BETTER_BRIEFS_PDF_URL}
                download={BUILDING_BETTER_BRIEFS_PDF_FILENAME}>
                <FileDown className='size-4' aria-hidden />
                Download the Slides
            </a>
        </Button>
    );
}
