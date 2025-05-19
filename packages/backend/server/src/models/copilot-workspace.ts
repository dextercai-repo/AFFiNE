import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { PaginationInput } from '../base';
import { BaseModel } from './base';
import type {
  CopilotWorkspaceFile,
  CopilotWorkspaceFileMetadata,
  Embedding,
  FileChunkSimilarity,
  IgnoredDoc,
} from './common';

@Injectable()
export class CopilotWorkspaceConfigModel extends BaseModel {
  private async listIgnoredDocIds(
    workspaceId: string,
    options?: PaginationInput
  ) {
    return await this.db.aiWorkspaceIgnoredDocs.findMany({
      where: {
        workspaceId,
      },
      select: {
        docId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.offset,
      take: options?.first,
    });
  }

  /**
   * find docs to embed, excluding ignored and already embedded docs
   * newer docs will be list first
   * @param workspaceId id of the workspace
   * @returns docIds
   */
  @Transactional()
  async findDocsToEmbed(workspaceId: string): Promise<string[]> {
    const docIds = await this.db.snapshot
      .findMany({
        where: {
          workspaceId,
          embedding: {
            is: null,
          },
        },
        select: { id: true },
      })
      .then(r => r.map(doc => doc.id));

    const skipDocIds = await this.listIgnoredDocIds(workspaceId).then(
      r => new Set(r.map(r => r.docId))
    );

    return docIds.filter(id => !skipDocIds.has(id));
  }

  @Transactional()
  async updateIgnoredDocs(
    workspaceId: string,
    add: string[] = [],
    remove: string[] = []
  ) {
    const removed = new Set(remove);
    const ignored = await this.listIgnoredDocIds(workspaceId).then(
      r => new Set(r.map(r => r.docId).filter(id => !removed.has(id)))
    );
    const added = add.filter(id => !ignored.has(id));

    const { count: addedCount } =
      await this.db.aiWorkspaceIgnoredDocs.createMany({
        data: added.map(docId => ({
          workspaceId,
          docId,
        })),
      });

    const { count: removedCount } =
      await this.db.aiWorkspaceIgnoredDocs.deleteMany({
        where: {
          workspaceId,
          docId: {
            in: Array.from(removed),
          },
        },
      });

    return addedCount + removedCount;
  }

  @Transactional()
  async listIgnoredDocs(
    workspaceId: string,
    options?: PaginationInput
  ): Promise<IgnoredDoc[]> {
    const row = await this.listIgnoredDocIds(workspaceId, options);
    const ids = row.map(r => ({ workspaceId, docId: r.docId }));
    const docs = await this.models.doc.findMetas(ids);
    const docsMap = new Map(
      docs.filter(r => !!r).map(r => [`${r.workspaceId}-${r.docId}`, r])
    );
    const authors = await this.models.doc.findAuthors(ids);
    const authorsMap = new Map(
      authors.filter(r => !!r).map(r => [`${r.workspaceId}-${r.id}`, r])
    );

    return row.map(r => {
      const docMeta = docsMap.get(`${workspaceId}-${r.docId}`);
      const docAuthor = authorsMap.get(`${workspaceId}-${r.docId}`);
      return {
        ...r,
        docCreatedAt: docAuthor?.createdAt,
        docUpdatedAt: docAuthor?.updatedAt,
        title: docMeta?.title || undefined,
        createdBy: docAuthor?.createdByUser?.name,
        createdByAvatar: docAuthor?.createdByUser?.avatarUrl || undefined,
        updatedBy: docAuthor?.updatedByUser?.name,
      };
    });
  }

  @Transactional()
  async countIgnoredDocs(workspaceId: string): Promise<number> {
    const count = await this.db.aiWorkspaceIgnoredDocs.count({
      where: {
        workspaceId,
      },
    });
    return count;
  }

  @Transactional()
  async checkIgnoredDocs(workspaceId: string, docIds: string[]) {
    const ignored = await this.listIgnoredDocIds(workspaceId).then(
      r => new Set(r.map(r => r.docId))
    );

    return docIds.filter(id => ignored.has(id));
  }

  // ================ embeddings ================

  async checkEmbeddingAvailable(): Promise<boolean> {
    const [{ count }] = await this.db.$queryRaw<
      { count: number }[]
    >`SELECT count(1) FROM pg_tables WHERE tablename in ('ai_workspace_file_embeddings')`;
    return Number(count) === 1;
  }

  private processEmbeddings(
    workspaceId: string,
    fileId: string,
    embeddings: Embedding[]
  ) {
    const groups = embeddings.map(e =>
      [
        workspaceId,
        fileId,
        e.index,
        e.content,
        Prisma.raw(`'[${e.embedding.join(',')}]'`),
      ].filter(v => v !== undefined)
    );
    return Prisma.join(groups.map(row => Prisma.sql`(${Prisma.join(row)})`));
  }

  async addFile(
    workspaceId: string,
    file: CopilotWorkspaceFileMetadata
  ): Promise<CopilotWorkspaceFile> {
    const fileId = randomUUID();
    const row = await this.db.aiWorkspaceFiles.create({
      data: { ...file, workspaceId, fileId },
    });

    return row;
  }

  async getFile(workspaceId: string, fileId: string) {
    const file = await this.db.aiWorkspaceFiles.findFirst({
      where: {
        workspaceId,
        fileId,
      },
    });
    return file;
  }

  @Transactional()
  async insertFileEmbeddings(
    workspaceId: string,
    fileId: string,
    embeddings: Embedding[]
  ) {
    const values = this.processEmbeddings(workspaceId, fileId, embeddings);
    await this.db.$executeRaw`
          INSERT INTO "ai_workspace_file_embeddings"
          ("workspace_id", "file_id", "chunk", "content", "embedding") VALUES ${values}
          ON CONFLICT (workspace_id, file_id, chunk) DO NOTHING;
      `;
  }

  async listFiles(
    workspaceId: string,
    options?: {
      includeRead?: boolean;
    } & PaginationInput
  ): Promise<CopilotWorkspaceFile[]> {
    const files = await this.db.aiWorkspaceFiles.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.offset,
      take: options?.first,
    });
    return files;
  }

  async countFiles(workspaceId: string): Promise<number> {
    const count = await this.db.aiWorkspaceFiles.count({
      where: {
        workspaceId,
      },
    });
    return count;
  }

  async matchFileEmbedding(
    workspaceId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<FileChunkSimilarity[]> {
    if (!(await this.allowEmbedding(workspaceId))) {
      return [];
    }

    const similarityChunks = await this.db.$queryRaw<
      Array<FileChunkSimilarity>
    >`
      SELECT
        e."file_id" as "fileId",
        f."file_name" as "name",
        f."blob_id" as "blobId",
        f."mime_type" as "mimeType",
        e."chunk",
        e."content",
        e."embedding" <=> ${embedding}::vector as "distance" 
      FROM "ai_workspace_file_embeddings" e
      JOIN "ai_workspace_files" f
        ON e."workspace_id" = f."workspace_id"
        AND e."file_id" = f."file_id"
      WHERE e.workspace_id = ${workspaceId}
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;
    return similarityChunks.filter(c => Number(c.distance) <= threshold);
  }

  async removeFile(workspaceId: string, fileId: string) {
    // embeddings will be removed by foreign key constraint
    await this.db.aiWorkspaceFiles.deleteMany({
      where: {
        workspaceId,
        fileId,
      },
    });
    return true;
  }

  private allowEmbedding(workspaceId: string) {
    return this.models.workspace.allowEmbedding(workspaceId);
  }
}
