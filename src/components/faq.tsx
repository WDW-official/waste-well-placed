"use client";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  return (
    <div className="divide-y divide-gray-200 border-y border-gray-200">
      {items.map((item, index) => (
        <div key={item.q}>
          <h3>
            <button
              id={`${id}-question-${index}`}
              className="w-full flex items-center justify-between gap-6 py-5 text-left font-bold text-lg"
              aria-expanded={open === index}
              aria-controls={`${id}-answer-${index}`}
              onClick={() => setOpen(open === index ? null : index)}
            >
              {item.q}
              <ChevronDown
                size={20}
                className={`shrink-0 faq-chevron ${open === index ? "is-open" : ""}`}
              />
            </button>
          </h3>
          <div
            className="faq-answer"
            id={`${id}-answer-${index}`}
            data-open={open === index}
            aria-hidden={open !== index}
            inert={open !== index}
            role="region"
            aria-labelledby={`${id}-question-${index}`}
          >
            <div>
              <p className="muted pb-6 leading-7">{item.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
