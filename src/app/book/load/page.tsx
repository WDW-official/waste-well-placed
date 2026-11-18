"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingShell } from "@/components/booking-shell";
import { LoadIllustration } from "@/components/load-illustration";
import {
  LOADS,
  SPECIALIST_LOADS,
  isSpecialistLoadService,
} from "@/lib/constants";
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
  return (
    <Suspense
      fallback={
        <p className="container section" role="status">
          Loading collection sizes…
        </p>
      }
    >
      <LoadSelector />
    </Suspense>
  );
}

function LoadSelector() {
  const params = useSearchParams();
  const service = params.get("service");
  const specialist = isSpecialistLoadService(service);
  const serviceTitle =
    service === "construction-waste" ? "Construction waste" : "Garden waste";
  const serviceLoads = useMemo(
    () => SPECIALIST_LOADS.filter((load) => load.service === service),
    [service],
  );
  const availableGroups = useMemo(
    () =>
      specialist
        ? serviceLoads.map((load) => ({
            key: load.key,
            title: load.sizeTitle,
            description: `${load.volume} cubic yards · up to ${load.weight} kg`,
            keys: [load.key],
          }))
        : groups,
    [specialist, serviceLoads],
  );
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [visible, setVisible] = useState(0);
  const loads = specialist ? serviceLoads : LOADS;
  const track = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const saved = loadDraft();
    setDraft({ ...saved, kind: "load" });
    const savedIndex = saved.selected
      ? loads.findIndex((load) => load.key === saved.loadKey)
      : 0;
    const index = Math.max(0, savedIndex);
    setVisible(index);
    const node = track.current;
    const card = node?.children[index] as HTMLElement | undefined;
    if (node && card)
      node.scrollTo({
        left: card.offsetLeft - (node.children[0] as HTMLElement).offsetLeft,
        behavior: "instant",
      });
  }, [loads]);
  const currentGroup =
    availableGroups.find((g) => g.keys.includes(loads[visible]?.key)) ??
    availableGroups[0];
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
        left:
          child.offsetLeft -
          (track.current.children[0] as HTMLElement).offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  return (
    <BookingShell
      title={
        specialist
          ? `How much ${serviceTitle.toLowerCase()} do you have?`
          : "How much waste do you have?"
      }
      desc={
        specialist
          ? "Choose a quarter, half or full load. Volume and weight limits both apply."
          : "Pick the closest size. We’ll take care of the lifting and loading."
      }
      step={0}
    >
      <div className="load-layout">
        <div className="load-main">
          <div className="load-categories">
            {availableGroups.map((g) => (
              <button
                type="button"
                key={g.key}
                aria-pressed={currentGroup.key === g.key}
                onClick={() => {
                  scrollTo(
                    loads.findIndex((load) => g.keys.includes(load.key)),
                  );
                }}
              >
                <strong>{g.title}</strong>
                <span className="load-category-details">{g.description}</span>
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
            className="load-track load-track-synced"
            ref={track}
            role="region"
            aria-roledescription="carousel"
            aria-label="Collection load sizes"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                scrollTo(
                  Math.max(
                    0,
                    Math.min(
                      loads.length - 1,
                      visible + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
                );
              }
            }}
            onScroll={() => {
              const node = track.current;
              if (!node) return;
              const cards = Array.from(node.children) as HTMLElement[];
              const origin = cards[0]?.offsetLeft ?? 0;
              const nearest = cards.reduce(
                (best, card, index) =>
                  Math.abs(card.offsetLeft - origin - node.scrollLeft) <
                  Math.abs(
                    cards[best].offsetLeft - origin - node.scrollLeft,
                  )
                    ? index
                    : best,
                0,
              );
              setVisible(nearest);
            }}
          >
            {loads.map((load, index) => (
              <article
                key={load.key}
                className="load-card"
                data-load-key={load.key}
                aria-current={visible === index ? "true" : undefined}
              >
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
                      <strong>{specialist ? "By volume" : "Light load"}</strong>
                      <small>
                        {specialist ? (
                          serviceTitle
                        ) : (
                          <>
                            Bags, boxes
                            <br />& everyday clutter
                          </>
                        )}
                      </small>
                    </span>
                    <LoadIllustration fraction={load.volume / 16} />
                  </div>
                  <div>
                    <span>
                      <strong>{specialist ? "By weight" : "Heavy load"}</strong>
                      <small>
                        {service === "garden-waste" ? (
                          <>
                            Branches, cuttings
                            <br />& green waste
                          </>
                        ) : (
                          <>
                            Rubble, soil
                            <br />& dense materials
                          </>
                        )}
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
                  {(specialist
                    ? service === "construction-waste"
                      ? ["Building debris", "Timber", "Renovation waste"]
                      : ["Garden cuttings", "Branches", "Green waste"]
                    : load.volume <= 4
                      ? ["Bin bags", "Small furniture", "Garden cuttings"]
                      : load.volume <= 7
                        ? [
                            "Room clear-outs",
                            "Mixed furniture",
                            "Bagged rubbish",
                          ]
                        : [
                            "Bigger clear-outs",
                            "Bulky furniture",
                            "Mixed waste",
                          ]
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
                  Select {load.title.split(" — ").at(-1)?.toLowerCase()}
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
