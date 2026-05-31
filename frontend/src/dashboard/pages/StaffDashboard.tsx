import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export default function StaffDashboard() {
  return (
    <>
      <PageHeader title="Ho tro khach hang" subtitle="Tiep nhan va xu ly yeu cau ho tro" />
      <div className="dash-quick-grid">
        <Link to="/staff/tickets" className="dash-quick-card">
          <strong>Tickets ho tro</strong>
          <span className="muted">Tra loi va xu ly yeu cau cua khach hang</span>
        </Link>
      </div>
    </>
  );
}
