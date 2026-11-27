import { TimeIcon } from "@/components/dashboard/time-icons";
import "./welcome.css";

/** The parent's locked phone at a given time ("7:40 صباحًا"); whatever just arrived sits under the clock. */
export function LockScreen({ time, children }: { time: string; children: React.ReactNode }) {
  const [clock, period] = time.split(" ");
  return (
    <div className="welcome-phone">
      <div aria-hidden="true">
        <p className="welcome-phone-bar num" dir="ltr">
          <span>{clock}</span>
          <span className="welcome-phone-battery">
            <i />
          </span>
        </p>
        <span className="welcome-phone-island" />
        <p className="welcome-phone-clock num">{clock}</p>
        <p className="welcome-phone-period flex items-center justify-center gap-1.5 text-center text-[0.875rem] opacity-80">
          {period}
          <TimeIcon time={time} plain />
        </p>
        <span className="welcome-phone-home" />
      </div>
      <div className="mx-2.5 mt-5">{children}</div>
    </div>
  );
}
