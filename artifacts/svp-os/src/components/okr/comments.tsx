import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import type { Comment, Staff } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StaffAvatar } from '@/components/ui-bits';
import type { OkrActions } from '@/lib/okr';

function ago(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); } catch { return iso; }
}

export function CommentThread({ entityType, entityId, comments, staff, actions }: {
  entityType: 'objective' | 'key_result'; entityId: string; comments: Comment[]; staff: Staff[]; actions: OkrActions;
}) {
  const list = comments.filter((c) => c.entityType === entityType && c.entityId === entityId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [body, setBody] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const add = async () => {
    if (!body.trim()) return;
    if (await actions.createComment({ entityType, entityId, body: body.trim() })) setBody('');
  };

  return (
    <div className="space-y-3" data-testid={`comments-${entityId}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">
        <MessageSquare className="h-3.5 w-3.5" /> Discussion <span className="font-mono text-muted-foreground">{list.length}</span>
      </div>
      {list.length === 0 && <p className="text-[13px] text-muted-foreground">No comments yet. Ask a question or share context.</p>}
      <ul className="space-y-3">
        {list.map((c) => {
          const author = staff.find((s) => s.id === c.authorId);
          return (
            <li key={c.id} className="group flex gap-3" data-testid={`comment-${c.id}`}>
              <StaffAvatar name={author?.name ?? 'Former staff'} url={author?.avatarUrl} size="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-semibold text-[#0A2540]">{author?.name ?? 'Former staff'}</span>
                  <span className="text-muted-foreground">{ago(c.createdAt)}{c.editedAt ? ' · edited' : ''}</span>
                  {c.canEdit && editId !== c.id && (
                    <span className="ml-auto flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <button className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/5" onClick={() => { setEditId(c.id); setEditBody(c.body); }} aria-label="Edit comment" data-testid={`button-edit-comment-${c.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-[#B03E71] hover:bg-[#B03E71]/10" onClick={() => actions.deleteComment(c.id)} aria-label="Delete comment" data-testid={`button-delete-comment-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  )}
                </div>
                {editId === c.id ? (
                  <div className="mt-1 space-y-2">
                    <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} data-testid={`input-edit-comment-${c.id}`} />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[#0A2540] text-white" disabled={!editBody.trim() || actions.pending} data-testid={`button-save-comment-${c.id}`}
                        onClick={async () => { if (await actions.updateComment(c.id, editBody.trim())) setEditId(null); }}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1E3349]">{c.body}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-end gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} maxLength={8000} placeholder="Add a comment"
          className="min-h-[40px] resize-none bg-white/70" data-testid={`input-comment-${entityId}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add(); }} />
        <Button onClick={add} disabled={!body.trim() || actions.pending} className="bg-[#0A2540] text-white" data-testid={`button-add-comment-${entityId}`}>Post</Button>
      </div>
    </div>
  );
}
