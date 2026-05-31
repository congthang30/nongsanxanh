import { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

/**
 * Wrapper cho cac trang phuc cu (Admin Orders, Moderation, ...)
 * de hien thi trong DashboardLayout. Boc voi PageHeader chuan.
 */
interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}
export function PageWrapper({ title, subtitle, actions, children }: Props) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </>
  );
}
