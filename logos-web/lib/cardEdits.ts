import type { Card } from './types';

const STORAGE_KEY = 'logos-card-edits-v1';

export type CardEdit = {
  tag: string;
  tag_sub?: string;
  cite: string;
  body: string[];
  highlights: [number, number, number][];
  emphasis: [number, number, number][];
  underlines: [number, number, number][];
  italics: [number, number, number][];
};

const isBrowser = () => typeof window !== 'undefined';

const readAllEdits = (): Record<string, CardEdit> => {
  if (!isBrowser()) return {};

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, CardEdit>;
  } catch {
    return {};
  }
};

const writeAllEdits = (edits: Record<string, CardEdit>) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
};

export const getSavedCardEdit = (cardId: string): CardEdit | undefined => {
  return readAllEdits()[cardId];
};

export const saveCardEdit = (cardId: string, edit: CardEdit) => {
  const allEdits = readAllEdits();
  allEdits[cardId] = edit;
  writeAllEdits(allEdits);
};

export const applySavedEdit = (card: Card): Card => {
  const saved = getSavedCardEdit(card.id);
  if (!saved) return card;

  return {
    ...card,
    tag: saved.tag,
    tag_sub: saved.tag_sub,
    cite: saved.cite,
    body: saved.body,
    highlights: saved.highlights || [],
    emphasis: saved.emphasis || [],
    underlines: saved.underlines || [],
    italics: saved.italics || [],
  };
};
