import { useEffect, useState } from "react";

/** Live clock showing local time and date (Indonesian locale). */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="clock">
      <div className="t">{time}</div>
      <div className="d">{date}</div>
    </div>
  );
}
