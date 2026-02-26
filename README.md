# Logos Continuum (Local)

This workspace runs Logos Continuum locally with:

- Frontend: Next.js app in `logos-web`
- Backend API + parser: Flask app in `verbatim-parser `

> Note: the backend folder name currently includes a trailing space: `verbatim-parser `.
> Always quote that path in shell commands.

## Requirements

- macOS/Linux shell
- Node.js 18 LTS (recommended)
- Python 3.9+

## Install

From the workspace root (`Logos backup`):

### 1) Backend install

```bash
cd "./verbatim-parser "
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Frontend install

```bash
cd "./logos-web"
yarn install
```

If Yarn is unavailable, use npm:

```bash
npm install
```

## Run

### Start backend + frontend together

From workspace root:

```bash
./start.sh
```

Open:

- Frontend UI: http://localhost:3000
- Backend API: http://localhost:5001

### Start manually (optional)

Backend:

```bash
cd "./verbatim-parser "
source .venv/bin/activate
PORT=5001 python3 api.py
```

Frontend:

```bash
cd "./logos-web"
yarn dev
```

## Current UI usage

## Home page (`/`)

1. **Search box**: type a query and press **Search** to open the query page.
2. **Upload DOCX to parse now**:
	- Drag/drop `.docx` files or click to choose files
	- Files are uploaded to backend `local_docs/uploaded_docs`
	- Files are parsed immediately and indexed
	- Parsing output appears in the details box
3. **Parser Settings**: configure parser behavior used by API uploads/indexing:
	- `use_parallel_processing`
	- `parser_card_workers`
	- `local_parser_file_workers`
	- `flush_enabled`
	- `flush_every_docs`
4. **Manage Documents**:
	- View indexed + uploaded files
	- Search documents
	- Remove a document from index only
	- Delete uploaded file from folder
	- Bulk select + delete selected docs
5. **Clear Parsed Cards**:
	- Clear parsed cards from index
	- Optionally delete uploaded `.docx` files too

## Query page (`/query`)

1. **Search**: run term search from the top input.
2. **Advanced Search**: use **Search by cite...** for cite matching.
3. **Results list**:
	- Infinite scrolling loads more results automatically
	- Click a result to open full card details
4. **Card actions**:
	- **Edit** the selected card
	- **Copy** card content
	- **Export Saved Edits (N)** exports saved edits to DOCX
	- **StyleSelect** changes copy/export styling
5. **Saved edits behavior**:
	- Card edits are persisted in browser `localStorage`
	- Export includes saved edits and resolved source document labels

## Data and local files

- Search index file: `verbatim-parser /local_docs/cards_index.json`
- Uploaded docs folder: `verbatim-parser /local_docs/uploaded_docs`
- Parser settings file: `verbatim-parser /local_docs/parser_settings.json`

When the backend starts and the index is empty, it auto-indexes local `.docx` files under `local_docs`.

## Useful backend commands

From `verbatim-parser ` with `.venv` active:

```bash
# Parse local docs in batch
python3 local_parser.py

# Profile parser + set card workers
PARSER_PROFILE=1 PARSER_CARD_WORKERS=4 python3 local_parser.py

# Clear local index file
python3 wipe.py
```

## Credits

Based on [tvergho/logos-web](https://github.com/tvergho/logos-web), adapted for local/offline use.