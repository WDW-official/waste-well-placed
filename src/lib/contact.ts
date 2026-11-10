const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "";
const whatsapp = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
export const phoneHref = /[1-9].*[1-9]/.test(phone.replace(/^\+44/, "")) ? `tel:${phone}` : "/contact";
export const whatsappHref = whatsapp.length >= 8 ? `https://wa.me/${whatsapp}` : "/contact";
