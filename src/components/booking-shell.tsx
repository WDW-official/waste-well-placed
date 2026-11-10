import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check } from "lucide-react";

export function BookingShell({ step, children, title, desc }: { step: number; children: React.ReactNode; title: string; desc?: string }) {
  const steps = ["Select your waste", "Build your quote", "Choose a time", "Review & pay"];
  const back = ["/book", "/book/load", "/book/details", "/book/schedule"][step] || "/book";
  return <div className="booking-page"><header className="booking-header"><div className="booking-header-inner"><Link href={back} className="booking-back" aria-label="Go back"><ArrowLeft size={23} /></Link><span>{steps[step] || "Photo quote"}</span><Link href="/" className="booking-wordmark" aria-label="Waste Well Placed home"><Image src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png" alt="Waste Well Placed" width={1448} height={1086} /></Link></div><div className="booking-progress" role="progressbar" aria-label="Booking progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) * 25}%` }} /></div></header>
    <div className="container booking-container"><nav className="booking-stepper" aria-label="Booking steps">{steps.map((name, i) => <span key={name} aria-current={step === i ? "step" : undefined} className={step >= i ? "is-complete" : ""}><span>{step > i ? <Check size={12} /> : i + 1}</span>{name}</span>)}</nav><div className="booking-page-title"><span className="eyebrow">YOUR NEXT FRESH START</span><h1>{title}</h1>{desc && <p>{desc}</p>}</div>{children}<div className="booking-bottom-note"><span><Check size={15} />Your details stay saved as you go</span><Link href="/contact">Need a hand?</Link></div></div>
  </div>;
}
