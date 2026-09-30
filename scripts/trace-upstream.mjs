#!/usr/bin/env node
/**
 * Trace client-side modules reachable from offline entry points (no @/app/actions).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const entries = [
    'src/app/briefs/[id]/builder/builder-panels-layout.tsx',
    'src/app/briefs/[id]/builder/brief-builder-context.tsx',
    'src/app/briefs/[id]/builder/builder-left-panel.tsx',
    'src/app/briefs/[id]/builder/builder-right-panel.tsx',
    'src/app/briefs/[id]/builder/builder-ai-policy-editor.tsx',
    'src/app/briefs/[id]/builder/builder-assignment-settings.tsx',
    'src/app/briefs/[id]/builder/builder-assignment-logs-designer.tsx',
    'src/app/briefs/[id]/builder/builder-custom-subsections.tsx',
    'src/app/briefs/[id]/builder/builder-self-assessment-link-option.tsx',
    'src/app/briefs/[id]/builder/interaction-reset.tsx',
    'src/components/brief-preview-content.tsx',
    'src/components/brief-pdf-document.tsx',
    'src/components/grading-pdf-document.tsx',
    'src/components/student-assignment-log-pdf-document.tsx',
    'src/components/rich-text-plate-editor.tsx',
    'src/components/rubric-section-editor.tsx',
    'src/components/individual-group-field.tsx',
    'src/components/brief-ai-policy-preview.tsx',
    'src/lib/brief-template.ts',
    'src/lib/brief-content-schema.ts',
    'src/lib/templates.ts'
];

const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const skipSpecs = new Set(['@/app/actions']);

function resolveFrom(from, spec) {
    if (skipSpecs.has(spec)) return null;
    let base;
    if (spec.startsWith('@/')) {
        base = path.join(repoRoot, 'src', spec.slice(2));
    } else if (spec.startsWith('.')) {
        base = path.join(path.dirname(from), spec);
    } else {
        return null;
    }
    for (const e of exts) {
        const p = base + e;
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
}

const re =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const dyn = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const seen = new Set();
const queue = entries.map((e) => path.join(repoRoot, e));

while (queue.length) {
    const f = queue.shift();
    if (!f || seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    const specs = [];
    for (const m of src.matchAll(re)) {
        if (m[1].startsWith('type ')) continue;
        specs.push(m[1]);
    }
    for (const m of src.matchAll(dyn)) specs.push(m[1]);
    for (const spec of specs) {
        const r = resolveFrom(f, spec);
        if (r) queue.push(r);
    }
}

const files = [...seen]
    .filter((f) => f.startsWith(path.join(repoRoot, 'src')))
    .map((f) => path.relative(repoRoot, f))
    .sort();

console.log(JSON.stringify({ count: files.length, files }, null, 2));
