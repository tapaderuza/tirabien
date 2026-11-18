export type Lang = 'es' | 'en';

/** A string in every supported UI language. */
export type Text = Record<Lang, string>;

/**
 * Where an item ends up in Málaga. The five street bins come first, then
 * the specialised drop-off routes.
 */
export type StreamId =
  | 'yellow'
  | 'blue'
  | 'green'
  | 'brown'
  | 'grey'
  | 'textile'
  | 'oil'
  | 'battery'
  | 'clean_point'
  | 'pharmacy';

export interface Stream {
  id: StreamId;
  /** Full name, e.g. "Yellow bin — packaging". */
  name: Text;
  /** Two or three words for chips and map legends. */
  short: Text;
  /** UI colour (background) and readable ink colour on top of it. */
  color: string;
  ink: string;
  /** One sentence: what this stream is for. */
  accepts: Text;
  /** How to recognise the container or place in Málaga. */
  lookFor: Text;
  /** Source ids from sources.ts backing the rule. */
  sources: string[];
}

export interface Item {
  id: string;
  stream: StreamId;
  name: Text;
  /** Extra words people type for this item, in Spanish and English. */
  synonyms: string[];
  /**
   * English visual descriptions for the on-device vision model. Empty when
   * the item cannot be told apart from a photo (for example "receipt" vs paper).
   */
  prompts: string[];
  /** How to dispose of it correctly, in one or two short sentences. */
  tip: Text;
  /** The common mistake people make with this item, if there is one. */
  mistake?: Text;
  /** Set when the official rule is changing and the answer is provisional. */
  changing?: Text;
  /** A second destination that applies under a stated condition. */
  alt?: { stream: StreamId; when: Text };
}

/** Labels the vision model can pick that are not waste at all. */
export interface NotWasteLabel {
  id: string;
  prompts: string[];
}

export interface Source {
  id: string;
  title: string;
  url: string;
}
