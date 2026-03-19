import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}

export const SectionHeader = ({ eyebrow, title, description, aside }: SectionHeaderProps) => (
  <div className="section-header">
    <div>
      <p className="section-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="section-description">{description}</p>
    </div>
    {aside ? <div className="section-header-aside">{aside}</div> : null}
  </div>
);
