import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  completeBrainUpload, downloadBrainFile, downloadBrainSkill, requestBrainUpload,
  getGetBrainQueryKey, getGetBrainEntryQueryKey, getGetBrainAdminQueryKey,
  type BrainEntry, type BrainEntryInput,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus } from '@/lib/format';

export const BRAIN_KINDS = ['playbook', 'procedure', 'strategy', 'decision', 'lesson', 'reference'] as const;
export const BRAIN_STATUSES = ['all', 'unreviewed', 'reviewed', 'overdue', 'conflicts', 'retired'] as const;
export const MAX_BRAIN_FILE = 20 * 1024 * 1024;

export const kindLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function entryToInput(e: BrainEntry): BrainEntryInput {
  return {
    title: e.title, summary: e.summary, content: e.content, kind: e.kind, programId: e.programId, areaId: e.areaId,
    ownerId: e.ownerId, tags: e.tags, sourceUrls: e.sourceUrls, links: e.links, visibility: e.visibility,
    reviewIntervalDays: e.reviewIntervalDays, expectedVersion: e.version,
  };
}

export function useBrainInvalidate() {
  const qc = useQueryClient();
  return (entryId?: string) => {
    qc.invalidateQueries({ queryKey: getGetBrainQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBrainAdminQueryKey() });
    if (entryId) qc.invalidateQueries({ queryKey: getGetBrainEntryQueryKey(entryId) });
  };
}

export function useBrainToastError() {
  const { toast } = useToast();
  return (e: unknown, title = 'Not saved') => {
    const conflict = errorStatus(e) === 409;
    toast({
      title: conflict ? 'Changed elsewhere' : title,
      description: conflict ? 'Someone changed this since you opened it. Reload to see the current version.' : errorMessage(e),
      variant: 'destructive',
    });
  };
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Same-origin, cookie-carrying download through the generated client. */
export async function downloadFile(id: string, name: string) {
  const blob = await downloadBrainFile(id, { credentials: 'same-origin', responseType: 'blob' });
  saveBlob(blob, name);
}
export async function downloadSkill() {
  const blob = await downloadBrainSkill({ credentials: 'same-origin', responseType: 'blob' });
  saveBlob(blob, 'svp-brain-skill.zip');
}

export function validateBrainFile(file: File): string | null {
  if (file.size < 1) return 'This file is empty.';
  if (file.size > MAX_BRAIN_FILE) return `Files must be 20 MB or smaller (this one is ${fmtBytes(file.size)}).`;
  if (!file.name || file.name.length > 240) return 'File name must be between 1 and 240 characters.';
  return null;
}

/** Request signed URL -> PUT bytes directly to storage (no cookies) -> mark complete. */
export function useBrainUpload(entryId: string) {
  const [busy, setBusy] = useState<string | null>(null);
  const invalidate = useBrainInvalidate();
  async function upload(file: File, expectedVersion: number, replacesId?: string) {
    const invalid = validateBrainFile(file);
    if (invalid) throw new Error(invalid);
    setBusy(file.name);
    try {
      const contentType = (file.type || 'application/octet-stream').slice(0, 150);
      const req = await requestBrainUpload({ entryId, name: file.name, size: file.size, contentType, expectedVersion, ...(replacesId ? { replacesId } : {}) });
      const put = await fetch(req.uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': contentType }, credentials: 'omit' });
      if (!put.ok) throw new Error(`Storage rejected the upload (HTTP ${put.status}).`);
      await completeBrainUpload(req.id);
    } finally {
      setBusy(null);
      invalidate(entryId);
    }
  }
  return { upload, busy };
}
