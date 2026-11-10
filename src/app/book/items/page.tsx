"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookingShell } from "@/components/booking-shell";
import { ITEMS } from "@/lib/constants";
import { loadDraft, saveDraft, type BookingDraft } from "@/lib/booking-client";
import { gbp } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Plus, Minus, ArrowRight, ShoppingBag, Camera } from "lucide-react";

const photos: Record<string, string> = { Sofas: "sofas", Beds: "house", Appliances: "appliances", Furniture: "furniture", Office: "office", General: "general-waste" };
export default function Items() {
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const router = useRouter();
  useEffect(() => { setDraft({ ...loadDraft(), kind: "items" }); }, []);
  const categories = ["All", ...new Set(ITEMS.map(item => item.category))];
  const found = useMemo(() => ITEMS.filter(item => (category === "All" || item.category === category) && item.title.toLowerCase().includes(search.toLowerCase())), [category, search]);
  function modify(key: string, delta: number) {
    if (!draft) return;
    const current = draft.items || [];
    const qty = Math.max(0, Math.min(20, (current.find(item => item.key === key)?.qty || 0) + delta));
    const items = [...current.filter(item => item.key !== key), ...(qty ? [{ key, qty }] : [])];
    const next = { ...draft, items, estimate: undefined, holdId: undefined, slotId: undefined };
    setDraft(next); saveDraft(next);
  }
  const total = (draft?.items || []).reduce((sum, row) => sum + (ITEMS.find(item => item.key === row.key)?.price || 0) * row.qty, 0);
  const count = draft?.items?.reduce((sum, item) => sum + item.qty, 0) || 0;
  return <BookingShell step={0} title="A few things ready to go?" desc="Find your items below. A sofa, a fridge, a fresh start—we’ll help you make room.">
    <div className="items-layout"><div className="items-main"><div className="input-with-icon items-search"><Search aria-hidden="true" /><input className="input" aria-label="Search waste items" placeholder="Search sofas, tables, appliances…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="item-categories" aria-label="Filter items">{categories.map(name => <button type="button" aria-pressed={category === name} onClick={() => setCategory(name)} key={name}>{name}</button>)}</div><div className="item-grid">{found.map(item => { const qty = draft?.items?.find(row => row.key === item.key)?.qty || 0; return <article className={`item-card ${qty ? "is-selected" : ""}`} key={item.key}><div className="item-image"><Image src={`/images/${photos[item.category]}.jpg`} alt="" width={220} height={128} /></div><span className="eyebrow">{item.category}</span><h2>{item.title}</h2><p>{gbp(item.price)} <span>guide price</span></p><div className="item-counter"><button type="button" aria-label={`Remove ${item.title}`} disabled={qty === 0 || !draft} onClick={() => modify(item.key, -1)}><Minus size={16} /></button><span aria-live="polite" aria-label={`${qty} ${item.title} selected`}>{qty || "Add item"}</span><button type="button" aria-label={`Add ${item.title}`} disabled={!draft || qty >= 20} onClick={() => modify(item.key, 1)}><Plus size={16} /></button></div></article>; })}</div>{!found.length && <div className="items-empty"><Search size={28} /><h3>No items found just yet.</h3><p>Try a different name, or send us a photo for a quote.</p><Link href="/book/photo-quote" className="text-link"><Camera size={17} />Get a photo quote</Link></div>}</div>
    <aside className="items-basket"><div className="items-basket-heading"><ShoppingBag size={22} /><h2>Your collection</h2><span>{count}</span></div>{!count ? <p className="items-basket-empty">A little less clutter starts here.<br />Add an item to build your collection.</p> : <div className="items-basket-lines">{draft!.items!.map(row => <div key={row.key}><span>{row.qty} × {ITEMS.find(item => item.key === row.key)?.title}</span><strong>{gbp(row.qty * (ITEMS.find(item => item.key === row.key)?.price || 0))}</strong></div>)}</div>}<div className="items-basket-total"><span>Guide subtotal</span><strong>{gbp(total)}</strong></div><p className="items-price-note">Area, access charges and applicable VAT are checked with your address before payment.</p><button type="button" className="btn btn-primary" disabled={!count} onClick={() => { if (!count) return toast.error("Add at least one item"); saveDraft(draft!); router.push("/book/details"); }}>Continue to your quote<ArrowRight size={18} /></button><Link href="/book/load" className="items-change-type">Lots of mixed rubbish? Choose a load size</Link></aside></div>
  </BookingShell>;
}
