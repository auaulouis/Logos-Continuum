/* eslint-disable react/no-danger */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-var-requires */
import {
  useState, useRef, useEffect, useMemo,
} from 'react';
import type { SearchResult } from '../../lib/types';
import { generateStyledCite } from '../../lib/utils';
import DownloadLink from '../DownloadLink';
import styles from './styles.module.scss';

const stringSimilarity = require('string-similarity');

const extractCardIdentifier = (result: SearchResult): string => {
  if (result.card_identifier && result.card_identifier.trim()) {
    return result.card_identifier.trim();
  }

  const tagText = String(result.tag || '');
  const tokenMatch = tagText.match(/\[\[(CID-[^\]]+)\]\]/i);
  if (tokenMatch?.[1]) {
    return tokenMatch[1].trim();
  }

  return '';
};

const stripIdentifierTokenFromTag = (tag: string): string => {
  return String(tag || '').replace(/\s*\[\[CID-[^\]]+\]\]\s*/gi, ' ').trim();
};

type SearchResultsProps = {
  results: Array<SearchResult>;
  setSelected: (id: string) => void;
  cards: Record<string, any>;
  getCard: (id: string) => Promise<void>;
  loadMore: () => Promise<any>;
  setDownloadUrls: (urls: string[]) => void;
  hasMoreResults: boolean;
};

const SearchResults = ({
  results, setSelected, cards, getCard, loadMore, setDownloadUrls, hasMoreResults,
}: SearchResultsProps) => {
  const [requested, setRequested] = useState<Record<string, any>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const resultsContainer = useRef<HTMLDivElement>(null);
  const loadMoreTarget = useRef<HTMLDivElement>(null);

  // filter the list by string similarity to avoid showing duplicate cards
  // successive cards with a combined tag + cite similarity of 0.95 or greater compared with any other previous card
  // will not be shown in the final set of search results
  const filteredResults = useMemo<Array<SearchResult>>(() => {
    return results.reduce<Array<SearchResult>>((acc, result) => {
      const existingIndex = acc.findIndex((r) => {
        return stringSimilarity.compareTwoStrings(`${r.tag} ${r.cite}`, `${result.tag} ${result.cite}`) > 0.95;
      });

      if (existingIndex === -1) {
        return [...acc, result];
      }

      const existingResult = acc[existingIndex];
      const updatedResult: SearchResult = { ...existingResult };

      const existingUrls = Array.isArray(updatedResult.download_url)
        ? [...updatedResult.download_url]
        : updatedResult.download_url ? [updatedResult.download_url] : [];

      const incomingUrl = Array.isArray(result.download_url)
        ? result.download_url
        : result.download_url ? [result.download_url] : [];

      const mergedUrls = [...existingUrls];
      incomingUrl.forEach((url) => {
        if (!mergedUrls.includes(url)) {
          mergedUrls.push(url);
        }
      });

      updatedResult.download_url = mergedUrls.length === 1 ? mergedUrls[0] : mergedUrls;

      const next = [...acc];
      next[existingIndex] = updatedResult;
      return next;
    }, []);
  }, [results]);

  useEffect(() => {
    const target = loadMoreTarget.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(async (entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting || loadingMore || filteredResults.length === 0 || !hasMoreResults) {
        return;
      }

      setLoadingMore(true);
      try {
        await loadMore();
      } finally {
        setLoadingMore(false);
      }
    }, {
      root: resultsContainer.current,
      rootMargin: '200px',
      threshold: 0.01,
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadingMore, filteredResults.length, loadMore, hasMoreResults]);

  const renderResult = (result: SearchResult, index: number) => {

    // largely deprecated
    // in previous versions of the app, this would load the first couple lines of the card body early
    // if the tag was cut off early and the cite didn't contain cite info
    if (!cards[result.id] && !/\d/.test(result.cite) && !requested[result.id]) {
      getCard(result.id);
      setRequested((prev) => ({ ...prev, [result.id]: true }));
    }

    const card = cards[result.id];
    const cardIdentifier = extractCardIdentifier(result);
    const displayTag = stripIdentifierTokenFromTag(result.tag);

    const onClick = () => {
      setSelected(result.id);
      if (result.download_url) {
        setDownloadUrls(Array.isArray(result.download_url) ? result.download_url : [result.download_url]);
      }
    };

    return (
      <div key={`${result.id}-${index}`} className={styles.result} role="button" tabIndex={0} onClick={onClick}>
        <div className={styles['result-header']}>
          <div className={styles.tag}>{/\d/.test(result.cite) ? displayTag : `${displayTag} ${result.cite}`}</div>
          {cardIdentifier && <div className={styles.cid}>{cardIdentifier}</div>}
        </div>
        <div className={styles.cite}
          dangerouslySetInnerHTML={{
            __html: (/\d/.test(result.cite) ? generateStyledCite(result.cite, result.cite_emphasis, 11)
              : (card ? card.body.find((p: string) => /\d/.test(p)) : '')),
          }}
        />
        <DownloadLink url={result.download_url} />
      </div>
    );
  };

  return (
    <div className={styles.results} ref={resultsContainer}>
      {filteredResults.map(renderResult)}
      {hasMoreResults && <div ref={loadMoreTarget} className={styles['load-more-trigger']} />}
      {!hasMoreResults && filteredResults.length > 0 && (
        <div className={styles['end-of-results']}>End of results</div>
      )}
    </div>
  );
};

export default SearchResults;
