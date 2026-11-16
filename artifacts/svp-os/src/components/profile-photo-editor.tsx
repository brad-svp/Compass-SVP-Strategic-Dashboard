import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetFoundationQueryKey, getGetSessionQueryKey, type Staff } from '@workspace/api-client-react';
import { Camera, Trash2 } from 'lucide-react';
import { StaffAvatar } from './ui-bits';
import { Button } from './ui/button';
import { errorMessage } from '@/lib/format';

export function ProfilePhotoEditor({ person }: { person: Staff }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(file?: File) {
    setError(''); setMessage('');
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Choose a PNG, JPEG or WebP photo of 5 MB or less.'); return;
    }
    setBusy(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const response = await fetch(`${base}/api/svp/staff/${encodeURIComponent(person.id)}/photo`, {
        method: file ? 'POST' : 'DELETE', credentials: 'include',
        ...(file ? { headers: { 'Content-Type': 'application/octet-stream' }, body: file } : {}),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw Error(result.error ?? 'The photo could not be saved. Please try again.');
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() }),
      ]);
      setMessage(file ? 'Photo saved.' : 'Photo removed.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return (
    <div className="space-y-2" data-testid={`photo-editor-${person.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <StaffAvatar name={person.name} url={person.avatarUrl} color="#1D8BC4" size="h-16 w-16" />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy} data-testid="button-upload-photo">
              <Camera className="mr-1.5 h-4 w-4" />{busy ? 'Saving…' : person.avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {person.avatarUrl && <Button type="button" variant="ghost" size="sm" onClick={() => save()} disabled={busy} data-testid="button-remove-photo"><Trash2 className="mr-1 h-4 w-4" />Remove</Button>}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · up to 5 MB · cropped to a square</p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`Profile photo for ${person.name}`}
        onChange={e => { const file = e.target.files?.[0]; if (file) void save(file); }} disabled={busy} data-testid="input-profile-photo" />
      {error && <p role="alert" className="text-sm text-[#8E2D58]">{error}</p>}
      {message && <p role="status" className="text-sm text-[#22702A]">{message}</p>}
    </div>
  );
}
