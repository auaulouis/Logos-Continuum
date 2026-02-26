import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as apiService from '../services/api';
import type { ParsedDocument, ParserSettings } from '../services/api';
import { AppContext } from '../lib/appContext';
import styles from '../styles/settings.module.scss';
import indexStyles from '../styles/index.module.scss';

type MessageLevel = 'info' | 'error';

const DEFAULT_PARSER_SETTINGS: ParserSettings = {
  use_parallel_processing: true,
  parser_card_workers: 1,
  local_parser_file_workers: 4,
  flush_enabled: true,
  flush_every_docs: 250,
};

const SettingsPage = () => {
  const { theme, toggleTheme } = useContext(AppContext);
  const [message, setMessage] = useState('');
  const [messageLevel, setMessageLevel] = useState<MessageLevel>('info');

  const [clearIndexSelected, setClearIndexSelected] = useState(true);
  const [clearFilesSelected, setClearFilesSelected] = useState(false);
  const [isClearingIndex, setIsClearingIndex] = useState(false);

  const [parserSettings, setParserSettings] = useState<ParserSettings>(DEFAULT_PARSER_SETTINGS);
  const [parserSettingsError, setParserSettingsError] = useState('');
  const [isSavingParserSettings, setIsSavingParserSettings] = useState(false);

  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [documentsError, setDocumentsError] = useState('');
  const [documentsSearch, setDocumentsSearch] = useState('');
  const [showHiddenDocuments, setShowHiddenDocuments] = useState(false);
  const [isDocumentsBoxOpen, setIsDocumentsBoxOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [deleteInProgressKey, setDeleteInProgressKey] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);

  const updateMessage = (text: string, level: MessageLevel = 'info') => {
    setMessage(text);
    setMessageLevel(level);
  };

  const loadParserSettings = useCallback(async () => {
    setParserSettingsError('');
    try {
      const response = await apiService.getParserSettings();
      setParserSettings(response.settings);
    } catch {
      setParserSettingsError('Failed to load parser settings.');
    }
  }, []);

  const loadParsedDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    setDocumentsError('');
    try {
      const response = await apiService.getParsedDocuments();
      const docs = Array.isArray(response.documents) ? response.documents : [];
      docs.sort((a, b) => a.filename.localeCompare(b.filename));
      setDocuments(docs);
    } catch {
      setDocumentsError('Failed to load parsed documents.');
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParserSettings();
    loadParsedDocuments();
  }, [loadParserSettings, loadParsedDocuments]);

  const onSaveParserSettings = async () => {
    setIsSavingParserSettings(true);
    setParserSettingsError('');
    try {
      const payload: ParserSettings = {
        use_parallel_processing: !!parserSettings.use_parallel_processing,
        parser_card_workers: Math.max(1, Number(parserSettings.parser_card_workers) || 1),
        local_parser_file_workers: Math.max(1, Number(parserSettings.local_parser_file_workers) || 1),
        flush_enabled: !!parserSettings.flush_enabled,
        flush_every_docs: Math.max(1, Number(parserSettings.flush_every_docs) || 1),
      };
      const response = await apiService.updateParserSettings(payload);
      setParserSettings(response.settings);
      updateMessage('Parser settings saved.');
    } catch {
      setParserSettingsError('Failed to save parser settings.');
      updateMessage('Failed to save parser settings.', 'error');
    } finally {
      setIsSavingParserSettings(false);
    }
  };

  const onConfirmClearIndex = async () => {
    if (!clearIndexSelected && !clearFilesSelected) {
      return;
    }

    setIsClearingIndex(true);
    try {
      const actionNotes: string[] = [];
      let deletedFiles = 0;
      let failedFileDeletes = 0;

      if (clearIndexSelected) {
        await apiService.clearIndex();
        actionNotes.push('index cleared');
      }

      if (clearFilesSelected) {
        const response = await apiService.getParsedDocuments();
        const docs = Array.isArray(response.documents) ? response.documents : [];
        for (const document of docs) {
          if (!document.in_folder) continue;
          try {
            await apiService.deleteParsedDocument(document.filename, 'folder');
            deletedFiles += 1;
          } catch {
            failedFileDeletes += 1;
          }
        }
        actionNotes.push(`deleted ${deletedFiles} .docx file(s)`);
      }

      updateMessage(`${actionNotes.join(' + ')}${failedFileDeletes > 0 ? ` (${failedFileDeletes} file deletions failed)` : ''}`);
      await loadParsedDocuments();
    } catch {
      updateMessage('Failed to run clear action.', 'error');
    } finally {
      setIsClearingIndex(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const queryText = documentsSearch.trim().toLowerCase();
    return documents.filter((document) => {
      if (!showHiddenDocuments && !document.in_index) {
        return false;
      }
      if (!queryText) {
        return true;
      }
      return document.filename.toLowerCase().includes(queryText);
    });
  }, [documents, documentsSearch, showHiddenDocuments]);

  const onDeleteDocument = async (document: ParsedDocument, target: 'index' | 'folder') => {
    const actionKey = `${document.filename}:${target}`;
    setDeleteInProgressKey(actionKey);
    try {
      await apiService.deleteParsedDocument(document.filename, target);
      updateMessage(
        target === 'index'
          ? `Removed ${document.filename} from parsed index.`
          : `Removed ${document.filename} from uploaded docs folder.`,
      );
      await loadParsedDocuments();
    } catch {
      setDocumentsError('Failed to delete document for selected target.');
      updateMessage('Delete failed for selected document.', 'error');
    } finally {
      setDeleteInProgressKey(null);
    }
  };

  const toggleSelectedDocument = (filename: string) => {
    setSelectedDocuments((prev) => {
      if (prev.includes(filename)) {
        return prev.filter((item) => item !== filename);
      }
      return [...prev, filename];
    });
  };

  const onToggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedDocuments([]);
  };

  const onSelectAllVisible = () => {
    const visibleNames = filteredDocuments.map((document) => document.filename);
    setSelectedDocuments((prev) => {
      const areAllSelected = visibleNames.length > 0 && visibleNames.every((name) => prev.includes(name));
      if (areAllSelected) {
        return prev.filter((name) => !visibleNames.includes(name));
      }
      const merged = new Set([...prev, ...visibleNames]);
      return Array.from(merged);
    });
  };

  const onDeleteSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) {
      return;
    }

    const selectedSet = new Set(selectedDocuments);
    const targets = documents.filter((document) => selectedSet.has(document.filename));
    setDeleteInProgressKey('bulk');
    setDocumentsError('');

    let updated = 0;
    for (const document of targets) {
      try {
        if (document.in_index) {
          await apiService.deleteParsedDocument(document.filename, 'index');
        }
        if (document.in_folder) {
          await apiService.deleteParsedDocument(document.filename, 'folder');
        }
        updated += 1;
      } catch {
        setDocumentsError(`Some selected documents could not be deleted (stopped at ${document.filename}).`);
        break;
      }
    }

    if (updated > 0) {
      updateMessage(`Deleted ${updated} selected document(s) from index/folder where available.`);
    }

    await loadParsedDocuments();
    setSelectedDocuments([]);
    setDeleteInProgressKey(null);
  };

  const openDocumentsBox = async () => {
    setIsDocumentsBoxOpen(true);
    await loadParsedDocuments();
  };

  const closeDocumentsBox = () => {
    if (deleteInProgressKey) {
      return;
    }
    setIsDocumentsBoxOpen(false);
    setDocumentsError('');
    setDocumentsSearch('');
    setShowHiddenDocuments(false);
    setIsSelectMode(false);
    setSelectedDocuments([]);
  };

  const closeManual = () => {
    setIsManualOpen(false);
  };

  return (
    <>
      <Head>
        <title>Settings | Logos Continuum</title>
        <meta name="description" content="Parser and document management settings" />
      </Head>
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <Link href="/" passHref>
            <a className={styles.logoLink}>LOGOS CONTINUUM</a>
          </Link>
          <h1 className={styles.title}>Settings</h1>
        </div>

        {message && (
          <p className={messageLevel === 'error' ? styles.errorMessage : styles.infoMessage}>{message}</p>
        )}

        <div className={styles.cardsGrid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Appearance</h2>
              <p className={styles.meta}>Current theme: {theme === 'dark' ? 'Dark' : 'Light'}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryBtn} onClick={toggleTheme}>
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                </button>
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Clear Parsed Cards</h2>
              <p className={styles.meta}>Choose what to clear.</p>

            <label className={styles.row}>
              <span>Clear parsed cards from index</span>
              <input
                type="checkbox"
                checked={clearIndexSelected}
                onChange={(event) => setClearIndexSelected(event.target.checked)}
                disabled={isClearingIndex}
              />
            </label>

            <label className={styles.row}>
              <span>Delete uploaded .docx files</span>
              <input
                type="checkbox"
                checked={clearFilesSelected}
                onChange={(event) => setClearFilesSelected(event.target.checked)}
                disabled={isClearingIndex}
              />
            </label>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={onConfirmClearIndex}
                  disabled={isClearingIndex || (!clearIndexSelected && !clearFilesSelected)}
                >
                  {isClearingIndex ? 'Clearing…' : 'Run Clear Action'}
                </button>
              </div>
            </section>
          </div>

          <div className={styles.column}>
            <section className={`${styles.card} ${styles.parserCard}`}>
              <h2 className={styles.sectionTitle}>Parser Settings</h2>
              {parserSettingsError && <p className={styles.errorMessage}>{parserSettingsError}</p>}

          <label className={styles.row}>
            <span>Use parallel processing</span>
            <input
              type="checkbox"
              checked={parserSettings.use_parallel_processing}
              onChange={(event) => setParserSettings((prev) => ({ ...prev, use_parallel_processing: event.target.checked }))}
              disabled={isSavingParserSettings}
            />
          </label>

          <label className={styles.row}>
            <span>Card workers (cores)</span>
            <input
              type="number"
              min={1}
              className={styles.numberInput}
              value={parserSettings.parser_card_workers}
              onChange={(event) => setParserSettings((prev) => ({ ...prev, parser_card_workers: Number(event.target.value) || 1 }))}
              disabled={isSavingParserSettings}
            />
          </label>

          <label className={styles.row}>
            <span>File workers (cores)</span>
            <input
              type="number"
              min={1}
              className={styles.numberInput}
              value={parserSettings.local_parser_file_workers}
              onChange={(event) => setParserSettings((prev) => ({ ...prev, local_parser_file_workers: Number(event.target.value) || 1 }))}
              disabled={isSavingParserSettings}
            />
          </label>

          <label className={styles.row}>
            <span>Enable periodic flush</span>
            <input
              type="checkbox"
              checked={parserSettings.flush_enabled}
              onChange={(event) => setParserSettings((prev) => ({ ...prev, flush_enabled: event.target.checked }))}
              disabled={isSavingParserSettings}
            />
          </label>

          <label className={styles.row}>
            <span>Flush every N documents</span>
            <input
              type="number"
              min={1}
              className={styles.numberInput}
              value={parserSettings.flush_every_docs}
              onChange={(event) => setParserSettings((prev) => ({ ...prev, flush_every_docs: Number(event.target.value) || 1 }))}
              disabled={isSavingParserSettings || !parserSettings.flush_enabled}
            />
          </label>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} onClick={onSaveParserSettings} disabled={isSavingParserSettings}>
                {isSavingParserSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Manage Documents</h2>
              <p className={styles.meta}>Open the document manager popup to search, select, and delete documents.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={openDocumentsBox}>
                  Open Manage Documents ({documents.length})
                </button>
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Manual</h2>
              <p className={styles.meta}>Open the complete app guide for parsing, search, editing, export, and settings workflows.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsManualOpen(true)}>
                  Open Manual
                </button>
              </div>
            </section>
          </div>
        </div>

        {isManualOpen && (
          <div className={styles.manualOverlay} role="presentation" onClick={closeManual}>
            <div
              className={styles.manualDialog}
              role="dialog"
              aria-modal="true"
              aria-label="App manual"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.manualHeader}>
                <h3 className={styles.manualTitle}>Logos Continuum Manual</h3>
                <button type="button" className={styles.secondaryBtn} onClick={closeManual}>Close</button>
              </div>

              <div className={styles.manualBody}>
                <section className={styles.manualSection}>
                  <h4>1) What this app does</h4>
                  <p>
                    Logos Continuum is a debate card workflow app. You can upload .docx files to parse cards,
                    search cards by text or citation, open and edit full cards, copy cards, export saved edits to
                    .docx, manage parsed documents, and tune parser behavior in Settings.
                  </p>
                </section>

                <section className={styles.manualSection}>
                  <h4>2) Home page: quick search + parsing uploads</h4>
                  <ul>
                    <li><strong>Search from home:</strong> enter a query in the Search box and press Enter or click <em>Search</em>. You will be routed to Query with that search.</li>
                    <li><strong>Go to settings:</strong> click <em>Settings</em> in the top-right corner.</li>
                    <li><strong>Open debug console:</strong> click the bug icon to open runtime logs; use <em>copy logs</em>, <em>clear</em>, and <em>close</em>.</li>
                    <li><strong>Parse documents:</strong> drag and drop one or more .docx files into the upload zone, or click the zone to choose files.</li>
                    <li><strong>Multi-file support:</strong> you can upload multiple files at once; only .docx files are parsed.</li>
                    <li><strong>Parsing feedback:</strong> status text shows success/failure counts and details list parsed and failed filenames.</li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>3) Query page: search, browse, and select cards</h4>
                  <ul>
                    <li><strong>Main search:</strong> use the top Search field to run full-text card searches.</li>
                    <li><strong>Advanced citation search:</strong> click <em>Advanced Search</em>, enter citation text in <em>Search by cite...</em>, then press Enter to apply citation matching.</li>
                    <li><strong>URL-driven state:</strong> search and citation filters are reflected in URL query parameters, so browser navigation preserves state.</li>
                    <li><strong>Results panel:</strong> matching cards appear in the left results list with tag/citation preview and source download links.</li>
                    <li><strong>Infinite loading:</strong> more results load automatically when you scroll near the bottom while more matches exist.</li>
                    <li><strong>Select a card:</strong> click any result to open its full card content in the right detail panel.</li>
                    <li><strong>Source links:</strong> each card/result can display one or more source links; local paths can be copied from the copy icon.</li>
                    <li><strong>Query debug console:</strong> bug icon opens logs for search requests/responses and card loading; you can copy/clear/close logs.</li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>4) Card actions (view mode)</h4>
                  <ul>
                    <li><strong>Edit:</strong> click <em>Edit</em> to enter full card editing mode for the selected card.</li>
                    <li><strong>Copy:</strong> click <em>Copy</em> to copy the selected card with formatting; a copied toast confirms the action.</li>
                    <li><strong>Export Saved Edits:</strong> click <em>Export Saved Edits (N)</em> to generate a .docx containing all locally saved card edits.</li>
                    <li><strong>Style controls:</strong> use color swatches and font dropdown to control highlight color + font preferences used in card display and export.</li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>5) Card editor (edit mode)</h4>
                  <p>
                    In edit mode you can modify tag, tag subtext, citation, and all body paragraphs inline. The editor toolbar lets you apply and remove formatting.
                  </p>
                  <ul>
                    <li><strong>Highlight:</strong> select text and click the highlighter button (shortcut <strong>F11</strong>).</li>
                    <li><strong>Bold:</strong> select text and click the bold button.</li>
                    <li><strong>Underline:</strong> select text and click underline (shortcut <strong>F9</strong>).</li>
                    <li><strong>Italic:</strong> select text and click italic (shortcut <strong>F5</strong>).</li>
                    <li><strong>Clear formatting:</strong> removes styling from the selected range.</li>
                    <li><strong>Undo/Redo:</strong> use toolbar buttons or keyboard shortcuts <strong>Cmd/Ctrl+Z</strong> and <strong>Cmd/Ctrl+Shift+Z</strong>.</li>
                    <li><strong>Copy while editing:</strong> copy remains available in the edit toolbar area.</li>
                    <li><strong>Cancel:</strong> exits edit mode and discards unsaved changes for the current editing session.</li>
                    <li><strong>Save:</strong> saves your edited card locally as a saved edit and exits edit mode.</li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>6) Saved edits and export behavior</h4>
                  <ul>
                    <li><strong>Local persistence:</strong> saved card edits are stored locally in your browser and reapplied when a card is reopened.</li>
                    <li><strong>Export format:</strong> exported .docx files preserve tag/cite/body and formatting (highlight, bold, underline, italic) from saved edits.</li>
                    <li><strong>Source tracking:</strong> export includes source document labels derived from card/source URLs and available metadata.</li>
                    <li><strong>Style-aware export:</strong> selected font and highlight color preferences are applied in generated .docx output.</li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>7) Settings page features</h4>
                  <ul>
                    <li><strong>Appearance:</strong> toggle between light and dark mode.</li>
                    <li><strong>Clear Parsed Cards:</strong>
                      <ul>
                        <li><strong>Clear parsed cards from index:</strong> removes indexed card data from the search index.</li>
                        <li><strong>Delete uploaded .docx files:</strong> removes document files from the uploaded docs folder.</li>
                        <li><strong>Run Clear Action:</strong> executes whichever clear options are currently checked.</li>
                      </ul>
                    </li>
                    <li><strong>Parser Settings:</strong>
                      <ul>
                        <li><strong>Use parallel processing:</strong> enables parallel parse/index workers.</li>
                        <li><strong>Card workers (cores):</strong> sets worker count for card-level parsing.</li>
                        <li><strong>File workers (cores):</strong> sets worker count for file-level parsing.</li>
                        <li><strong>Enable periodic flush:</strong> toggles periodic persistence/flush during parsing.</li>
                        <li><strong>Flush every N documents:</strong> controls flush interval when periodic flush is enabled.</li>
                        <li><strong>Save Settings:</strong> persists parser settings through the backend API.</li>
                      </ul>
                    </li>
                    <li><strong>Manage Documents popup:</strong>
                      <ul>
                        <li><strong>Search parsed documents:</strong> filter by filename.</li>
                        <li><strong>Show Hidden:</strong> include docs that are not currently in index.</li>
                        <li><strong>Select mode:</strong> enable checkbox selection on rows.</li>
                        <li><strong>Select All:</strong> toggles all currently visible rows in selection mode.</li>
                        <li><strong>Delete Selected:</strong> bulk-deletes selected docs from index/folder where present.</li>
                        <li><strong>Remove from Index:</strong> per-row delete from search index only.</li>
                        <li><strong>Delete File:</strong> per-row delete from uploaded docs folder only.</li>
                      </ul>
                    </li>
                  </ul>
                </section>

                <section className={styles.manualSection}>
                  <h4>8) Typical end-to-end workflow</h4>
                  <ol>
                    <li>Upload .docx files on the home page and wait for parsing status to complete.</li>
                    <li>Run a search from home or directly on Query.</li>
                    <li>Select a result card and review citation/body content.</li>
                    <li>Enter edit mode, make text/format updates, then save.</li>
                    <li>Repeat for additional cards, then use <em>Export Saved Edits</em> to download the final .docx.</li>
                    <li>Use Settings to tune parser performance or clean documents/index state as needed.</li>
                  </ol>
                </section>

                <section className={styles.manualSection}>
                  <h4>9) Troubleshooting quick tips</h4>
                  <ul>
                    <li>If no results appear, confirm your query/citation text and uploaded documents.</li>
                    <li>If a feature seems unresponsive, open the bug/debug console and review/copy logs.</li>
                    <li>If parsing does not reflect expected docs, check Manage Documents for index/folder state.</li>
                    <li>If performance is slow during heavy parsing, lower or tune worker counts in Parser Settings.</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}

        {isDocumentsBoxOpen && (
          <div className={indexStyles['confirm-overlay']} role="presentation" onClick={closeDocumentsBox}>
            <div
              className={indexStyles['documents-dialog']}
              role="dialog"
              aria-modal="true"
              aria-label="Manage documents"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={indexStyles['documents-header']}>
                <h3 className={indexStyles['documents-title']}>Manage Documents</h3>
                <button type="button" className={indexStyles['documents-close']} onClick={closeDocumentsBox} disabled={!!deleteInProgressKey}>Close</button>
              </div>
              <div className={indexStyles['documents-controls']}>
                <input
                  type="text"
                  className={indexStyles['documents-search']}
                  placeholder="Search parsed documents..."
                  value={documentsSearch}
                  onChange={(event) => setDocumentsSearch(event.target.value)}
                />
                <div className={indexStyles['documents-actions-row']}>
                  <label className={indexStyles['documents-toggle']}>
                    <input
                      type="checkbox"
                      checked={showHiddenDocuments}
                      onChange={(event) => setShowHiddenDocuments(event.target.checked)}
                    />
                    Show Hidden
                  </label>
                  <button
                    type="button"
                    className={indexStyles['documents-select-btn']}
                    onClick={onToggleSelectMode}
                    disabled={!!deleteInProgressKey}
                  >
                    {isSelectMode ? 'Exit' : 'Select'}
                  </button>
                  {isSelectMode && (
                    <>
                      <button
                        type="button"
                        className={indexStyles['documents-select-btn']}
                        onClick={onSelectAllVisible}
                        disabled={!!deleteInProgressKey || filteredDocuments.length === 0}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={indexStyles['document-action-danger']}
                        onClick={onDeleteSelectedDocuments}
                        disabled={!!deleteInProgressKey || selectedDocuments.length === 0}
                      >
                        Delete Selected ({selectedDocuments.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
              {documentsError && <p className={indexStyles['documents-error']}>{documentsError}</p>}
              {isDocumentsLoading && <p className={indexStyles['documents-meta']}>Loading documents...</p>}
              {!isDocumentsLoading && documents.length === 0 && (
                <p className={indexStyles['documents-meta']}>No parsed documents found.</p>
              )}
              {!isDocumentsLoading && documents.length > 0 && filteredDocuments.length === 0 && (
                <p className={indexStyles['documents-meta']}>No documents match your current filters.</p>
              )}
              {!isDocumentsLoading && filteredDocuments.length > 0 && (
                <div className={indexStyles['documents-list']}>
                  {filteredDocuments.map((document) => {
                    const indexKey = `${document.filename}:index`;
                    const folderKey = `${document.filename}:folder`;
                    return (
                      <div key={document.filename} className={indexStyles['document-row']}>
                        {isSelectMode && (
                          <label className={indexStyles['document-select']}>
                            <input
                              type="checkbox"
                              checked={selectedDocuments.includes(document.filename)}
                              onChange={() => toggleSelectedDocument(document.filename)}
                              disabled={!!deleteInProgressKey}
                            />
                          </label>
                        )}
                        <div className={indexStyles['document-main']}>
                          <p className={indexStyles['document-name']}>{document.filename}</p>
                          <p className={indexStyles['document-meta']}>
                            cards: {document.cards_indexed} • in index: {document.in_index ? 'yes' : 'no'} • in folder: {document.in_folder ? 'yes' : 'no'}
                          </p>
                        </div>
                        <div className={indexStyles['document-actions']}>
                          <button
                            type="button"
                            className={indexStyles['document-action-secondary']}
                            disabled={!document.in_index || deleteInProgressKey !== null}
                            onClick={() => onDeleteDocument(document, 'index')}
                          >
                            {deleteInProgressKey === indexKey ? 'Removing…' : 'Remove from Index'}
                          </button>
                          <button
                            type="button"
                            className={indexStyles['document-action-danger']}
                            disabled={!document.in_folder || deleteInProgressKey !== null}
                            onClick={() => onDeleteDocument(document, 'folder')}
                          >
                            {deleteInProgressKey === folderKey ? 'Removing…' : 'Delete File'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SettingsPage;
