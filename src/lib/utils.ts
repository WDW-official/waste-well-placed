export function gbp(minor:number){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(minor/100)}
export function formatDate(iso:string|Date){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"Europe/London"}).format(new Date(iso))}
export function newRef(prefix="WWP"){return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`}
export function initials(name:string){return name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}
