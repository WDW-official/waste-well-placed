import { z } from "zod";
import { Booking } from "@/lib/models";
import { Evidence } from "@/lib/operations/models";
import { businessContext, csvCell } from "@/lib/business";
import { errorResponse, ok } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const { organization } = await businessContext();
    const params = new URL(req.url).searchParams;
    const to = z
      .string()
      .date()
      .parse(params.get("to") || new Date().toISOString().slice(0, 10));
    const from = z
      .string()
      .date()
      .parse(
        params.get("from") ||
          new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10),
      );
    const end = new Date(to + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);
    const rows = await Booking.find({
      organizationId: organization._id,
      status: { $in: ["verified", "closed"] },
      scheduledAt: { $gte: new Date(from + "T00:00:00Z"), $lt: end },
    })
      .sort({ scheduledAt: -1 })
      .limit(1000)
      .lean();
    const evidence = await Evidence.find({
      bookingId: { $in: rows.map((row) => row._id) },
      status: "verified",
    })
      .select("bookingId weightKg wasteDescription")
      .lean();
    const records = rows.map((row) => {
      const proof = evidence.find(
        (item) => String(item.bookingId) === String(row._id),
      );
      return {
        reference: row.reference,
        date: row.scheduledAt,
        status: row.status,
        totalMinor: row.price?.totalMinor ?? 0,
        vatMinor: row.price?.vatMinor ?? 0,
        refundsMinor: row.refundsMinor ?? 0,
        address: [row.address?.line1, row.address?.postcode]
          .filter(Boolean)
          .join(", "),
        wasteType: row.wasteType,
        weightKg: proof?.weightKg ?? null,
      };
    });
    if (params.get("format") === "csv") {
      const csv = [
        [
          "Reference",
          "Collection date (UTC)",
          "Status",
          "Address",
          "Waste type",
          "Verified weight kg",
          "Total GBP",
          "VAT GBP",
          "Refunded GBP",
        ]
          .map(csvCell)
          .join(","),
        ...records.map((row) =>
          [
            row.reference,
            row.date?.toISOString(),
            row.status,
            row.address,
            row.wasteType,
            row.weightKg,
            (row.totalMinor / 100).toFixed(2),
            (row.vatMinor / 100).toFixed(2),
            (row.refundsMinor / 100).toFixed(2),
          ]
            .map(csvCell)
            .join(","),
        ),
      ].join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="collection-report.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return ok({
      records,
      from,
      to,
      limit: 1000,
      summary: {
        collections: records.length,
        totalMinor: records.reduce((sum, row) => sum + row.totalMinor, 0),
        weightKg: records.reduce((sum, row) => sum + (row.weightKg ?? 0), 0),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
