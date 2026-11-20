import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/lib/workflow-models";
import { requireCondition } from "@/lib/operations/security";
import { permitted } from "@/lib/operations/policy";
import { objectId } from "@/lib/operations/validation";
import { printDocument, money } from "@/lib/print-document";
import { errorResponse } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSession();
    requireCondition(user, "Sign in to view your invoice", 401);
    await connectDB();
    const invoice = await Invoice.findById(
      objectId.parse((await params).id),
    ).lean();
    requireCondition(invoice, "Invoice not found", 404);
    requireCondition(
      String(invoice.userId) === user.id ||
        (user.organizationId &&
          String(invoice.organizationId) === user.organizationId) ||
        permitted(user.role, "finance"),
      "Not permitted",
      403,
    );
    return printDocument(
      `Invoice ${invoice.number}`,
      [
        invoice.company?.legalName ?? "",
        invoice.company?.address ?? "",
        `Company number: ${invoice.company?.companyNumber || "Not applicable"}`,
        invoice.company?.vatNumber
          ? `VAT number: ${invoice.company.vatNumber}`
          : "No VAT registration stated",
        `Issued: ${invoice.issuedAt?.toISOString().slice(0, 10)}`,
        `Bill to: ${invoice.customer?.name}\n${invoice.customer?.address}`,
        `Total paid: ${money(invoice.totalMinor ?? 0)}\nVAT included in total: ${money(invoice.vatMinor ?? 0)}`,
      ],
      {
        head: ["Description", "Quantity", "Unit price", "Line total"],
        rows: invoice.lines.map((line) => [
          line.title ?? "Collection",
          String(line.qty ?? 1),
          money(line.unitMinor ?? 0),
          money((line.qty ?? 1) * (line.unitMinor ?? 0)),
        ]),
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
