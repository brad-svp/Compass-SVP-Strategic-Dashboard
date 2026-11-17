import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Undo2, Redo2, RemoveFormatting } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { narrativeHtml, RICH_TEXT_PREFIX } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import './rich-text.css';

export function RichTextDisplay({ value, className, testId }: { value: string; className?: string; testId?: string }) {
  return <div className={cn('svp-rich-text', className)} data-testid={testId}
    dangerouslySetInnerHTML={{ __html: narrativeHtml(value) }} />;
}

/** Each form mounts an editor for its initial draft; transactions update form state. */
export function RichTextEditor({ initialValue, onChange, label, testId, disabled = false }: {
  initialValue: string; onChange: (value: string) => void; label: string; testId: string; disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3] }, blockquote: false, code: false,
      codeBlock: false, horizontalRule: false, link: false, underline: false,
    })],
    content: narrativeHtml(initialValue),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: {
      role: 'textbox', 'aria-multiline': 'true', 'aria-label': label,
      'data-testid': testId, class: 'svp-rich-text min-h-[180px] px-3 py-3 outline-none',
    } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : RICH_TEXT_PREFIX + current.getHTML()),
  });
  if (!editor) return <div className="min-h-[230px] animate-pulse rounded-xl bg-muted" />;
  const controls: { name: string; icon: LucideIcon; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { name: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => { editor.chain().focus().toggleBold().run(); } },
    { name: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => { editor.chain().focus().toggleItalic().run(); } },
    { name: 'Heading 2', icon: Heading2, active: editor.isActive('heading', { level: 2 }), run: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); } },
    { name: 'Heading 3', icon: Heading3, active: editor.isActive('heading', { level: 3 }), run: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); } },
    { name: 'Bullet list', icon: List, active: editor.isActive('bulletList'), run: () => { editor.chain().focus().toggleBulletList().run(); } },
    { name: 'Numbered list', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => { editor.chain().focus().toggleOrderedList().run(); } },
    { name: 'Clear formatting', icon: RemoveFormatting, run: () => { editor.chain().focus().clearNodes().unsetAllMarks().run(); } },
    { name: 'Undo', icon: Undo2, disabled: !editor.can().undo(), run: () => { editor.chain().focus().undo().run(); } },
    { name: 'Redo', icon: Redo2, disabled: !editor.can().redo(), run: () => { editor.chain().focus().redo().run(); } },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-[#1D8BC4]/40">
      <div role="toolbar" aria-label="Narrative formatting" className="flex flex-wrap gap-1 border-b border-border bg-muted/40 p-1.5">
        {controls.map(({ name, icon: Icon, active, disabled: unavailable, run }) => (
          <button key={name} type="button" aria-label={name} title={name} aria-pressed={active}
            data-testid={`button-format-${name.toLowerCase().replaceAll(' ', '-')}`}
            disabled={disabled || unavailable} onMouseDown={event => event.preventDefault()} onClick={run}
            className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md text-[#0A2540] hover:bg-[#0A2540]/10 disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', active && 'bg-[#0A2540] text-white hover:bg-[#0A2540]')}>
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
