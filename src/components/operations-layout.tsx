import { AdminPage } from "./admin-page";

export function OperationsLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return <AdminPage title={title}>{children}</AdminPage>;
}
