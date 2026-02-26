export type SearchResult = {
  cite: string;
  division?: string;
  id: string;
  s3_url?: string;
  tag: string;
  year?: string;
  download_url?: string | string[];
  cite_emphasis?: [[number, number]];
}

export type Card = {
  id: string;
  tag: string;
  cite: string;
  division?: string;
  s3_url?: string;
  year?: string;
  body: string[];
  emphasis: Array<[number, number, number]>;
  highlights: Array<[number, number, number]>;
  underlines: Array<[number, number, number]>;
  italics?: Array<[number, number, number]>;
  cite_emphasis?: Array<[number, number]>;
  download_url?: string;
  tag_sub?: string;
}
