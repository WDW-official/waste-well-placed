export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { connectDB } from "@/lib/db";
import { Post } from "@/lib/models";
export default async function Blog() {
  let posts: { slug: string; title: string; excerpt: string }[] = [];
  try {
    await connectDB();
    posts = await Post.find({ published: true })
      .select("slug title excerpt")
      .lean()
      .then((rows) =>
        rows.flatMap((p) =>
          p.slug
            ? [
                {
                  slug: p.slug,
                  title: p.title ?? "Waste advice",
                  excerpt: p.excerpt ?? "",
                },
              ]
            : [],
        ),
      );
  } catch {}
  return (
    <>
      <PageTitle title="Waste advice & updates" />
      <div className="container section grid-services">
        {posts.length ? (
          posts.map((p) => (
            <Link className="card p-6" href={`/blog/${p.slug}`} key={p.slug}>
              <h2 className="text-xl font-bold">{p.title}</h2>
              <p className="muted">{p.excerpt}</p>
            </Link>
          ))
        ) : (
          <p>No published articles yet.</p>
        )}
      </div>
    </>
  );
}
