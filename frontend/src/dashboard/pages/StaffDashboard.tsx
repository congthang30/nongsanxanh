import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export default function StaffDashboard() {
  return (
    <>
      <PageHeader title="Hỗ trợ khách hàng" subtitle="Tiếp nhận và xử lý yêu cầu hỗ trợ" />
      <div className="dash-quick-grid">
        <Link to="/staff/tickets" className="dash-quick-card">
          <strong>Yêu cầu hỗ trợ</strong>
          <span className="muted">Trả lời và xử lý yêu cầu của khách hàng</span>
        </Link>
      </div>
    </>
  );
}
