import { useSiteSettings, getWhatsAppLink } from "@/hooks/useSiteSettings";

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.003 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.6 4.46 1.74 6.4L3.2 28.8l6.6-1.72a12.74 12.74 0 0 0 6.2 1.6h.01c7.07 0 12.8-5.73 12.8-12.8s-5.74-12.68-12.81-12.68Zm0 23.36h-.01a10.62 10.62 0 0 1-5.41-1.48l-.39-.23-3.92 1.02 1.05-3.82-.25-.4a10.59 10.59 0 0 1-1.62-5.65c0-5.87 4.78-10.65 10.66-10.65 2.85 0 5.52 1.11 7.53 3.13a10.58 10.58 0 0 1 3.12 7.53c0 5.87-4.78 10.55-10.76 10.55Zm5.84-7.94c-.32-.16-1.9-.94-2.19-1.05-.29-.11-.5-.16-.72.16-.21.32-.82 1.05-1 1.27-.19.21-.37.24-.69.08-.32-.16-1.36-.5-2.59-1.6-.96-.86-1.6-1.92-1.79-2.24-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.39-.26-.62-.53-.54-.72-.55-.19-.01-.4-.01-.61-.01s-.56.08-.85.4c-.29.32-1.11 1.09-1.11 2.66 0 1.57 1.13 3.08 1.29 3.29.16.21 2.23 3.4 5.4 4.77.75.32 1.34.51 1.8.66.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.16-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z"
      />
    </svg>
  );
}

export default function FloatingContact() {
  const { settings } = useSiteSettings();
  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col items-end gap-3 md:bottom-10 md:right-6">
      <a
        href={getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp ile Görüş"
        className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-110 md:h-14 md:w-14"
        style={{ boxShadow: "0 10px 30px -6px rgba(37,211,102,0.55), 0 4px 12px rgba(0,0,0,0.18)" }}
      >
        <WhatsAppIcon className="h-7 w-7 md:h-8 md:w-8" />
        <span className="hidden md:block absolute right-full mr-3 whitespace-nowrap bg-foreground text-background text-xs font-medium px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          WhatsApp ile Görüş
        </span>
      </a>
    </div>
  );
}
