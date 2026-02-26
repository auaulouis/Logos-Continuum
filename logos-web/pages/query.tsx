/* eslint-disable jsx-a11y/anchor-is-valid */
import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import Head from 'next/head';
import { RangeKeyDict } from 'react-date-range';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import Link from 'next/link';
import mixpanel from 'mixpanel-browser';
import { useSession } from 'next-auth/react';
import StyleSelect from '../components/StyleSelect';
import pageStyles from '../styles/index.module.scss';
import queryStyles from '../components/query/styles.module.scss';
import {
  InputBox, SearchResults, CardDetail,
} from '../components/query';
import * as apiService from '../services/api';
import { SearchResult } from '../lib/types';
import {
  applySavedEdit,
  getAllSavedCardEdits,
  getSavedCardEditsCount,
  saveCardEdit,
} from '../lib/cardEdits';
import { exportSavedEditsToDocx, resolveSourceDocumentLabelsFromCard } from '../lib/cardDocxExport';
import {
  SideOption, sideOptions, divisionOptions, DivisionOption, yearOptions, YearOption, SchoolOption,
} from '../lib/constants';

type DebugLevel = 'info' | 'warn' | 'error';
type DebugEntry = {
  id: number;
  at: number;
  level: DebugLevel;
  message: string;
};

