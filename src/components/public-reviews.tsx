"use client";
import { useEffect, useState } from "react";
export function PublicReviews() {
  const [reviews, setReviews] = useState<
      { _id: string; name: string; rating: number; text: string }[]
    >([]),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/reviews")
      .then((response) => response.json())
      .then((data) => setReviews(data.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  return (
    <div className="container section grid-services">
      {reviews.map((row) => (
        <article className="card p-7" key={row._id}>
          <h2 className="font-bold">{row.name}</h2>
          <p>{row.rating} out of 5 · Verified collection</p>
          <p className="mt-3">{row.text}</p>
        </article>
      ))}
      {loaded && !reviews.length && <p>No approved customer reviews yet.</p>}
    </div>
  );
}
