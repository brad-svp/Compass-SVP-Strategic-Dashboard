import { useRef, useState } from 'react';
import { useRemoveBrainFile, type BrainFile } from '@workspace/api-client-react';
import { Download, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { downloadFile, fmtBytes, useBrainInvalidate, useBrainToastError, useBrainUpload } from '@/lib/brain';

const STATUS_TONE: Record<string, string> = {
  ready: 'text-[#22702A] bg-[#22702A]/10', extracted: 'text-[#22702A] bg-[#22702A]/10', indexed: 'text-[#22702A] bg-[#22702A]/10',
  failed: 'text-[#8C2F59] bg-[#B03E71]/10', error: 'text-[#8C2F59] bg-[#B03E71]/10',
  searchable: 'text-[#22702A] bg-[#22702A]/10',
  text_empty: 'text-[#72500A] bg-[#ECA519]/15', unsupported: 'text-[#72500A] bg-[#ECA519]/15',
};

export function FilesPanel({ entryId, version, files, canEdit }: { entryId: string; version: number; files: BrainFile[]; canEdit: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | undefined>();
  const [downloading, setDownloading] = useState<string | null>(null);
  const { upload, busy } = useBrainUpload(entryId);
  const remove = useRemoveBrainFile();
  const invalidate = useBrainInvalidate();
  const fail = useBrainToastError();
  const { toast } = useToast();

  async function onPick(list: FileList | null) {
    const file = list?.[0];
    if (input.current) input.current.value = '';
    if (!file) return;
    try {
      await upload(file, version, replaceId);
      toast({ title: 'Uploaded', description: `${file.name} is queued for text extraction.` });
    } catch (e) { fail(e, 'Upload failed'); }
    setReplaceId(undefined);
  }
  async function onDownload(f: BrainFile) {
    setDownloading(f.id);
    try { await downloadFile(f.id, f.name); } catch (e) { toast({ title: 'Download failed', description: errorMessage(e), variant: 'destructive' }); }
    setDownloading(null);
  }

  return (
    <section className="rounded-xl border border-card-border bg-card" data-testid="panel-brain-files">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Files <span className="font-mono text-muted-foreground">{files.length}</span></h2>
        {canEdit && <>
          <input ref={input} type="file" hidden onChange={(e) => onPick(e.target.files)} data-testid="input-brain-file" />
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setReplaceId(undefined); input.current?.click(); }} data-testid="button-brain-upload">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}{busy ? 'Uploading' : 'Upload'}
          </Button>
        </>}
      </header>
      {busy && <div className="border-b border-border bg-[#1D8BC4]/5 px-4 py-2 text-xs text-[#0A2540]" data-testid="status-brain-uploading">Sending {busy} directly to storage...</div>}
      {files.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground" data-testid="text-brain-files-empty">No files attached. {canEdit ? 'PDF, docs and text up to 20 MB.' : ''}</p>
      ) : (
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-start gap-3 px-4 py-2.5" data-testid={`row-brain-file-${f.id}`}>
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#1D8BC4]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#0A2540]">{f.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted-foreground">
                  <span>{fmtBytes(f.size)}</span><span>{fmtDate(f.createdAt)}</span>
                  <span className={cn('rounded px-1.5 py-px font-sans font-semibold', STATUS_TONE[f.status] ?? 'bg-[#ECA519]/15 text-[#72500A]')} data-testid={`status-brain-file-${f.id}`}>{f.status}</span>
                </div>
                {f.error && <p className="mt-1 text-[11px] text-[#8C2F59]">{f.error}</p>}
                {f.status === 'text_empty' && <p className="mt-1 text-[11px] text-[#72500A]">No extractable text. Scanned PDFs require a text/OCR version before their contents can be searched.</p>}
                {f.status === 'unsupported' && <p className="mt-1 text-[11px] text-[#72500A]">Stored as an attachment only. Searchable formats: TXT, Markdown, CSV, PDF and DOCX.</p>}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Download" disabled={downloading === f.id} onClick={() => onDownload(f)} data-testid={`button-brain-file-download-${f.id}`}>
                  {downloading === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</Button>
                {canEdit && <>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Replace" disabled={!!busy} onClick={() => { setReplaceId(f.id); input.current?.click(); }} data-testid={`button-brain-file-replace-${f.id}`}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-[#8C2F59]" aria-label="Remove" disabled={remove.isPending}
                    onClick={() => { if (window.confirm(`Remove ${f.name}?`)) remove.mutate({ id: f.id, data: { expectedVersion: version } }, { onSuccess: () => invalidate(entryId), onError: (e) => fail(e) }); }}
                    data-testid={`button-brain-file-remove-${f.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
