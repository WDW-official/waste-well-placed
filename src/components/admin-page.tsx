export function AdminPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-page">
      <header className="admin-page-heading">
        <span className="eyebrow">OPERATIONS WORKSPACE</span>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  );
}
