import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** Page header: title + breadcrumb-like description + actions (export, filter, ...). */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="dash-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      {actions && <div className="dash-table-actions">{actions}</div>}
    </div>
  );
}
