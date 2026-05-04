import { MessageCircle, Phone } from "lucide-react";
import { useSiteSettings, getWhatsAppLink, getTelLink } from "@/hooks/useSiteSettings";

export default function FloatingContact() {
  const { settings } = useSiteSettings();
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-3">
      <a
        href={getTelLink(settings.phone)}
        aria-label="Telefonla Ara"
        className="md:hidden h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-elegant flex items-center justify-center hover:bg-primary-glow transition-colors"
      >
        <Phone className="h-5 w-5" />
      </a>
      <a
        href={getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp ile Görüş"
        className="group h-14 w-14 rounded-full bg-[#25D366] text-white shadow-elegant flex items-center justify-center hover:scale-105 transition-transform relative"
      >
        <MessageCircle className="h-6 w-6" fill="white" stroke="#25D366" strokeWidth={1.5} />
        <span className="hidden md:block absolute right-full mr-3 whitespace-nowrap bg-foreground text-background text-xs font-medium px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          WhatsApp ile Görüş
        </span>
      </a>
    </div>
  );
}
