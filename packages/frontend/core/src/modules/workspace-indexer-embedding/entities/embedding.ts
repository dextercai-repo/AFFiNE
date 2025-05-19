import { logger } from '@affine/core/modules/share-doc/entities/share-docs-list';
import type { WorkspaceService } from '@affine/core/modules/workspace';
import type { PaginationInput } from '@affine/graphql';
import {
  catchErrorInto,
  effect,
  Entity,
  fromPromise,
  LiveData,
  onComplete,
  onStart,
  smartRetry,
} from '@toeverything/infra';
import { EMPTY, interval, Subject } from 'rxjs';
import {
  concatMap,
  exhaustMap,
  mergeMap,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { COUNT_PER_PAGE } from '../constants';
import type { EmbeddingStore } from '../stores/embedding';
import type { AttachmentFile, IgnoredDoc } from '../types';

export interface EmbeddingConfig {
  enabled: boolean;
}

interface Attachments {
  totalCount: number;
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
  edges: {
    node: AttachmentFile;
  }[];
}

type IgnoredDocs = IgnoredDoc[];

interface EmbeddingProgress {
  embedded: number;
  total: number;
}

export class Embedding extends Entity {
  enabled$ = new LiveData<boolean>(false);
  error$ = new LiveData<any>(null);
  attachments$ = new LiveData<Attachments>({
    edges: [],
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
    totalCount: 0,
  });
  ignoredDocs$ = new LiveData<IgnoredDocs>([]);
  isEnabledLoading$ = new LiveData(false);
  isAttachmentsLoading$ = new LiveData(false);
  isIgnoredDocsLoading$ = new LiveData(false);
  embeddingProgress$ = new LiveData<EmbeddingProgress | null>(null);
  isEmbeddingProgressLoading$ = new LiveData(false);

  private readonly EMBEDDING_PROGRESS_POLL_INTERVAL = 3000;
  private readonly stopEmbeddingProgress$ = new Subject<void>();

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly store: EmbeddingStore
  ) {
    super();
    this.getEnabled();
    this.getAttachments({ first: COUNT_PER_PAGE, after: null });
    this.getIgnoredDocs();
    this.getEmbeddingProgress();
  }

  getEnabled = effect(
    exhaustMap(() => {
      return fromPromise(signal =>
        this.store.getEnabled(this.workspaceService.workspace.id, signal)
      ).pipe(
        smartRetry(),
        mergeMap(value => {
          this.enabled$.next(value);
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to fetch workspace doc embedding enabled',
            error
          );
        }),
        onStart(() => this.isEnabledLoading$.setValue(true)),
        onComplete(() => this.isEnabledLoading$.setValue(false))
      );
    })
  );

  setEnabled = effect(
    exhaustMap((enabled: boolean) => {
      return fromPromise(signal =>
        this.store.updateEnabled(
          this.workspaceService.workspace.id,
          enabled,
          signal
        )
      ).pipe(
        smartRetry(),
        concatMap(() => {
          this.getEnabled();
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to update workspace doc embedding enabled',
            error
          );
        }),
        onStart(() => this.isEnabledLoading$.setValue(true)),
        onComplete(() => this.isEnabledLoading$.setValue(false))
      );
    })
  );

  getIgnoredDocs = effect(
    exhaustMap(() => {
      return fromPromise(signal =>
        this.store.getIgnoredDocs(this.workspaceService.workspace.id, signal)
      ).pipe(
        smartRetry(),
        mergeMap(value => {
          this.ignoredDocs$.next(value);
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to fetch workspace doc embedding ignored docs',
            error
          );
        }),
        onStart(() => this.isIgnoredDocsLoading$.setValue(true)),
        onComplete(() => this.isIgnoredDocsLoading$.setValue(false))
      );
    })
  );

  updateIgnoredDocs = effect(
    exhaustMap(({ add, remove }: { add: string[]; remove: string[] }) => {
      return fromPromise(signal =>
        this.store.updateIgnoredDocs(
          this.workspaceService.workspace.id,
          add,
          remove,
          signal
        )
      ).pipe(
        smartRetry(),
        concatMap(() => {
          this.getIgnoredDocs();
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to update workspace doc embedding ignored docs',
            error
          );
        })
      );
    })
  );

  getAttachments = effect(
    exhaustMap((pagination: PaginationInput) => {
      return fromPromise(signal =>
        this.store.getEmbeddingFiles(
          this.workspaceService.workspace.id,
          pagination,
          signal
        )
      ).pipe(
        smartRetry(),
        mergeMap(value => {
          this.attachments$.next(value);
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to fetch workspace doc embedding attachments',
            error
          );
        }),
        onStart(() => this.isAttachmentsLoading$.setValue(true)),
        onComplete(() => this.isAttachmentsLoading$.setValue(false))
      );
    })
  );

  addAttachments = effect(
    exhaustMap((files: File[]) => {
      return fromPromise(signal =>
        this.store.addEmbeddingFiles(
          this.workspaceService.workspace.id,
          files,
          signal
        )
      ).pipe(
        concatMap(() => {
          this.getAttachments({ first: COUNT_PER_PAGE, after: null });
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to add workspace doc embedding attachments',
            error
          );
        })
      );
    })
  );

  removeAttachment = effect(
    exhaustMap((id: string) => {
      return fromPromise(signal =>
        this.store.removeEmbeddingFile(
          this.workspaceService.workspace.id,
          id,
          signal
        )
      ).pipe(
        concatMap(() => {
          this.getAttachments({ first: COUNT_PER_PAGE, after: null });
          return EMPTY;
        }),
        catchErrorInto(this.error$, error => {
          logger.error(
            'Failed to remove workspace doc embedding attachment',
            error
          );
        })
      );
    })
  );

  startEmbeddingProgressPolling() {
    this.getEmbeddingProgress();
  }

  stopEmbeddingProgressPolling() {
    this.stopEmbeddingProgress$.next();
  }

  getEmbeddingProgress = effect(
    exhaustMap(() => {
      return interval(this.EMBEDDING_PROGRESS_POLL_INTERVAL).pipe(
        takeUntil(this.stopEmbeddingProgress$),
        switchMap(() =>
          fromPromise(signal =>
            this.store.getEmbeddingProgress(
              this.workspaceService.workspace.id,
              signal
            )
          ).pipe(
            smartRetry(),
            mergeMap(value => {
              this.embeddingProgress$.next(value);
              if (value && value.embedded === value.total && value.total > 0) {
                this.stopEmbeddingProgressPolling();
              }
              return EMPTY;
            }),
            catchErrorInto(this.error$, error => {
              logger.error(
                'Failed to fetch workspace embedding progress',
                error
              );
            }),
            onStart(() => this.isEmbeddingProgressLoading$.setValue(true)),
            onComplete(() => this.isEmbeddingProgressLoading$.setValue(false))
          )
        )
      );
    })
  );

  override dispose(): void {
    console.log('dispose');
    this.getEnabled.unsubscribe();
    this.getAttachments.unsubscribe();
    this.getIgnoredDocs.unsubscribe();
    this.updateIgnoredDocs.unsubscribe();
    this.addAttachments.unsubscribe();
    this.removeAttachment.unsubscribe();
    this.setEnabled.unsubscribe();
    this.stopEmbeddingProgress$.next();
    this.getEmbeddingProgress.unsubscribe();
  }
}
