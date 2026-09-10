import type { ReactNode } from "react";

function Lockup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="champ-lockup" role="img" aria-label={label}>
      {children}
    </span>
  );
}

function Marks() {
  return (
    <>
      <Lockup label="UFC">
        <span className="champ-ufc">UFC</span>
      </Lockup>
      <Lockup label="Boxing">
        <span className="champ-boxing">BOXING</span>
      </Lockup>
      <Lockup label="CrossFit Games">
        <span className="champ-stack">
          <span className="champ-stack-sm">CROSSFIT</span>
          <span className="champ-rule" />
          <span className="champ-stack-lg">GAMES</span>
        </span>
      </Lockup>
      <Lockup label="HYROX">
        <span className="champ-hyrox">HYROX</span>
      </Lockup>
      <Lockup label="Mr Olympia">
        <span className="champ-stack">
          <span className="champ-stack-sm">MR</span>
          <span className="champ-rule" />
          <span className="champ-stack-lg">OLYMPIA</span>
        </span>
      </Lockup>
      <Lockup label="Wrestling">
        <span className="champ-wrestling">WRESTLING</span>
      </Lockup>
      <Lockup label="Strongman">
        <span className="champ-strongman">STRONGMAN</span>
      </Lockup>
      <Lockup label="WSL">
        <span className="champ-wsl">WSL</span>
      </Lockup>
      <Lockup label="Beach Volleyball">
        <span className="champ-stack">
          <span className="champ-stack-sm">BEACH</span>
          <span className="champ-rule" />
          <span className="champ-stack-lg">VOLLEYBALL</span>
        </span>
      </Lockup>
    </>
  );
}

// Slow marquee of championship marks. Not links. Hover cannot pause it.
export default function ChampionshipTicker() {
  return (
    <div className="sport-ticker" aria-hidden="true">
      <div className="sport-ticker-track">
        <Marks />
        <Marks />
      </div>
    </div>
  );
}