const QueryPage = () => {
  type DebugPhase = 'closed' | 'open' | 'closing';
  const [query, setQuery] = useState(''); // current user input in the search box
  const [citeSearch, setCiteSearch] = useState(''); // current user input in the cite box
  const [results, setResults] = useState<Array<SearchResult>>([]); // results returned from the search API
  const [cards, setCards] = useState<Record<string, any>>({}); // map of IDs to currently retrieved cards
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrollCursor, setScrollCursor] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [schools, setSchools] = useState<Array<SchoolOption>>([]); // list of schoools returned from the API
  const router = useRouter();
  const { query: routerQuery } = router;
  const {
    search: urlSearch, start_date, end_date, exclude_sides, exclude_division, exclude_years, exclude_schools, cite_match, use_personal,
  } = routerQuery;
  const [lastQuery, setLastQuery] = useState({});
  const [downloadUrls, setDownloadUrls] = useState<Array<string>>([]);
  const [copyRequest, setCopyRequest] = useState(0);
  const [editRequest, setEditRequest] = useState(0);
  const [isCardEditing, setIsCardEditing] = useState(false);
  const [savedEditsCount, setSavedEditsCount] = useState(0);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [debugPhase, setDebugPhase] = useState<DebugPhase>('closed');
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([
    { id: 1, at: Date.now(), level: 'info', message: 'Query debug console initialized' },
  ]);
  const debugLogElement = useRef<HTMLDivElement | null>(null);
  const debugCloseTimer = useRef<number | null>(null);

  const isDebugOpen = debugPhase === 'open';
  const isDebugRendered = debugPhase !== 'closed';

  const closeDebugConsole = useCallback(() => {
    if (debugPhase === 'closing' || debugPhase === 'closed') {
      return;
    }
    setDebugPhase('closing');
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
    }
    debugCloseTimer.current = window.setTimeout(() => {
      setDebugPhase('closed');
      debugCloseTimer.current = null;
    }, 220);
  }, [debugPhase]);

  const openDebugConsole = useCallback(() => {
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
      debugCloseTimer.current = null;
    }
    setDebugPhase('open');
  }, []);

  const toggleDebugConsole = useCallback(() => {
    if (debugPhase === 'open') {
      closeDebugConsole();
    } else {
      openDebugConsole();
    }
  }, [debugPhase, closeDebugConsole, openDebugConsole]);

  const addDebugEntry = useCallback((level: DebugLevel, message: string) => {
    setDebugEntries((prev) => {
      const next: DebugEntry[] = [...prev, {
        id: Date.now() + Math.floor(Math.random() * 1000),
        at: Date.now(),
        level,
        message,
      }];
      return next.slice(-140);
    });
  }, []);

  const formattedDebugEntries = useMemo(() => debugEntries.map((entry) => {
    const timestamp = new Date(entry.at).toLocaleTimeString();
    return {
      ...entry,
      line: `[${timestamp}] ${entry.level.toUpperCase()} ${entry.message}`,
    };
  }), [debugEntries]);

  const onCopyDebugLogs = useCallback(async () => {
    const payload = formattedDebugEntries.map((entry) => entry.line).join('\n');
    if (!payload) {
      addDebugEntry('warn', 'Copy logs skipped: no logs to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      addDebugEntry('info', `Copied ${formattedDebugEntries.length} log lines to clipboard`);
    } catch (error) {
      addDebugEntry('error', 'Failed to copy logs to clipboard');
    }
  }, [formattedDebugEntries, addDebugEntry]);

  const showCopiedMessage = () => {
    setShowCopiedToast(true);
    addDebugEntry('info', 'Copied card content');
    window.setTimeout(() => {
      setShowCopiedToast(false);
    }, 1500);
  };

  const refreshSavedEditsCount = useCallback(() => {
    setSavedEditsCount(getSavedCardEditsCount());
  }, []);

  const onExportSavedEdits = useCallback(async () => {
    const savedEdits = getAllSavedCardEdits();
    if (!savedEdits.length) {
      addDebugEntry('warn', 'Export skipped: no saved card edits');
      return;
    }

    const hydratedEdits = await Promise.all(savedEdits.map(async (entry) => {
      if (entry.edit.sourceDocuments && entry.edit.sourceDocuments.length > 0) {
        return entry;
      }

      try {
        const remoteCard = await apiService.getCard(entry.cardId);
        const resolvedSources = resolveSourceDocumentLabelsFromCard({
          sourceUrls: remoteCard?.download_url || remoteCard?.s3_url,
          filename: remoteCard?.filename,
        });

        if (resolvedSources.length === 0) {
          return entry;
        }

        const nextEdit = {
          ...entry.edit,
          sourceDocuments: resolvedSources,
          cardIdentifier: entry.edit.cardIdentifier || remoteCard?.card_identifier,
        };

        saveCardEdit(entry.cardId, nextEdit);
        return {
          ...entry,
          edit: nextEdit,
        };
      } catch {
        return entry;
      }
    }));

    await exportSavedEditsToDocx(hydratedEdits);
    refreshSavedEditsCount();
    addDebugEntry('info', `Exported ${hydratedEdits.length} saved card edits to DOCX`);
  }, [addDebugEntry, refreshSavedEditsCount]);

  // set the initial value of the filters based on the URL
  const urlSelectedSides = sideOptions.filter((side) => { return !exclude_sides?.includes(side.name); });
  const urlSelectedDivision = divisionOptions.filter((division) => { return !exclude_division?.includes(division.value); });
  const urlSelectedYears = yearOptions.filter((year) => { return !exclude_years?.includes(year.name); });
  const urlSelectedSchools = schools.filter((school) => { return !exclude_schools?.includes(school.name); });

  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });

  const { data: session, status } = useSession();

  /**
   * Load the list of schools from the API on page load.
   */
  useEffect(() => {
    apiService.getSchools().then((schools) => {
      const { colleges } = schools;
      setSchools(colleges.map((college: string, i: number) => ({ name: college, id: i })));
    });
  }, []);

  useEffect(() => {
   // mixpanel.track('Page View', {
     // page: 'Home',
   // });
    addDebugEntry('info', 'Query page mounted');
    refreshSavedEditsCount();
  }, [refreshSavedEditsCount]);

  useEffect(() => {
    if (debugLogElement.current) {
      debugLogElement.current.scrollTop = debugLogElement.current.scrollHeight;
    }
  }, [formattedDebugEntries, isDebugOpen]);

  useEffect(() => () => {
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
    }
  }, []);

  /**
    * Updates the specified fields or remove them from the URL.
    * Will trigger a new search if the query is different from the last query.
    */
  const updateUrl = (params: {[key: string]: string | undefined}, reset?: string[]) => {
    const query: Record<string, string> = {
      ...(params.search || urlSearch) && { search: params.search ? params.search : urlSearch as string },
      ...(params.start_date || start_date) && { start_date: params.start_date ? params.start_date : start_date as string },
      ...(params.end_date || end_date) && { end_date: params.end_date ? params.end_date : end_date as string },
      ...(params.exclude_sides || exclude_sides) && { exclude_sides: params.exclude_sides ? params.exclude_sides : exclude_sides as string },
      ...(params.exclude_division || exclude_division) && { exclude_division: params.exclude_division ? params.exclude_division : exclude_division as string },
      ...(params.exclude_years || exclude_years) && { exclude_years: params.exclude_years ? params.exclude_years : exclude_years as string },
      ...(params.exclude_schools || exclude_schools) && { exclude_schools: params.exclude_schools ? params.exclude_schools : exclude_schools as string },
      ...(params.cite_match || cite_match) && { cite_match: params.cite_match ? params.cite_match : cite_match as string },
      ...(params.use_personal || use_personal) && { use_personal: params.use_personal ? params.use_personal : use_personal as string },
    };
    for (const key of reset || []) {
      delete query[key];
    }
    router.push({
      pathname: '/query',
      query,
    });
    // mixpanel.track('Search', query);
  };

  /**
    * Updates the date range and triggers a new search.
    */
  const handleSelect = (ranges: RangeKeyDict) => {
    if (urlSearch) {
      if ((ranges.selection.endDate?.getTime() || 0) - (ranges.selection.startDate?.getTime() || 0) !== 0) {
        updateUrl({
          start_date: format((ranges.selection.startDate as Date), 'yyyy-MM-dd'),
          end_date: format((ranges.selection.endDate as Date), 'yyyy-MM-dd'),
        });
      } else {
        const start = ranges.selection.startDate || (start_date && start_date.length > 2 ? new Date(start_date as string) : new Date());
        const end = ranges.selection.endDate || (end_date && end_date.length > 2 ? new Date(end_date as string) : new Date());
        start.setUTCHours(12, 0, 0, 0);
        end.setUTCHours(12, 0, 0, 0);

        setDateRange((prev) => {
          return {
            ...prev,
            startDate: start,
            endDate: end,
          };
        });
      }
    }
  };

  const resetDate = () => {
    updateUrl({}, ['start_date', 'end_date']);
    setDateRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
  };

  const resetSchools = () => {
    if (urlSelectedSchools.length !== schools.length) {
      updateUrl({}, ['exclude_schools']);
    } else {
      updateUrl({ exclude_schools: schools.map((school) => school.name).join(',') });
    }
  };

  const onSearch = async () => {
    if (query) {
      updateUrl({ search: encodeURI(query.trim()) });
    } else if (query === '') {
      updateUrl({}, ['search']);
    }
  };

  /**
   * Initiates a new search with the current query, date range, and other query parameters from the API.
   * @param query The query to search for.
   * @param c The cursor to use for pagination.
   * @param replaceResults Whether to replace the current results with the new results.
   */
  const searchRequest = (query = '', c = 0, replaceResults = false) => {
    const q = {
      query,
      cursor: c,
      ...(start_date) && { start_date },
      ...(end_date) && { end_date },
      ...(exclude_sides) && { exclude_sides },
      ...(exclude_division) && { exclude_division },
      ...(exclude_years) && { exclude_years },
      ...(exclude_schools) && { exclude_schools },
      ...(cite_match) && { cite_match },
      ...(use_personal) && { use_personal },
    };

    if (!loading || JSON.stringify(q) !== JSON.stringify(lastQuery)) {
      setLoading(true);
      addDebugEntry('info', `Search requested: "${query}" (cursor ${c})`);
      apiService.search(query, c, {
        ...(start_date) && { start_date: Math.floor(new Date(start_date as string).getTime() / 1000) },
        ...(end_date) && { end_date: Math.floor(new Date(end_date as string).getTime() / 1000) },
        ...(exclude_sides) && { exclude_sides },
        ...(exclude_division) && { exclude_division },
        ...(exclude_years) && { exclude_years },
        ...(exclude_schools) && { exclude_schools },
        ...(cite_match) && { cite_match },
        ...(use_personal) && { use_personal },
        ...!!(session && session.accessToken) && { access_token: session.accessToken },
      }).then((response) => {
        const { results: responseResults, cursor } = response;

        if (replaceResults) setResults(responseResults);
        else setResults((prevResults) => { return [...prevResults, ...responseResults]; });

        setScrollCursor(cursor);
        setHasMoreResults(responseResults.length > 0 && cursor > c);
        addDebugEntry('info', `Search response: ${responseResults.length} results (next cursor ${cursor})`);
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Search request failed';
        addDebugEntry('error', message);
        setHasMoreResults(false);
      }).finally(() => {
        setLoading(false);
      });

      setLastQuery(q);
    }
  };

  const loadMore = async () => {
    if (hasMoreResults && ((urlSearch && urlSearch.length > 0) || cite_match)) {
      searchRequest(decodeURI(urlSearch as string || ''), scrollCursor, false);
    }
  };

  // triggered for any changes in the URL
  useEffect(() => {
    // initiates a new search if the query exists
    if (status !== 'loading' && ((urlSearch && urlSearch.length > 0) || cite_match)) {
      setQuery(decodeURI(urlSearch as string || ''));
      setHasMoreResults(true);
      searchRequest(decodeURI(urlSearch as string || ''), 0, true);
    }

    if (cite_match) {
      setCiteSearch(cite_match as string);
    }

    // update the date range based on changes to the URL
    if (start_date && end_date) {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);
      start.setUTCHours(12, 0, 0, 0);
      end.setUTCHours(12, 0, 0, 0);

      setDateRange((prev) => {
        return {
          ...prev,
          startDate: start,
          endDate: end,
        };
      });
    }
  }, [routerQuery, status]);

  const getCard = async (id: string) => {
    if (!cards[id]) {
      try {
        const card = await apiService.getCard(id);
        const hydratedCard = applySavedEdit(card);
        setCards((c) => { return { ...c, [id]: hydratedCard }; });
        addDebugEntry('info', `Loaded card: ${id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to load card: ${id}`;
        addDebugEntry('error', message);
      }
    }
  };

  useEffect(() => {
    if (selectedCard) {
      getCard(selectedCard);
    }
  }, [selectedCard]);

  const onSideSelect = (sides: SideOption[]) => {
    if (sides.length === 1) {
      updateUrl({ exclude_sides: sideOptions.filter((opt) => !sides.find((side) => side.value === opt.value)).map((opt) => opt.name).join('') });
    } else if (sides.length === 2) {
      updateUrl({}, ['exclude_sides']);
    }
  };

  const onDivisionSelect = (divisions: DivisionOption[]) => {
    if (divisions.length < divisionOptions.length) {
      updateUrl({ exclude_division: divisionOptions.filter((opt) => !divisions.find((div) => div.value === opt.value)).map((opt) => opt.value).join(',') });
    } else {
      updateUrl({}, ['exclude_division']);
    }
  };

  const onYearSelect = (years: YearOption[]) => {
    if (years.length < yearOptions.length) {
      updateUrl({ exclude_years: yearOptions.filter((opt) => !years.find((div) => div.name === opt.name)).map((opt) => opt.name).join(',') });
    } else {
      updateUrl({}, ['exclude_years']);
    }
  };

  const onSchoolSelect = (s: SchoolOption[]) => {
    if (s.length < schools.length) {
      updateUrl({ exclude_schools: schools.filter((opt) => !s.find((school) => school.name === opt.name)).map((opt) => opt.name).join(',') });
    } else {
      updateUrl({}, ['exclude_schools']);
    }
  };

  const onCiteSearch = (citeSearch: string) => {
    if (citeSearch.length > 0) {
      updateUrl({ cite_match: citeSearch, search: query });
    } else {
      updateUrl({}, ['cite_match']);
    }
  };

  const togglePersonal = () => {
    if (use_personal === 'true') {
      updateUrl({ }, ['use_personal']);
    } else {
      updateUrl({ use_personal: 'true' });
    }
  };

  return (
    <>
      <Head>
        <title>Logos Continuum: A Debate Search Engine</title>
        <meta name="description" content="Search debate cards with Logos Continuum" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={pageStyles.container}>
        <div className={pageStyles['corner-controls']}>
          <button
            type="button"
            className={pageStyles['bug-report-button']}
            aria-label="Toggle debug console"
            onClick={toggleDebugConsole}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              aria-hidden="true"
              className={pageStyles['bug-report-icon']}
            >
              <path d="M480-200q66 0 113-47t47-113v-160q0-66-47-113t-113-47q-66 0-113 47t-47 113v160q0 66 47 113t113 47Zm-80-120h160v-80H400v80Zm0-160h160v-80H400v80Zm80 40Zm0 320q-65 0-120.5-32T272-240H160v-80h84q-3-20-3.5-40t-.5-40h-80v-80h80q0-20 .5-40t3.5-40h-84v-80h112q14-23 31.5-43t40.5-35l-64-66 56-56 86 86q28-9 57-9t57 9l88-86 56 56-66 66q23 15 41.5 34.5T688-640h112v80h-84q3 20 3.5 40t.5 40h80v80h-80q0 20-.5 40t-3.5 40h84v80H688q-32 56-87.5 88T480-120Z" />
            </svg>
          </button>
        </div>
        {isDebugRendered && (
          <div
            className={`${pageStyles['debug-console']} ${debugPhase === 'closing' ? pageStyles['debug-console-closing'] : ''}`}
            role="dialog"
            aria-label="Debug console"
          >
            <div className={pageStyles['debug-console-header']}>
              <span>logs@logos-continuum:~$</span>
              <div className={pageStyles['debug-console-actions']}>
                <button
                  type="button"
                  className={pageStyles['debug-console-btn']}
                  onClick={onCopyDebugLogs}
                >
                  copy logs
                </button>
                <button
                  type="button"
                  className={pageStyles['debug-console-btn']}
                  onClick={() => setDebugEntries([])}
                >
                  clear
                </button>
                <button
                  type="button"
                  className={pageStyles['debug-console-btn']}
                  onClick={closeDebugConsole}
                >
                  close
                </button>
              </div>
            </div>
            <div ref={debugLogElement} className={pageStyles['debug-console-body']}>
              {formattedDebugEntries.length === 0 && (
                <div className={pageStyles['debug-line-muted']}>[empty] no events yet</div>
              )}
              {formattedDebugEntries.map((entry) => (
                <div key={entry.id} className={`${pageStyles['debug-line']} ${pageStyles[`debug-line-${entry.level}`]}`}>
                  {entry.line}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={pageStyles.foreground}>
          <div className="query-shell">
            <div className="logo query-logo">
              <Link href="/" passHref><a><h1 className={pageStyles.logo}>Logos Continuum</h1></a></Link>
              <div className={queryStyles['top-controls']}>
                {!isCardEditing && (
                  <button
                    type="button"
                    className={queryStyles['toolbar-action']}
                    onClick={() => setEditRequest((n) => n + 1)}
                    disabled={!selectedCard}
                  >
                    <img
                      src="/edit_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png"
                      alt="Edit card"
                      className={queryStyles['icon-image']}
                    />
                    Edit
                  </button>
                )}
                {!isCardEditing && (
                  <>
                    <button
                      type="button"
                      className={queryStyles['toolbar-action']}
                      onClick={() => {
                        setCopyRequest((n) => n + 1);
                        showCopiedMessage();
                      }}
                      disabled={!selectedCard}
                    >
                      <img
                        src="/copy_all_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png"
                        alt="Copy card"
                        className={queryStyles['icon-image']}
                      />
                      Copy
                    </button>
                    <button
                      type="button"
                      className={queryStyles['toolbar-action']}
                      onClick={onExportSavedEdits}
                      disabled={savedEditsCount === 0}
                    >
                      <img
                        src="/export_notes_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png"
                        alt="Export notes"
                        className={queryStyles['icon-image']}
                      />
                      Export Saved Edits ({savedEditsCount})
                    </button>
                    <StyleSelect />
                  </>
                )}
              </div>
            </div>

            <div className="query-page">
              <div className="page-row">
                <InputBox
                  value={query}
                  onChange={setQuery}
                  onSearch={onSearch}
                  loading={loading}
                  onCiteSearch={onCiteSearch}
                  onCiteChange={setCiteSearch}
                  citeValue={citeSearch}
                />
              </div>

              <div className="page-row">
                <SearchResults
                  results={results}
                  setSelected={setSelectedCard}
                  cards={cards}
                  getCard={getCard}
                  loadMore={loadMore}
                  setDownloadUrls={setDownloadUrls}
                  hasMoreResults={hasMoreResults}
                />
                <div className={queryStyles['card-panel']}>
                  <CardDetail
                    card={cards[selectedCard]}
                    downloadUrls={downloadUrls}
                    externalEditRequest={editRequest}
                    externalCopyRequest={copyRequest}
                    onEditModeChange={setIsCardEditing}
                    editorRightActions={isCardEditing ? (
                      <>
                        <button
                          type="button"
                          className={queryStyles['toolbar-action']}
                          onClick={() => {
                            setCopyRequest((n) => n + 1);
                            showCopiedMessage();
                          }}
                          disabled={!selectedCard}
                        >
                          <img
                            src="/copy_all_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png"
                            alt="Copy card"
                            className={queryStyles['icon-image']}
                          />
                          Copy
                        </button>
                        <StyleSelect />
                      </>
                    ) : undefined}
                    onCardSave={(updatedCard) => {
                      setCards((prev) => ({ ...prev, [updatedCard.id]: updatedCard }));
                      refreshSavedEditsCount();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {showCopiedToast && <div className={queryStyles['copy-toast']}>Copied</div>}
      </div>
    </>
  );
};

export default QueryPage;
