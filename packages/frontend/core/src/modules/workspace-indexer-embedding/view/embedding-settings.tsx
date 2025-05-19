import { Button, Switch } from '@affine/component';
import {
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { Upload } from '@affine/core/components/pure/file-upload';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { EmbeddingService } from '../services/embedding';
import { Attachments } from './attachments';
import EmbeddingProgress from './embedding-progress';
import { IgnoredDocs } from './ignored-docs';

interface EmbeddingSettingsProps {}

export const EmbeddingSettings: React.FC<EmbeddingSettingsProps> = () => {
  const t = useI18n();
  const embeddingService = useService(EmbeddingService);
  const embeddingEnabled = useLiveData(embeddingService.embedding.enabled$);
  const attachments = useLiveData(embeddingService.embedding.attachments$);
  const ignoredDocs = useLiveData(embeddingService.embedding.ignoredDocs$);
  const embeddingProgress = useLiveData(
    embeddingService.embedding.embeddingProgress$
  );

  const isIgnoredDocsLoading = useLiveData(
    embeddingService.embedding.isIgnoredDocsLoading$
  );
  const isAttachmentsLoading = useLiveData(
    embeddingService.embedding.isAttachmentsLoading$
  );
  const attachmentNodes = useMemo(
    () => attachments.edges.map(edge => edge.node),
    [attachments]
  );
  const ignoredDocNodes = ignoredDocs;
  const workspaceDialogService = useService(WorkspaceDialogService);

  const handleEmbeddingToggle = useCallback(
    (checked: boolean) => {
      embeddingService.embedding.setEnabled(checked);
    },
    [embeddingService.embedding]
  );

  const handleAttachmentUpload = useCallback(
    (file: File) => {
      embeddingService.embedding.addAttachments([file]);
    },
    [embeddingService.embedding]
  );

  const handleAttachmentsDelete = useCallback(
    (fileId: string) => {
      embeddingService.embedding.removeAttachment(fileId);
    },
    [embeddingService.embedding]
  );

  const handleAttachmentsPageChange = useCallback(
    (offset: number) => {
      embeddingService.embedding.getAttachments({
        offset,
        after: attachments.pageInfo.endCursor,
      });
    },
    [embeddingService.embedding, attachments.pageInfo.endCursor]
  );

  const handleSelectDoc = useCallback(() => {
    if (isIgnoredDocsLoading) {
      return;
    }
    const initialIds = ignoredDocNodes.map(doc => doc.docId);
    workspaceDialogService.open(
      'doc-selector',
      {
        init: initialIds,
      },
      selectedIds => {
        if (selectedIds === undefined) {
          return;
        }
        const add = selectedIds.filter(id => !initialIds?.includes(id));
        const remove = initialIds?.filter(id => !selectedIds.includes(id));
        embeddingService.embedding.updateIgnoredDocs({ add, remove });
      }
    );
  }, [
    ignoredDocNodes,
    isIgnoredDocsLoading,
    workspaceDialogService,
    embeddingService.embedding,
  ]);

  useEffect(() => {
    embeddingService.embedding.startEmbeddingProgressPolling();
    return () => {
      embeddingService.embedding.stopEmbeddingProgressPolling();
    };
  }, [embeddingService.embedding]);

  return (
    <SettingWrapper
      title={t[
        'com.affine.settings.workspace.indexer-embedding.embedding.title'
      ]()}
      testId="workspace-embedding-setting-wrapper"
    >
      <SettingRow
        name=""
        desc={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.description'
        ]()}
      ></SettingRow>
      <SettingRow
        name={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.switch.title'
        ]()}
        desc={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.switch.description'
        ]()}
      >
        <Switch
          data-testid="workspace-embedding-setting-switch"
          checked={embeddingEnabled}
          onChange={handleEmbeddingToggle}
        />
      </SettingRow>

      <SettingRow
        name={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.progress.title'
        ]()}
        style={{ marginBottom: '0px' }}
      />

      <EmbeddingProgress status={embeddingProgress} />

      <SettingRow
        name={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.title'
        ]()}
        desc={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.description'
        ]()}
      >
        <Upload fileChange={handleAttachmentUpload}>
          <Button
            data-testid="workspace-embedding-setting-upload-button"
            variant="primary"
          >
            {t['Upload']()}
          </Button>
        </Upload>
      </SettingRow>

      {attachmentNodes.length > 0 && (
        <Attachments
          attachments={attachmentNodes}
          isLoading={isAttachmentsLoading}
          onDelete={handleAttachmentsDelete}
          totalCount={attachments.totalCount}
          onPageChange={handleAttachmentsPageChange}
        />
      )}

      <SettingRow
        name={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.title'
        ]()}
        desc={t[
          'com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.description'
        ]()}
      >
        <Button
          data-testid="workspace-embedding-setting-ignore-docs-button"
          variant="primary"
          onClick={handleSelectDoc}
        >
          {t[
            'com.affine.settings.workspace.indexer-embedding.embedding.select-doc'
          ]()}
        </Button>
      </SettingRow>

      {ignoredDocNodes.length > 0 && (
        <IgnoredDocs
          ignoredDocs={ignoredDocNodes}
          isLoading={isIgnoredDocsLoading}
        />
      )}
    </SettingWrapper>
  );
};
