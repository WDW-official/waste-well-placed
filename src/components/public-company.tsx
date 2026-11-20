"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function PublicCompany() {
  const [company, setCompany] = useState<{
    legalName: string;
    companyNumber?: string;
    carrierNumber?: string;
    email?: string;
    phone?: string;
  } | null>(null);
  useEffect(() => {
    fetch("/api/company")
      .then((response) => response.json())
      .then((data) => setCompany(data.company))
      .catch(() => {});
  }, []);
  return company ? (
    <div className="text-sm text-green-100 mt-4">
      <p>{company.legalName}</p>
      {company.companyNumber && <p>Company number: {company.companyNumber}</p>}
      {company.carrierNumber && <p>Waste carrier: {company.carrierNumber}</p>}
      {company.email && (
        <p>
          <a href={`mailto:${company.email}`}>{company.email}</a>
        </p>
      )}
      {company.phone && (
        <p>
          <a href={`tel:${company.phone}`}>{company.phone}</a>
        </p>
      )}
    </div>
  ) : (
    <Link href="/contact" className="underline text-sm block mt-4">
      Contact our team
    </Link>
  );
}
