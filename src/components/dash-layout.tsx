import Link from "next/link";
export function DashLayout({
  type,
  title,
  links,
  children,
}: {
  type: string;
  title: string;
  links: { name: string; href: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="font-bold text-lg mb-5 hidden md:block">{type}</div>
        <nav aria-label={`${type} navigation`}>
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.name}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">
        <h1 className="heading mb-8">{title}</h1>
        {children}
      </div>
    </div>
  );
}
