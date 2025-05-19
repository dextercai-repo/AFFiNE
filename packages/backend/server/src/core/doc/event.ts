import { Injectable } from '@nestjs/common';

import { JobQueue, OnEvent } from '../../base';
import { Models } from '../../models';
import { PgWorkspaceDocStorageAdapter } from './adapters/workspace';
import { DocReader } from './reader';

@Injectable()
export class DocEventsListener {
  constructor(
    private readonly docReader: DocReader,
    private readonly models: Models,
    private readonly workspace: PgWorkspaceDocStorageAdapter,
    private readonly queue: JobQueue
  ) {}

  @OnEvent('doc.snapshot.updated')
  async markDocContentCacheStale({
    workspaceId,
    docId,
    blob,
  }: Events['doc.snapshot.updated']) {
    await this.docReader.markDocContentCacheStale(workspaceId, docId);
    const isDoc = workspaceId !== docId;
    // update doc content to database
    if (isDoc) {
      const content = this.docReader.parseDocContent(blob);
      if (!content) {
        return;
      }
      await this.models.doc.upsertMeta(workspaceId, docId, content);
      await this.queue.add(
        'indexer.indexDoc',
        {
          workspaceId,
          docId,
        },
        {
          jobId: `indexDoc/${workspaceId}/${docId}`,
          priority: 100,
        }
      );
    } else {
      // update workspace content to database
      const content = this.docReader.parseWorkspaceContent(blob);
      if (!content) {
        return;
      }
      await this.models.workspace.update(workspaceId, content);
      await this.queue.add(
        'indexer.indexWorkspace',
        {
          workspaceId,
        },
        {
          jobId: `indexWorkspace/${workspaceId}`,
          priority: 100,
        }
      );
    }
  }

  @OnEvent('user.deleted')
  async clearUserWorkspaces(payload: Events['user.deleted']) {
    for (const workspace of payload.ownedWorkspaces) {
      await this.workspace.deleteSpace(workspace);
      await this.queue.add(
        'indexer.deleteWorkspace',
        {
          workspaceId: workspace,
        },
        {
          jobId: `deleteWorkspace/${workspace}`,
          priority: 0,
        }
      );
    }
  }
}
