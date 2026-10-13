"use client";

import { useEffect, useState } from "react";

function getRemaining(target: string) {
  const milliseconds = Math.max(0, new Date(target).getTime() - Date.now());
  const totalMinutes = Math.floor(milliseconds / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

export function Countdown({ target }: { target: string }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const update = () => setRemaining(getRemaining(target));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [target]);

  return (
    <div className="countdown" aria-label="Tiempo restante hasta la boda">
      <div className="countdown-unit featured"><strong>{remaining.days}</strong><span>días</span></div>
      <div className="countdown-unit"><strong>{String(remaining.hours).padStart(2, "0")}</strong><span>horas</span></div>
      <div className="countdown-unit"><strong>{String(remaining.minutes).padStart(2, "0")}</strong><span>minutos</span></div>
    </div>
  );
}