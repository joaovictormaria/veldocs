import type { DocumentFileRecord, DocumentFileRepository } from "@/application/ports/document-file-repository";
import type { PrismaClient } from "@/generated/prisma/client";

const fileSelect = {
  id: true,
  documentId: true,
  objectKey: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  status: true,
  uploadExpiresAt: true,
  availableAt: true,
  createdAt: true,
  uploadedBy: { select: { userId: true, user: { select: { name: true } } } },
} as const;

type FileRow = {
  id: string;
  documentId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentFileRecord["status"];
  uploadExpiresAt: Date;
  availableAt: Date | null;
  createdAt: Date;
  uploadedBy: { userId: string; user: { name: string } };
};

const toRecord = ({ uploadedBy, ...row }: FileRow): DocumentFileRecord => ({
  ...row,
  uploadedBy: { userId: uploadedBy.userId, name: uploadedBy.user.name },
});

/**
 * Metadados dos arquivos. Toda busca exige empresa, documento vivo e arquivo
 * não excluído; mudanças de situação só acontecem a partir de PENDING, então
 * duas conclusões simultâneas não produzem dois eventos.
 */
export function createPrismaDocumentFileRepository(prisma: PrismaClient): DocumentFileRepository {
  const findFile = async (companyId: string, documentId: string, fileId: string) => {
    const row = await prisma.documentFile.findFirst({
      where: { id: fileId, companyId, documentId, deletedAt: null, document: { deletedAt: null } },
      select: fileSelect,
    });
    return row ? toRecord(row) : null;
  };

  return {
    async documentExists(companyId, documentId) {
      return (await prisma.document.count({ where: { id: documentId, companyId, deletedAt: null } })) > 0;
    },

    async createPending(file) {
      const row = await prisma.documentFile.create({
        data: {
          id: file.id,
          companyId: file.companyId,
          documentId: file.documentId,
          objectKey: file.objectKey,
          fileName: file.fileName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          uploadedById: file.uploadedById,
          uploadExpiresAt: file.uploadExpiresAt,
        },
        select: fileSelect,
      });
      return toRecord(row);
    },

    findFile,

    async markAvailable(companyId, fileId, at) {
      const { count } = await prisma.documentFile.updateMany({
        where: { id: fileId, companyId, status: "PENDING", deletedAt: null },
        data: { status: "AVAILABLE", availableAt: at },
      });
      if (count === 0) return null;

      const row = await prisma.documentFile.findFirst({ where: { id: fileId, companyId }, select: fileSelect });
      return row ? toRecord(row) : null;
    },

    async markRejected(companyId, fileId, reason) {
      await prisma.documentFile.updateMany({
        where: { id: fileId, companyId, status: "PENDING" },
        data: { status: "REJECTED", rejectionReason: reason.slice(0, 200) },
      });
    },

    async listAvailable(companyId, documentId) {
      const rows = await prisma.documentFile.findMany({
        where: { companyId, documentId, status: "AVAILABLE", deletedAt: null, document: { deletedAt: null } },
        orderBy: [{ availableAt: "desc" }, { id: "desc" }],
        select: fileSelect,
      });
      return rows.map(toRecord);
    },

    async softDelete(companyId, documentId, fileId, at) {
      const { count } = await prisma.documentFile.updateMany({
        where: { id: fileId, companyId, documentId, deletedAt: null },
        data: { deletedAt: at },
      });
      return count > 0;
    },
  };
}
