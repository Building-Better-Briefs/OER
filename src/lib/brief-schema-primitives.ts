import { z } from 'zod';

export const textField = (max: number) =>
    z.string().max(max).optional().default('');

export const richTextSchema = z.union([
    z.string().max(50_000),
    z.array(z.record(z.string(), z.unknown())).max(200)
]);

export type RichTextSchemaValue = z.infer<typeof richTextSchema>;
