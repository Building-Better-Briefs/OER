import type { BriefsContentBlock } from '@/content/building-better-briefs';

type Props = {
    blocks: BriefsContentBlock[];
    className?: string;
};

export function BuildingBetterBriefsSections({ blocks, className }: Props) {
    return (
        <div className={`space-y-8 ${className ?? ''}`}>
            {blocks.map((block) => (
                <section
                    key={block.id}
                    className='space-y-3'
                    aria-labelledby={
                        block.title ? `bbb-${block.id}` : undefined
                    }>
                    {block.title ? (
                        <h3
                            id={`bbb-${block.id}`}
                            className={
                                block.id === 'lead'
                                    ? 'text-xl font-normal tracking-tight text-foreground sm:text-2xl'
                                    : 'text-base font-normal tracking-tight text-foreground'
                            }>
                            {block.title}
                        </h3>
                    ) : null}
                    {block.paragraphs?.map((paragraph, i) => (
                        <p
                            key={`${block.id}-p-${i}`}
                            className='text-sm font-light leading-relaxed text-muted-foreground'>
                            {paragraph}
                        </p>
                    ))}
                    {block.bullets?.length ? (
                        <ul className='list-disc space-y-1 pl-5 text-sm font-light leading-relaxed text-muted-foreground'>
                            {block.bullets.map((item, i) => (
                                <li key={`${block.id}-b-${i}`}>{item}</li>
                            ))}
                        </ul>
                    ) : null}
                    {block.links?.length ? (
                        <ul className='space-y-2 text-sm font-light'>
                            {block.links.map((link, i) => (
                                <li key={`${block.id}-l-${i}`}>
                                    {link.external || link.href.startsWith('http') ? (
                                        <a
                                            href={link.href}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-muted-foreground underline underline-offset-2 hover:text-foreground'>
                                            {link.label}
                                        </a>
                                    ) : (
                                        <a
                                            href={link.href}
                                            className='text-muted-foreground underline underline-offset-2 hover:text-foreground'>
                                            {link.label}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </section>
            ))}
        </div>
    );
}
