import { LiveData } from '@toeverything/infra';
import { createContext } from 'react';

import type { DocListItemView } from './docs-view/doc-list-item';
import type { ExplorerPreference } from './types';

export type DocExplorerContextType = {
  view$: LiveData<DocListItemView>;
  groups$: LiveData<Array<{ key: string; items: string[] }>>;
  collapsedGroups$: LiveData<string[]>;
  selectMode$?: LiveData<boolean>;
  selectedDocIds$: LiveData<string[]>;
  prevCheckAnchorId$?: LiveData<string | null>;
} & {
  [K in keyof Omit<ExplorerPreference, 'filters'> as `${K}$`]: LiveData<
    ExplorerPreference[K]
  >;
};

export const DocExplorerContext = createContext<DocExplorerContextType>(
  {} as any
);

type ExtractLiveData<T> = T extends LiveData<infer U> ? U : T;
type DocExplorerContextDefaultValueMap = Partial<{
  [K in keyof DocExplorerContextType as K extends `${infer U}$`
    ? U
    : never]: ExtractLiveData<DocExplorerContextType[K]>;
}>;

export const createDocExplorerContext = (
  vMap?: DocExplorerContextDefaultValueMap
) =>
  ({
    view$: new LiveData<DocListItemView>(vMap?.view ?? 'list'),
    groups$: new LiveData<Array<{ key: string; items: string[] }>>(
      vMap?.groups ?? []
    ),
    collapsedGroups$: new LiveData<string[]>(vMap?.collapsedGroups ?? []),
    selectMode$: new LiveData<boolean>(vMap?.selectMode ?? false),
    selectedDocIds$: new LiveData<string[]>(vMap?.selectedDocIds ?? []),
    prevCheckAnchorId$: new LiveData<string | null>(
      vMap?.prevCheckAnchorId ?? null
    ),
    groupBy$: new LiveData<ExplorerPreference['groupBy']>(vMap?.groupBy),
    orderBy$: new LiveData<ExplorerPreference['orderBy']>(vMap?.orderBy),
    displayProperties$: new LiveData<ExplorerPreference['displayProperties']>(
      vMap?.displayProperties ?? []
    ),
    showDocIcon$: new LiveData<ExplorerPreference['showDocIcon']>(
      vMap?.showDocIcon ?? true
    ),
    showDragHandle$: new LiveData<ExplorerPreference['showDragHandle']>(
      vMap?.showDragHandle ?? true
    ),
    showDocPreview$: new LiveData<ExplorerPreference['showDocPreview']>(
      vMap?.showDocPreview ?? true
    ),
    showMoreOperation$: new LiveData<ExplorerPreference['showMoreOperation']>(
      vMap?.showMoreOperation ?? true
    ),
    quickFavorite$: new LiveData<ExplorerPreference['quickFavorite']>(
      vMap?.quickFavorite ?? false
    ),
    quickSelect$: new LiveData<ExplorerPreference['quickSelect']>(
      vMap?.quickSelect ?? false
    ),
    quickSplit$: new LiveData<ExplorerPreference['quickSplit']>(
      vMap?.quickSplit ?? false
    ),
    quickTrash$: new LiveData<ExplorerPreference['quickTrash']>(
      vMap?.quickTrash ?? false
    ),
    quickTab$: new LiveData<ExplorerPreference['quickTab']>(false),
  }) satisfies DocExplorerContextType;
