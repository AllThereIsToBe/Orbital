import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { normalizeMathDelimiters } from "./richContentMath";

interface RichContentProps {
  content: string;
  className?: string;
}

export const RichContent = ({ content, className }: RichContentProps) => {
  const normalized = useMemo(() => normalizeMathDelimiters(content), [content]);

  return (
    <div className={className ? `rich-content ${className}` : "rich-content"}>
      <ReactMarkdown
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
          a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
          img: ({ alt, src }) =>
            src ? <img alt={alt || ""} loading="lazy" src={src} /> : null,
          code: ({ className: codeClassName, children, ...props }) => {
            const text = String(children);
            const inline = !codeClassName && !text.includes("\n");
            return (
              <code className={inline ? "inline-code" : codeClassName} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};
