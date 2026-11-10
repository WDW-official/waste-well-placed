"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookingShell } from "@/components/booking-shell";
import { LoadIllustration } from "@/components/load-illustration";
import { LOADS } from "@/lib/constants";
import { loadDraft, saveDraft, type BookingDraft } from "@/lib/booking-client";
import { gbp } from "@/lib/utils";
import {
  Camera,
  ArrowRight,
  Check,
  Info,
  ChevronLeft,
  ChevronRight,
  Leaf,
} from "lucide-react";

const groups = [
  {
    key: "small",
    title: "Small loads",
    description: "100–200 kg",
    keys: ["mini", "small"],
  },
  {
    key: "medium",
    title: "Medium loads",
    description: "350 kg",
    keys: ["medium"],
  },
  {
    key: "large",
    title: "Large loads",
    description: "650–900 kg",
    keys: ["large", "xl"],
  },
];

export default function Load() {
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [group, setGroup] = useState("small");
  const [visible, setVisible] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const saved = loadDraft();
    setDraft({ ...saved, kind: "load" });
    setGroup(
      groups.find((g) => g.keys.includes(saved.loadKey || "small"))?.key ||
        "small",
    );
  }, []);
  const loads = LOADS.filter((load) =>
    groups.find((g) => g.key === group)!.keys.includes(load.key),
  );
  function select(key: string) {
    if (!draft) return;
    const next = {
      ...draft,
      kind: "load" as const,
      loadKey: key,
      selected: true,
      estimate: undefined,
      holdId: undefined,
      slotId: undefined,
    };
    saveDraft(next);
    router.push("/book/details");
  }
  function scrollTo(index: number) {
    const child = track.current?.children[index] as HTMLElement | undefined;
    if (child)
      track.current?.scrollTo({
        left: child.offsetLeft - track.current.offsetLeft,
        behavior: "smooth",
      });
  }
  return (
    <BookingShell
      title="How much waste do you have?"
      desc="Pick the closest size. We’ll take care of the lifting and loading."
      step={0}
    >
      <div className="load-layout">
        <div className="load-main">
          <div className="load-categories">
            {groups.map((g) => (
              <button
                type="button"
                key={g.key}
                aria-pressed={group === g.key}
                onClick={() => {
                  setGroup(g.key);
                  setVisible(0);
                  track.current?.scrollTo({ left: 0 });
                }}
              >
                <strong>{g.title}</strong>
                <span>{g.description}</span>
              </button>
            ))}
            <Link href="/book/photo-quote">
              <strong>Not sure?</strong>
              <span>
                <Camera size={16} />
                Upload photos
              </span>
            </Link>
          </div>
          <div className="load-tip">
            <span>
              <Leaf size={23} />
            </span>
            <div>
              <strong>A little space goes a long way.</strong>
              <p>
                Choose by volume <em>and</em> weight. Heavy materials can reach
                the weight limit before the van is full.
              </p>
            </div>
          </div>
          <div
            className="load-track"
            ref={track}
            onScroll={() => {
              const node = track.current;
              if (node && node.children[0]) {
                const card = node.children[0] as HTMLElement;
                setVisible(
                  Math.round(node.scrollLeft / (card.offsetWidth + 20)),
                );
              }
            }}
          >
            {loads.map((load) => (
              <article key={load.key} className="load-card">
                <div className="load-card-title">
                  <span className="eyebrow">{load.title}</span>
                  <h2>
                    {load.volume} cubic yards <span>· {load.weight} kg</span>
                  </h2>
                  <p>
                    Up to {load.bags} bags · {load.minutes} minutes loading
                  </p>
                </div>
                <div className="load-diagram">
                  <div>
                    <span>
                      <strong>Light load</strong>
                      <small>
                        Bags, boxes
                        <br />& everyday clutter
                      </small>
                    </span>
                    <LoadIllustration fraction={load.volume / 16} />
                  </div>
                  <div>
                    <span>
                      <strong>Heavy load</strong>
                      <small>
                        Rubble, soil
                        <br />& dense materials
                      </small>
                    </span>
                    <LoadIllustration fraction={load.weight / 1400} heavy />
                  </div>
                </div>
                <div className="load-examples">
                  <div>
                    <span>VOLUME</span>
                    <p>About {load.bags} standard bags of light rubbish</p>
                  </div>
                  <div>
                    <span>WEIGHT</span>
                    <p>Up to {load.weight} kg in total</p>
                  </div>
                </div>
                <div className="load-tags">
                  {(load.volume <= 4
                    ? ["Bin bags", "Small furniture", "Garden cuttings"]
                    : load.volume <= 7
                      ? ["Room clear-outs", "Mixed furniture", "Bagged rubbish"]
                      : ["Bigger clear-outs", "Bulky furniture", "Mixed waste"]
                  ).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="load-price">
                  <div>
                    <small>Guide price from</small>
                    <strong>{gbp(load.base)}</strong>
                  </div>
                  <span>
                    Final price checked
                    <br />
                    before payment
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!draft}
                  onClick={() => select(load.key)}
                >
                  Select {load.title.toLowerCase()}
                  <ArrowRight size={19} />
                </button>
              </article>
            ))}
          </div>
          {loads.length > 1 && (
            <div className="carousel-controls">
              <button
                type="button"
                aria-label="Previous load"
                disabled={visible === 0}
                onClick={() => scrollTo(visible - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                {loads.map((load, i) => (
                  <button
                    type="button"
                    key={load.key}
                    aria-label={`Show ${load.title}`}
                    aria-current={visible === i ? "true" : undefined}
                    className={visible === i ? "active" : ""}
                    onClick={() => scrollTo(i)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next load"
                disabled={visible >= loads.length - 1}
                onClick={() => scrollTo(visible + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        <aside className="load-sidebar">
          <div className="booking-help-card">
            <span className="help-icon">
              <Camera size={27} />
            </span>
            <h3>A picture makes it easier.</h3>
            <p>
              Not sure which size to choose? Send us a few photos and let the
              team take a look.
            </p>
            <Link href="/book/photo-quote" className="btn btn-outline">
              Get a photo quote
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="load-allowances">
            <h3>Good to know</h3>
            <p>
              <Check size={17} />
              Loading time is included
            </p>
            <p>
              <Check size={17} />
              Volume and weight limits apply
            </p>
            <p>
              <Check size={17} />
              Access details are checked next
            </p>
            <div>
              <Info size={17} />
              <small>
                Guide prices use the current sample tariffs. Area charges,
                access extras and applicable VAT are calculated with your
                address.
              </small>
            </div>
          </div>
        </aside>
      </div>
    </BookingShell>
  );
}
