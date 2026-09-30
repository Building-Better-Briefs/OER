import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getUserDisplayLabel } from '@/lib/user-display';
import { cn } from '@/lib/utils';

export type CollaboratorCandidate = {
    id: number;
    email: string;
    username: string;
    displayName: string | null;
};

export function CollaboratorEmailAutocomplete({
    email,
    onEmailChange,
    onSelect,
    disabled,
    inputId = 'collaborator-email',
    listId = 'collaborator-email-suggestions',
    searchCandidates,
    className,
    inputClassName
}: {
    email: string;
    onEmailChange: (value: string) => void;
    onSelect: (candidate: CollaboratorCandidate) => void;
    disabled?: boolean;
    inputId?: string;
    listId?: string;
    searchCandidates: (query: string) => Promise<CollaboratorCandidate[]>;
    className?: string;
    inputClassName?: string;
}) {
    const [candidates, setCandidates] = useState<CollaboratorCandidate[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset results whenever the query becomes too short to search.
    // Adjusted during render instead of in an effect — self-terminating
    // (once reset, the condition holds until email changes again) and
    // faithfully replicates the previous effect's dependency comparison.
    const [prevAutocompleteDeps, setPrevAutocompleteDeps] = useState([
        email,
        searchCandidates
    ]);
    if (
        email !== prevAutocompleteDeps[0] ||
        searchCandidates !== prevAutocompleteDeps[1]
    ) {
        setPrevAutocompleteDeps([email, searchCandidates]);
        if (email.trim().length < 2) {
            setCandidates([]);
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
    }

    useEffect(() => {
        const trimmed = email.trim();
        if (trimmed.length < 2) {
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            setIsSearching(true);
            try {
                const users = await searchCandidates(trimmed);
                setCandidates(users);
                setIsOpen(users.length > 0);
                setHighlightedIndex(users.length > 0 ? 0 : -1);
            } catch {
                setCandidates([]);
                setIsOpen(false);
                setHighlightedIndex(-1);
            } finally {
                setIsSearching(false);
            }
        }, 250);

        return () => window.clearTimeout(timeoutId);
    }, [email, searchCandidates]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () =>
            document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const selectCandidate = (candidate: CollaboratorCandidate) => {
        onSelect(candidate);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    return (
        <div
            ref={containerRef}
            className={cn('relative min-w-0 flex-1', className)}>
            <Input
                id={inputId}
                type='text'
                role='combobox'
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-autocomplete='list'
                placeholder='Name or email'
                value={email}
                autoComplete='off'
                disabled={disabled}
                className={inputClassName}
                onChange={(event) => {
                    onEmailChange(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => {
                    if (candidates.length > 0) {
                        setIsOpen(true);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && isOpen && highlightedIndex >= 0) {
                        event.preventDefault();
                        const candidate = candidates[highlightedIndex];
                        if (candidate) {
                            selectCandidate(candidate);
                        }
                        return;
                    }

                    if (!isOpen || candidates.length === 0) {
                        return;
                    }

                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setHighlightedIndex((current) =>
                            current < candidates.length - 1 ? current + 1 : 0
                        );
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setHighlightedIndex((current) =>
                            current > 0 ? current - 1 : candidates.length - 1
                        );
                    } else if (event.key === 'Escape') {
                        setIsOpen(false);
                    }
                }}
            />

            {isOpen && (
                <ul
                    id={listId}
                    role='listbox'
                    className='absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md'>
                    {isSearching ? (
                        <li className='px-3 py-2 text-sm text-muted-foreground'>
                            Searching…
                        </li>
                    ) : candidates.length === 0 ? (
                        <li className='px-3 py-2 text-sm text-muted-foreground'>
                            No matching users found
                        </li>
                    ) : (
                        candidates.map((candidate, index) => {
                            const label = getUserDisplayLabel(candidate);
                            const showEmail =
                                candidate.displayName?.trim() &&
                                label !== candidate.email;

                            return (
                                <li
                                    key={candidate.id}
                                    role='option'
                                    aria-selected={index === highlightedIndex}
                                    className={cn(
                                        'cursor-pointer px-3 py-2 text-sm',
                                        index === highlightedIndex
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent hover:text-accent-foreground'
                                    )}
                                    onMouseEnter={() =>
                                        setHighlightedIndex(index)
                                    }
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        selectCandidate(candidate);
                                    }}>
                                    <span className='block truncate font-medium'>
                                        {label}
                                    </span>
                                    {showEmail ? (
                                        <span className='block truncate text-xs text-muted-foreground'>
                                            {candidate.email}
                                        </span>
                                    ) : null}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
