import { FileText, ShieldCheck } from "lucide-react";

export function PolicyPage({
  title,
  description,
  kind,
  children,
}: {
  title: string;
  description: string;
  kind: "privacy" | "terms";
  children: React.ReactNode;
}) {
  const Icon = kind === "privacy" ? ShieldCheck : FileText;
  return (
    <div className="policy-page">
      <header className="policy-heading">
        <div className="policy-heading-inner">
          <span className="policy-symbol">
            <Icon size={26} aria-hidden="true" />
          </span>
          <span className="eyebrow">
            {kind === "privacy" ? "YOUR INFORMATION" : "USING OUR SERVICES"}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <div className="policy-content">{children}</div>
    </div>
  );
}
