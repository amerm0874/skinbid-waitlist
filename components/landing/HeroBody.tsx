import {
  HERO_HEIGHT,
  HERO_SRC,
  HERO_WIDTH,
} from "@/lib/landing-media";

// Same press as Join waitlist: lime plate, black square offset behind it.
export default function HeroBody() {
  return (
    <div className="press-art mx-auto w-full max-w-[420px]">
      <span className="press-art-plate" aria-hidden="true" />
      <div className="press-art-face">
        <img
          src={HERO_SRC}
          alt=""
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
          fetchPriority="high"
          decoding="async"
          className="press-art-photo"
        />
      </div>
    </div>
  );
}
