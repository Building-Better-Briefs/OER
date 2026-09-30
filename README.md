# Building Better Briefs (Offline)

**A UDL Approach to Transparent and Inclusive Assessment**

HEA Open Education: Supporting Policy and Practice.

Institute of Art, Design + Technology, Ireland · Published 2026

## About this project

An open educational resource for higher education staff who design assessment briefs. It provides a structured approach to writing clear, consistent and accessible briefs, aligning learning outcomes, assessment tasks and assessment criteria. It includes reusable guidance and a brief template that can be adapted across disciplines.

Developed with support from the IADT Teaching and Learning Office.

This SATLE-supported project explores how assessment briefs can become clearer, more accessible and easier to use. The OER combines research-informed guidance with a **brief builder that runs locally in a web browser**—no account, no backend, and no student information sent to an external server.

Authors: Stefan Paz Berrios and Mohammed Cherbatji.

### Funding and licence

Funded through the Strategic Alignment of Teaching and Learning Enhancement Funding (SATLE), administered by the Higher Education Authority and the National Forum for the Enhancement of Teaching and Learning in Higher Education.

Educational materials (presentation, written guidance, reusable brief template) are licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Software source code is licensed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html). IADT branding and third-party material are excluded from the CC licence scope.

A full project overview PDF is included in the app: [`public/BuildingBetterBriefs.pdf`](public/BuildingBetterBriefs.pdf) (also linked from the homepage as **Download the PDF**).

## Using the app

| Route | Purpose |
|-------|---------|
| `#/` | Project homepage (summary, Read more, PDF download, **Use the brief builder**) |
| `#/dashboard` | Your briefs — create, edit, duplicate, export/import JSON backup |

Briefs are stored in this browser (IndexedDB, database name `abb-offline`). Use **Export all briefs** on the dashboard regularly so you can move work between devices or recover after clearing browser data.

Install as a PWA where your browser supports it; the service worker caches the app for offline use after the first load.