import { Button, usePromptModal } from '@affine/component';
import {
  createDocExplorerContext,
  DocExplorerContext,
} from '@affine/core/components/explorer/context';
import { DocsExplorer } from '@affine/core/components/explorer/docs-view/docs-list';
import type { ExplorerDisplayPreference } from '@affine/core/components/explorer/types';
import { Filters } from '@affine/core/components/filter';
import {
  CollectionService,
  PinnedCollectionService,
} from '@affine/core/modules/collection';
import { CollectionRulesService } from '@affine/core/modules/collection-rules';
import type { FilterParams } from '@affine/core/modules/collection-rules/types';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { WorkspaceLocalState } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { AllPage as AllPageOld } from '../all-page-old/all-page';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './all-page.css';
import { AllDocsHeader } from './all-page-header';
import { MigrationAllDocsDataNotification } from './migration-data';
import { PinnedCollections } from './pinned-collections';

interface AllDocsStateSave extends ExplorerDisplayPreference {
  selectedCollectionId: string | null;
}

export const AllPage = () => {
  const t = useI18n();

  const collectionService = useService(CollectionService);
  const pinnedCollectionService = useService(PinnedCollectionService);
  const workspaceLocalState = useService(WorkspaceLocalState);

  const [initialState] = useState(() => {
    return workspaceLocalState.get<AllDocsStateSave>(
      'allDocsDisplayPreference'
    );
  });

  const isCollectionDataReady = useLiveData(
    collectionService.collectionDataReady$
  );

  const isPinnedCollectionDataReady = useLiveData(
    pinnedCollectionService.pinnedCollectionDataReady$
  );

  const pinnedCollections = useLiveData(
    pinnedCollectionService.pinnedCollections$
  );

  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(initialState?.selectedCollectionId ?? null);
  const selectedCollection = useLiveData(
    selectedCollectionId
      ? collectionService.collection$(selectedCollectionId)
      : null
  );

  useEffect(() => {
    // if selected collection is not in pinned collections, set selected collection id to null
    if (
      isPinnedCollectionDataReady &&
      selectedCollectionId &&
      !pinnedCollections.some(c => c.collectionId === selectedCollectionId)
    ) {
      setSelectedCollectionId(null);
    }
  }, [isPinnedCollectionDataReady, pinnedCollections, selectedCollectionId]);

  useEffect(() => {
    // if selected collection is not found, set selected collection id to null
    if (!selectedCollection && selectedCollectionId && isCollectionDataReady) {
      setSelectedCollectionId(null);
    }
  }, [isCollectionDataReady, selectedCollection, selectedCollectionId]);

  const selectedCollectionInfo = useLiveData(
    selectedCollection ? selectedCollection.info$ : null
  );

  const [tempFilters, setTempFilters] = useState<FilterParams[] | null>(null);

  const [explorerContextValue] = useState(() =>
    createDocExplorerContext(initialState)
  );

  const groupBy = useLiveData(explorerContextValue.groupBy$);
  const orderBy = useLiveData(explorerContextValue.orderBy$);
  const displayPreference = useLiveData(
    explorerContextValue.displayPreference$
  );

  const allDocsStateSave = useMemo(() => {
    return {
      ...displayPreference,
      selectedCollectionId,
    };
  }, [displayPreference, selectedCollectionId]);

  useEffect(() => {
    workspaceLocalState.set('allDocsDisplayPreference', allDocsStateSave);
  }, [allDocsStateSave, workspaceLocalState]);

  const { openPromptModal } = usePromptModal();

  const collectionRulesService = useService(CollectionRulesService);
  useEffect(() => {
    const subscription = collectionRulesService
      .watch(
        selectedCollectionInfo
          ? {
              filters: tempFilters ?? selectedCollectionInfo.rules.filters,
              groupBy,
              orderBy,
              extraAllowList: selectedCollectionInfo.allowList,
              extraFilters: [
                {
                  type: 'system',
                  key: 'empty-journal',
                  method: 'is',
                  value: 'false',
                },
                {
                  type: 'system',
                  key: 'trash',
                  method: 'is',
                  value: 'false',
                },
              ],
            }
          : {
              filters:
                tempFilters && tempFilters.length > 0
                  ? tempFilters
                  : [
                      // if no filters are present, match all non-trash documents
                      {
                        type: 'system',
                        key: 'trash',
                        method: 'is',
                        value: 'false',
                      },
                    ],
              groupBy,
              orderBy,
              extraFilters: [
                {
                  type: 'system',
                  key: 'empty-journal',
                  method: 'is',
                  value: 'false',
                },
                {
                  type: 'system',
                  key: 'trash',
                  method: 'is',
                  value: 'false',
                },
              ],
            }
      )
      .subscribe({
        next: result => {
          explorerContextValue.groups$.next(result.groups);
        },
        error: error => {
          console.error(error);
        },
      });
    return () => {
      subscription.unsubscribe();
    };
  }, [
    collectionRulesService,
    explorerContextValue,
    groupBy,
    orderBy,
    selectedCollection,
    selectedCollectionInfo,
    tempFilters,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        explorerContextValue.selectMode$.next(false);
        explorerContextValue.selectedDocIds$.next([]);
        explorerContextValue.prevCheckAnchorId$.next(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [explorerContextValue]);

  const handleFilterChange = useCallback((filters: FilterParams[]) => {
    setTempFilters(filters);
  }, []);

  const handleSelectCollection = useCallback((collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setTempFilters(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCollectionId(null);
    setTempFilters(null);
  }, []);

  const handleEditCollection = useCallback(
    (collectionId: string) => {
      const collection = collectionService.collection$(collectionId).value;
      if (!collection) {
        return;
      }
      setSelectedCollectionId(collectionId);
      setTempFilters(collection.info$.value.rules.filters);
    },
    [collectionService]
  );

  const handleSaveFilters = useCallback(() => {
    if (selectedCollectionId) {
      collectionService.updateCollection(selectedCollectionId, {
        rules: {
          filters: tempFilters ?? [],
        },
      });
      setTempFilters(null);
    } else {
      openPromptModal({
        title: t['com.affine.editCollection.saveCollection'](),
        label: t['com.affine.editCollectionName.name'](),
        inputOptions: {
          placeholder: t['com.affine.editCollectionName.name.placeholder'](),
        },
        children: t['com.affine.editCollectionName.createTips'](),
        confirmText: t['com.affine.editCollection.save'](),
        cancelText: t['com.affine.editCollection.button.cancel'](),
        confirmButtonOptions: {
          variant: 'primary',
        },
        onConfirm(name) {
          const id = collectionService.createCollection({
            name,
            rules: {
              filters: tempFilters ?? [],
            },
          });
          pinnedCollectionService.addPinnedCollection({
            collectionId: id,
            index: pinnedCollectionService.indexAt('after'),
          });
          setTempFilters(null);
          setSelectedCollectionId(id);
        },
      });
    }
  }, [
    collectionService,
    openPromptModal,
    pinnedCollectionService,
    selectedCollectionId,
    t,
    tempFilters,
  ]);

  const handleNewTempFilter = useCallback((params: FilterParams) => {
    setSelectedCollectionId(null);
    setTempFilters([params]);
  }, []);

  const handleDisplayPreferenceChange = useCallback(
    (displayPreference: ExplorerDisplayPreference) => {
      explorerContextValue.displayPreference$.next(displayPreference);
    },
    [explorerContextValue]
  );

  return (
    <DocExplorerContext.Provider value={explorerContextValue}>
      <ViewTitle title={t['All pages']()} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <AllDocsHeader
          displayPreference={displayPreference}
          onDisplayPreferenceChange={handleDisplayPreferenceChange}
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.body}>
          <MigrationAllDocsDataNotification />
          <div className={styles.pinnedCollection}>
            <PinnedCollections
              activeCollectionId={selectedCollectionId}
              onActiveAll={handleSelectAll}
              onActiveCollection={handleSelectCollection}
              onAddFilter={handleNewTempFilter}
              onEditCollection={handleEditCollection}
              hiddenAdd={tempFilters !== null}
            />
          </div>
          {tempFilters !== null && (
            <div className={styles.filterArea}>
              <Filters
                className={styles.filters}
                filters={tempFilters}
                onChange={handleFilterChange}
              />
              <Button
                variant="plain"
                onClick={() => {
                  setTempFilters(null);
                }}
              >
                {t['Cancel']()}
              </Button>
              <Button onClick={handleSaveFilters}>{t['save']()}</Button>
            </div>
          )}
          <div className={styles.scrollArea}>
            <DocsExplorer />
          </div>
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </DocExplorerContext.Provider>
  );
};

export const Component = () => {
  const featureFlagService = useService(FeatureFlagService);
  const enableNewAllDocsPage = useLiveData(
    featureFlagService.flags.enable_new_all_docs_page.$
  );

  return enableNewAllDocsPage ? <AllPage /> : <AllPageOld />;
};
