import Image from "next/image";
import LaunchGameButton from "./LaunchGameButton";
import { BRAND_LOGOS } from "@/lib/brandLogos";

/** Landing demo — Inco × Megapot walkthrough */
const HERO_TEASER_VIDEO_ID = "UTzMalkXTdE";
const HERO_TEASER_EMBED_URL = `https://www.youtube.com/embed/${HERO_TEASER_VIDEO_ID}?rel=0`;

const HERO_BRANDS = [
  BRAND_LOGOS.base,
  BRAND_LOGOS.inco,
  { ...BRAND_LOGOS.megapot, lightPad: true },
];

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="site-page-top site-hero site-page-pad-x relative flex w-full flex-col sm:px-10 md:px-20 lg:px-36"
    >
      <div className="font-display z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-4 sm:gap-6 text-center text-white">
        <div className="flex flex-wrap items-center justify-center gap-2 px-4">
          {HERO_BRANDS.map((brand) => (
            <span
              key={brand.src}
              className={`relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 ${brand.lightPad ? "bg-white p-1" : "bg-white/5"}`}
              title={brand.alt}
            >
              <Image src={brand.src} alt={brand.alt} width={28} height={28} className="h-7 w-7 object-contain" />
            </span>
          ))}
        </div>
        <h1 className="text-[2.25rem] font-extrabold leading-[1.1] sm:text-5xl md:text-6xl tracking-tight px-4">
          100% Provably Fair{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-magic to-blue-magic">
            Gaming
          </span>
        </h1>
        <p className="max-w-2xl px-4 text-base leading-relaxed text-white/90 sm:text-lg md:text-xl font-medium">
          Confidential on-chain randomness with Inco Lightning on Base Sepolia.
        </p>
        <p className="max-w-2xl px-4 text-sm leading-relaxed text-white/60 sm:text-base">
          Play, verify the attested reveal, earn Megapot credits, and claim a real testnet ticket.
        </p>

        <div className="w-full px-4 mt-8 sm:mt-10">
          <LaunchGameButton />
        </div>
      </div>

      <div className="relative mx-auto mt-12 w-full max-w-4xl sm:mt-16 px-4">
        <div className="absolute -inset-1 bg-gradient-to-r from-red-magic/50 to-blue-magic/50 rounded-2xl blur-md" />
        <div className="relative z-10 w-full overflow-hidden rounded-xl aspect-video bg-black ring-1 ring-white/10">
          <iframe
            src={HERO_TEASER_EMBED_URL}
            title="APT-Casino teaser"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
