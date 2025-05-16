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
import { useCallback } from 'react';

import { EmbeddingService } from '../services/embedding';
import { Attachments } from './attachments';
import { IgnoredDocs } from './ignored-docs';

interface EmbeddingSettingsProps {}

export const EmbeddingSettings: React.FC<EmbeddingSettingsProps> = () => {
  const t = useI18n();
  const embeddingService = useService(EmbeddingService);
  const embeddingEnabled = useLiveData(embeddingService.embedding.enabled$);
  const { pageInfo, totalCount } = useLiveData(
    embeddingService.embedding.attachments$
  );
  const attachments = useLiveData(
    embeddingService.embedding.mergedAttachments$
  );
  const ignoredDocs = useLiveData(embeddingService.embedding.ignoredDocs$);
  const isIgnoredDocsLoading = useLiveData(
    embeddingService.embedding.isIgnoredDocsLoading$
  );

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
        after: pageInfo.endCursor,
      });
    },
    [embeddingService.embedding, pageInfo.endCursor]
  );

  const handleSelectDoc = useCallback(() => {
    if (isIgnoredDocsLoading) {
      return;
    }
    const initialIds = ignoredDocs.map(doc => doc.docId);
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
    ignoredDocs,
    isIgnoredDocsLoading,
    workspaceDialogService,
    embeddingService.embedding,
  ]);

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

      {attachments.length > 0 && (
        <Attachments
          attachments={attachments}
          onDelete={handleAttachmentsDelete}
          totalCount={totalCount}
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
      {ignoredDocs.length > 0 && (
        <IgnoredDocs
          ignoredDocs={ignoredDocs}
          isLoading={isIgnoredDocsLoading}
        />
      )}
    </SettingWrapper>
  );
};
