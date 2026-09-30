import React, { useEffect, useMemo, useState } from 'react';
import { Plate, PlateContent, usePlateEditor } from 'platejs/react';
import { BoldPlugin, ItalicPlugin } from '@platejs/basic-nodes/react';
import {
    indentList,
    ListStyleType,
    outdentList,
    someList,
    toggleList
} from '@platejs/list';
import { LinkPlugin } from '@platejs/link/react';
import {
    Bold,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListOrdered
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParagraphHeadingKit } from '@/components/editor/plugins/basic-blocks-kit';
import { ListKit } from '@/components/editor/plugins/list-kit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { LinkElement } from '@/components/ui/link-node';
import { normalizeRichTextValue, RichTextValue } from '@/lib/rich-text-utils';

interface RichTextPlateEditorProps {
    value: unknown;
    onChange: (value: RichTextValue) => void;
    placeholder?: string;
    className?: string;
    /** When true, enables H1–H6 blocks (markdown `#` … `######`, toolbar + mod+alt+1–6). */
    allowHeadings?: boolean;
}

export function RichTextPlateEditor({
    value,
    onChange,
    placeholder,
    className,
    allowHeadings = false
}: RichTextPlateEditorProps) {
    const normalizedValue = useMemo(
        () => normalizeRichTextValue(value),
        [value]
    );

    const editor = usePlateEditor({
        plugins: [
            ...(allowHeadings ? ParagraphHeadingKit : []),
            BoldPlugin,
            ItalicPlugin,
            ...ListKit,
            LinkPlugin.withComponent(LinkElement)
        ],
        value: normalizedValue as never
    });

    // usePlateEditor only memoizes on id/enabled/deps — value updates (e.g. AI generate) must be pushed in.
    useEffect(() => {
        if (!editor) return;
        const nextJson = JSON.stringify(normalizedValue);
        const curJson = JSON.stringify(editor.children);
        if (nextJson === curJson) return;
        editor.tf.setValue(normalizedValue as never);
    }, [editor, normalizedValue]);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkText, setLinkText] = useState('link');
    const [savedSelection, setSavedSelection] = useState<unknown>(null);

    const handleInsertLink = () => {
        if (!linkUrl.trim()) return;
        editor.tf.focus();
        if (savedSelection) {
            editor.tf.select(savedSelection as never);
        }
        editor.tf.insertNodes({
            type: 'a',
            url: linkUrl.trim(),
            children: [{ text: linkText.trim() || 'link' }]
        });
        setIsLinkDialogOpen(false);
        setLinkUrl('');
        setLinkText('link');
        setSavedSelection(null);
    };

    return (
        <div className='space-y-2'>
            <div className='flex flex-wrap justify-end gap-1 mt-2'>
                {allowHeadings && (
                    <>
                        <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            title='Heading 1'
                            onMouseDown={(e) => {
                                e.preventDefault();
                                editor.tf.focus();
                                editor.tf.h1.toggle();
                            }}
                            className='h-7 text-xs font-light px-2'>
                            <Heading1 className='h-3 w-3' />
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            title='Heading 2'
                            onMouseDown={(e) => {
                                e.preventDefault();
                                editor.tf.focus();
                                editor.tf.h2.toggle();
                            }}
                            className='h-7 text-xs font-light px-2'>
                            <Heading2 className='h-3 w-3' />
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            title='Heading 3'
                            onMouseDown={(e) => {
                                e.preventDefault();
                                editor.tf.focus();
                                editor.tf.h3.toggle();
                            }}
                            className='h-7 text-xs font-light px-2'>
                            <Heading3 className='h-3 w-3' />
                        </Button>
                    </>
                )}
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onMouseDown={(e) => {
                        e.preventDefault();
                        editor.tf.focus();
                        toggleList(editor, { listStyleType: ListStyleType.Disc });
                    }}
                    className='h-7 text-xs font-light px-2'>
                    <List className='h-3 w-3' />
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onMouseDown={(e) => {
                        e.preventDefault();
                        editor.tf.focus();
                        toggleList(editor, {
                            listStyleType: ListStyleType.Decimal
                        });
                    }}
                    className='h-7 text-xs font-light px-2'>
                    <ListOrdered className='h-3 w-3' />
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onMouseDown={(e) => {
                        e.preventDefault();
                        editor.tf.focus();
                        editor.tf.bold.toggle();
                    }}
                    className='h-7 text-xs font-light px-2'>
                    <Bold className='h-3 w-3' />
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onMouseDown={(e) => {
                        e.preventDefault();
                        editor.tf.focus();
                        editor.tf.italic.toggle();
                    }}
                    className='h-7 text-xs font-light px-2'>
                    <Italic className='h-3 w-3' />
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const selectedText = window
                            .getSelection()
                            ?.toString()
                            .trim();
                        setLinkText(selectedText || 'link');
                        setSavedSelection(editor.selection);
                        setIsLinkDialogOpen(true);
                    }}
                    className='h-7 text-xs font-light px-2'>
                    <Link className='h-3 w-3' />
                    Link
                </Button>
            </div>
            <Plate
                editor={editor}
                onChange={(event: { value?: unknown }) => {
                    onChange(normalizeRichTextValue(event?.value));
                }}>
                <PlateContent
                    placeholder={placeholder}
                    onKeyDown={(e) => {
                        if (e.key !== 'Tab') return;

                        const isInsideList = someList(editor, [
                            ListStyleType.Disc,
                            ListStyleType.Circle,
                            ListStyleType.Square,
                            ListStyleType.Decimal,
                            ListStyleType.LowerAlpha,
                            ListStyleType.UpperAlpha,
                            ListStyleType.LowerRoman,
                            ListStyleType.UpperRoman
                        ]);

                        if (!isInsideList) return;

                        e.preventDefault();

                        if (e.shiftKey) {
                            outdentList(editor);
                            return;
                        }

                        indentList(editor);
                    }}
                    className={`${className ?? ''} [&_strong]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5`}
                />
            </Plate>
            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className='font-normal'>
                            Insert Link
                        </DialogTitle>
                        <DialogDescription className='font-light'>
                            Add a link to the selected text or insert a new one.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3'>
                        <div className='space-y-2'>
                            <Label htmlFor='link-text' className='font-light'>
                                Link Text
                            </Label>
                            <Input
                                id='link-text'
                                value={linkText}
                                onChange={(e) => setLinkText(e.target.value)}
                                placeholder='e.g. View brief guidance'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='link-url' className='font-light'>
                                URL
                            </Label>
                            <Input
                                id='link-url'
                                autoFocus={linkText.trim() !== 'link'}
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder='https://example.com'
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setIsLinkDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type='button' onClick={handleInsertLink}>
                            Insert Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
