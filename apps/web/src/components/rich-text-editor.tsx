"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Link2,
  ImagePlus,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MenuButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-1.5 rounded transition-colors",
      active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      disabled && "opacity-40 cursor-not-allowed",
    )}
  >
    {children}
  </button>
);

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your content...",
  className,
  minHeight = 200,
  onUploadImage,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-foreground underline underline-offset-2" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-md max-w-full h-auto" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rte-content min-w-0 outline-none text-xs text-foreground leading-relaxed px-3 py-2",
      },
      handleDOMEvents: {
        blur: (view) => {
          if (!view?.dom) return;
          const html = view.dom.innerHTML;
          if (html !== value) onChange(html);
        },
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && (value || "") !== (current === "<p></p>" ? "" : current)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const updateOnChange = useCallback(() => {
    if (editor) onChange(editor.getHTML());
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", updateOnChange);
    return () => {
      editor.off("update", updateOnChange);
    };
  }, [editor, updateOnChange]);

  if (!editor) {
    return (
      <div className={cn("border border-border/40 rounded-md bg-muted/20", className)} style={{ minHeight }}>
        <div className="animate-pulse h-full flex items-center justify-center text-[10px] text-muted-foreground/40">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border border-border/40 rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border/30 bg-muted/20">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <Code className="h-3 w-3" />
        </MenuButton>

        <div className="w-px h-4 bg-border/40 mx-0.5" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3 w-3" />
        </MenuButton>

        <div className="w-px h-4 bg-border/40 mx-0.5" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="h-3 w-3" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="h-3 w-3" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="h-3 w-3" />
        </MenuButton>

        <div className="w-px h-4 bg-border/40 mx-0.5" />

        <MenuButton
          onClick={() => {
            const url = window.prompt("URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          active={editor.isActive("link")}
          title="Link"
        >
          <Link2 className="h-3 w-3" />
        </MenuButton>

        {onUploadImage && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const url = await onUploadImage(file);
                  editor.chain().focus().setImage({ src: url }).run();
                } catch {
                  // Error handled by caller (e.g. toast)
                }
              }}
            />
            <MenuButton onClick={() => imageInputRef.current?.click()} title="Upload image">
              <ImagePlus className="h-3 w-3" />
            </MenuButton>
          </>
        )}

        <div className="w-px h-4 bg-border/40 mx-0.5" />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo className="h-3 w-3" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo className="h-3 w-3" />
        </MenuButton>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto border-t border-border/20" style={{ minHeight: minHeight - 40 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
