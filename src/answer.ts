import { itemById } from './catalog';
import { GridIndex, MALAGA_CENTRE, insideBbox, walkingMinutes, type ContainerData, type LatLon, type Nearest } from './geo';
import { streamById } from './streams';
import type { Item, Stream, StreamId } from './types';

export interface Finder {
  data: ContainerData;
  grids: Partial<Record<StreamId, GridIndex>>;
}

export function makeFinder(data: ContainerData): Finder {
  const grids: Finder['grids'] = {};
  for (const [id, pts] of Object.entries(data.streams) as [StreamId, LatLon[]][]) {
    if (pts.length) grids[id] = new GridIndex(pts);
  }
  return { data, grids };
}

export interface Place extends Nearest {
  walkMin: number;
}

export interface StreamPlaces {
  stream: Stream;
  /** True when the user is outside the area covered by the data. */
  outside: boolean;
  nearest: Place[];
  /** How many points of this stream the data holds (0 means: no map for it). */
  total: number;
}

export function placesFor(finder: Finder, stream: StreamId, from: LatLon, k = 3): StreamPlaces {
  const grid = finder.grids[stream];
  const nearest = grid ? grid.nearest(from, k).map((n) => ({ ...n, walkMin: walkingMinutes(n.meters) })) : [];
  return {
    stream: streamById(stream),
    outside: !insideBbox(from, finder.data.bbox),
    nearest,
    total: grid?.size ?? 0,
  };
}

export interface Answer {
  item: Item;
  main: StreamPlaces;
  /** Only when the item has a conditional second destination. */
  alt?: StreamPlaces;
}

export function buildAnswer(itemId: string, finder: Finder, from: LatLon = MALAGA_CENTRE): Answer | undefined {
  const item = itemById(itemId);
  if (!item) return undefined;
  return {
    item,
    main: placesFor(finder, item.stream, from),
    alt: item.alt ? placesFor(finder, item.alt.stream, from, 1) : undefined,
  };
}
