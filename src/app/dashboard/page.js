import AdminDashboard from '@/components/admin/AdminDashboard';

export const metadata = { robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <AdminDashboard />;
}
