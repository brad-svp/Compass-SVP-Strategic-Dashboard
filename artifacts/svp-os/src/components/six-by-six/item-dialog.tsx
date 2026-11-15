import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { SixItem, SixItemInputStatus, Staff } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { ITEM_STATUS, ITEM_STATUSES, type SixActions } from '@/lib/six-by-six';
import { fmtDate } from '@/lib/format';
import { Btn, ConflictNotice, Field, FormError, inputCls } from './form-kit';

export type ItemTarget = { item: SixItem | null; momentId: string; ownerId: string; momentLabel: string; periodName: string; nonce: number };

export function ItemDialog({ target, staff, actor, actions, onClose, onReopen }: {
  target: ItemTarget | null; staff: Staff[]; actor: Staff; actions: SixActions; onClose: () => void; onReopen: () => void;
}) {
  const owner = target ? staff.find((s) => s.id === (target.item?.ownerId ?? target.ownerId)) : undefined;
  const editable = target ? (target.item ? target.item.canEdit : true) : false;
  const title = !target ? '' : !target.item ? 'Add item' : editable ? 'Edit item' : 'Item details';
  const desc = target ? `${target.momentLabel} · ${target.periodName}${owner ? ` · ${owner.name}` : ''}` : '';
  return (
    <BrowserDialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }} title={title} description={desc}>
      {target && (editable
        ? <ItemForm key={`${target.item?.id ?? 'new'}-${target.nonce}`} target={target} staff={staff} actor={actor} actions={actions} onClose={onClose} onReopen={onReopen} />
        : target.item && <ItemReadOnly item={target.item} owner={owner} onClose={onClose} />)}
    </BrowserDialog>
  );
}

function ItemReadOnly({ item, owner, onClose }: { item: SixItem; owner?: Staff; onClose: () => void }) {
  const st = ITEM_STATUS[item.status];
  return (
    <div className="space-y-4" data-testid="view-item-readonly">
      <div className="font-display text-xl font-semibold text-[#0A2540]">{item.title}</div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${st.chip}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}
      </span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3A4E63]">{item.description || 'No description.'}</p>
      <p className="text-[12px] text-muted-foreground">Owned by {owner?.name ?? 'a former teammate'} · updated {fmtDate(item.updatedAt)}. Only the owner or an admin can change it.</p>
      <div className="flex justify-end"><Btn tone="ghost" type="button" onClick={onClose}>Close</Btn></div>
    </div>
  );
}

function ItemForm({ target, staff, actor, actions, onClose, onReopen }: {
  target: ItemTarget; staff: Staff[]; actor: Staff; actions: SixActions; onClose: () => void; onReopen: () => void;
}) {
  const it = target.item;
  // Captured once per open; polling never touches the draft.
  const [version] = useState(it?.version ?? 0);
  const [title, setTitle] = useState(it?.title ?? '');
  const [description, setDescription] = useState(it?.description ?? '');
  const [status, setStatus] = useState<SixItemInputStatus>(it?.status ?? 'planned');
  const [ownerId, setOwnerId] = useState(it?.ownerId ?? target.ownerId);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAdmin = actor.role === 'admin';
  const originalOwner = it?.ownerId;
  const ownerOptions = staff.filter((s) => s.active || s.id === originalOwner);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (conflict) return;
    if (!title.trim()) { setError('Give the item a title.'); return; }
    const chosen = staff.find((s) => s.id === ownerId);
    if (!chosen || (!chosen.active && ownerId !== originalOwner)) { setError('Choose an active teammate as owner.'); return; }
    setBusy(true); setError(null);
    const res = it
      ? await actions.updateItem(it.id, { ownerId, title: title.trim(), description, status, expectedVersion: version })
      : await actions.createItem({ momentId: target.momentId, ownerId, title: title.trim(), description, status });
    setBusy(false);
    if (res.ok) onClose();
    else { setError(res.message); setConflict(res.conflict); }
  }

  async function remove() {
    if (!it || conflict) return;
    setBusy(true); setError(null);
    const res = await actions.deleteItem(it.id, version);
    setBusy(false);
    if (res.ok) onClose();
    else { setError(res.message); setConflict(res.conflict); setConfirmDelete(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-six-item">
      {conflict && <ConflictNotice onReopen={onReopen} />}
      <Field label="Title">
        <input className={inputCls} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} required autoFocus data-testid="input-item-title" />
      </Field>
      <Field label="Description" hint="Optional. What does done look like?">
        <textarea className={`${inputCls} min-h-[96px]`} value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} data-testid="input-item-description" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as SixItemInputStatus)} data-testid="select-item-status">
            {ITEM_STATUSES.map((s) => <option key={s} value={s}>{ITEM_STATUS[s].label}</option>)}
          </NativeSelect>
        </Field>
        {isAdmin && (
          <Field label="Owner">
            <NativeSelect value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-testid="select-item-owner">
              {ownerOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
            </NativeSelect>
          </Field>
        )}
      </div>
      <FormError message={conflict ? null : error} />
      {confirmDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/[0.05] px-3 py-2.5" data-testid="confirm-delete-item">
          <span className="text-sm text-[#8E2D58]">Remove this item? It leaves the grid but stays in the audit log.</span>
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep</Btn>
            <Btn tone="danger" type="button" onClick={remove} disabled={busy} data-testid="button-confirm-delete-item">{busy ? 'Removing' : 'Remove'}</Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {it ? (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={conflict || busy}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8E2D58] hover:underline disabled:opacity-50" data-testid="button-delete-item">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" disabled={busy || conflict} data-testid="button-save-item">{busy ? 'Saving' : it ? 'Save changes' : 'Add item'}</Btn>
          </div>
        </div>
      )}
    </form>
  );
}
