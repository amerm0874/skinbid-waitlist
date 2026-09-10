"use client";

import { useState } from "react";

// Same press as Join waitlist: lime plate, black square offset behind it.
export default function HeroBody() {
  const [broken, setBroken] = useState(false);

  return (
    <div className="press-art mx-auto w-full max-w-[420px]">
      <span className="press-art-plate" aria-hidden="true" />
      <div className="press-art-face">
        {!broken && (
          <img
            src="/hero-slots.png"
            alt=""
            className="press-art-photo"
            onError={() => setBroken(true)}
          />
        )}
      </div>
    </div>
  );
}
