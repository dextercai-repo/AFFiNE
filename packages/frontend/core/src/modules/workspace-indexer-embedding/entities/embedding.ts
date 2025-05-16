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
import { EMPTY, of } from 'rxjs';
import {
  concatMap,
  exhaustMap,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs/operators';

import { COUNT_PER_PAGE } from '../constants';
import type { EmbeddingStore } from '../stores/embedding';
import type {
  AttachmentFile,
  IgnoredDoc,
  LocalAttachmentFile,
  PersistedAttachmentFile,
} from '../types';

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
    node: PersistedAttachmentFile;
  }[];
}

type IgnoredDocs = IgnoredDoc[];

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
  uploadingAttachments$ = new LiveData<LocalAttachmentFile[]>([]);
  mergedAttachments$ = new LiveData<AttachmentFile[]>([]);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly store: EmbeddingStore
  ) {
    super();
    this.getEnabled();
    this.getAttachments({ first: COUNT_PER_PAGE, after: null });
    this.getIgnoredDocs();
    this.uploadingAttachments$.subscribe(() => this.updateMergedAttachments());
    this.attachments$.subscribe(() => this.updateMergedAttachments());
    this.updateMergedAttachments();
  }

  private updateMergedAttachments() {
    const uploading = this.uploadingAttachments$.value;
    const uploaded = this.attachments$.value.edges.map(edge => edge.node);
    this.mergedAttachments$.next([...uploading, ...uploaded].slice(0, 10));
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
          const patched = {
            ...value,
            edges: value.edges.map(edge => ({
              ...edge,
              node: {
                ...edge.node,
                status: 'uploaded' as const,
              },
            })),
          };
          this.attachments$.next(patched);
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
    // Support parallel upload
    mergeMap((files: File[]) => {
      const generateLocalId = () =>
        Math.random().toString(36).slice(2) + Date.now();
      const localAttachments: LocalAttachmentFile[] = files.map(file => ({
        localId: generateLocalId(),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: file.lastModified,
        status: 'uploading',
      }));

      return of({ files, localAttachments }).pipe(
        // Refresh uploading attachments immediately
        tap(({ localAttachments }) => {
          this.uploadingAttachments$.next([
            ...localAttachments,
            ...this.uploadingAttachments$.value,
          ]);
        }),
        // Uploading embedding files
        switchMap(({ files }) => {
          return fromPromise(signal =>
            this.store.addEmbeddingFiles(
              this.workspaceService.workspace.id,
              files,
              signal
            )
          );
        }),
        // Refresh uploading attachments
        tap(() => {
          this.uploadingAttachments$.next(
            this.uploadingAttachments$.value.filter(
              att => !localAttachments.some(l => l.localId === att.localId)
            )
          );
          this.getAttachments({ first: COUNT_PER_PAGE, after: null });
        }),
        catchErrorInto(this.error$, error => {
          this.uploadingAttachments$.next(
            this.uploadingAttachments$.value.map(att =>
              localAttachments.some(l => l.localId === att.localId)
                ? { ...att, status: 'error', errorMessage: String(error) }
                : att
            )
          );
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
      const localIndex = this.uploadingAttachments$.value.findIndex(
        att => att.localId === id
      );
      if (localIndex !== -1) {
        this.uploadingAttachments$.next(
          this.uploadingAttachments$.value.filter(att => att.localId !== id)
        );
        return EMPTY;
      }
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

  override dispose(): void {
    this.getEnabled.unsubscribe();
    this.getAttachments.unsubscribe();
    this.getIgnoredDocs.unsubscribe();
    this.updateIgnoredDocs.unsubscribe();
    this.addAttachments.unsubscribe();
    this.removeAttachment.unsubscribe();
    this.setEnabled.unsubscribe();
  }
}
