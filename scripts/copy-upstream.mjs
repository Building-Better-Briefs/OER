#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const offlineSrc = path.join(repoRoot, 'offline/src');

const manifest = JSON.parse(
    execSync('node offline/scripts/trace-upstream.mjs', {
        cwd: repoRoot,
        encoding: 'utf8'
    })
);

const skipCopy = new Set([
    'src/lib/institution-config.ts',
    'src/hooks/use-student-draft-sync.ts',
    'src/lib/brief-section-tracking.ts',
    'src/lib/brief-viewer-actions.ts',
    'src/app/briefs/viewer/[slug]/brief-viewer-context.tsx',
    'src/app/briefs/viewer/[slug]/brief-viewer-settings.ts',
    'src/lib/checklist-storage.ts',
    'src/lib/submission-form-storage.ts',
    'src/components/brief-review-notice.tsx',
    'src/lib/builder-preview-preference.ts'
]);

function destPath(rel) {
    if (rel.startsWith('src/app/briefs/[id]/builder/')) {
        return path.join(
            offlineSrc,
            'builder',
            rel.replace('src/app/briefs/[id]/builder/', '')
        );
    }
    if (rel.startsWith('src/components/')) {
        return path.join(offlineSrc, 'components', rel.slice('src/components/'.length));
    }
    if (rel.startsWith('src/lib/')) {
        return path.join(offlineSrc, 'lib', rel.slice('src/lib/'.length));
    }
    if (rel.startsWith('src/hooks/')) {
        return path.join(offlineSrc, 'hooks', rel.slice('src/hooks/'.length));
    }
    return path.join(offlineSrc, rel.replace(/^src\//, ''));
}

function rewrite(content, rel) {
    let out = content;
    out = out.replace(/from 'next\/link'/g, "from '@/components/app-link'");
    out = out.replace(/from "next\/link"/g, 'from "@/components/app-link"');
    out = out.replace(/import NextLink from 'next\/link'/g, "import { AppLink as NextLink } from '@/components/app-link'");
    out = out.replace(/import Link from 'next\/link'/g, "import { AppLink as Link } from '@/components/app-link'");
    out = out.replace(/'use client';\n\n/g, '');
    out = out.replace(/^'use client';\r?\n/m, '');
    if (rel.includes('builder-left-panel')) {
        out = out.replace(/import \{ getUserRubrics \} from '@\/app\/actions';\n/, '');
        out = out.replace(/import \{ CollaboratorsDialog \} from '\.\/collaborators-dialog';\n/, '');
        out = out.replace(/import \{ BuilderExampleFeedbackFormEditorLoader \} from '\.\/builder-example-feedback-form-editor';\n/, '');
        out = out.replace(/import \{ AiFeatureDisabledHint \} from '@\/components\/ai-feature-disabled-hint';\n/, '');
    }
    return out;
}

fs.mkdirSync(offlineSrc, { recursive: true });
const copied = [];

for (const rel of manifest.files) {
    if (skipCopy.has(rel)) continue;
    const src = path.join(repoRoot, rel);
    const dest = destPath(rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let content = fs.readFileSync(src, 'utf8');
    content = rewrite(content, rel);
    fs.writeFileSync(dest, content);
    copied.push({ upstream: rel, offline: path.relative(path.join(repoRoot, 'offline'), dest) });
}

fs.writeFileSync(
    path.join(repoRoot, 'offline/copied-manifest.json'),
    JSON.stringify({ copied, skipped: [...skipCopy] }, null, 2)
);

console.log(`Copied ${copied.length} files to offline/src`);
