import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, Undo, Redo, Type } from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Nhập nội dung...' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const addLink = () => {
    const url = prompt('URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 bg-bg-surface border-b border-border-subtle">
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolBtn>
        <div className="w-px h-5 bg-border-subtle mx-1" />
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Type size={14} /></ToolBtn>
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolBtn>
        <div className="w-px h-5 bg-border-subtle mx-1" />
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={14} /></ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={14} /></ToolBtn>
        <div className="w-px h-5 bg-border-subtle mx-1" />
        <ToolBtn active={editor.isActive('link')} onClick={addLink}><LinkIcon size={14} /></ToolBtn>
        <ToolBtn active={false} onClick={addImage}><ImageIcon size={14} /></ToolBtn>
        <div className="w-px h-5 bg-border-subtle mx-1" />
        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()}><Undo size={14} /></ToolBtn>
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()}><Redo size={14} /></ToolBtn>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} className="prose prose-sm max-w-none px-4 py-3 min-h-[150px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px] text-[13px]" />
    </div>
  );
}

function ToolBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`p-1.5 rounded ${active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-surface hover:text-text-primary'}`}>
      {children}
    </button>
  );
}
