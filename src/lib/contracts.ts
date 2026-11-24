export type ContentKind = 'article' | 'project';

export interface SearchIndexItem {
  kind: ContentKind;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  date?: string;
}

export interface AiCorpusChunk {
  kind: ContentKind;
  title: string;
  section: string;
  url: string;
  tags: string[];
  text: string;
  date?: string;
}
