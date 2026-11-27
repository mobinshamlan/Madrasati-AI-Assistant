import { TammeniMark } from "@/components/brand/mark";
import { PhoneIcon } from "@/components/dashboard/icons";
import "./welcome.css";

export const callers = { ahmed: "تركي", sama: "لولوة" } as const;

/** The incoming call as it sits on the locked phone. Pressing it opens the call screen. */
export function CallNotification({ call, onOpen }: { call: keyof typeof callers; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`اضغط وجرّب مكالمة ${callers[call]}، وفيها صوت`} className="welcome-ring welcome-notification w-full flex-col text-start">
      <span className="flex items-center gap-[0.5625rem]">
        <span className="grid size-[2.125rem] shrink-0 place-items-center rounded-[0.625rem] bg-bell-soft">
          <TammeniMark size={34} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{callers[call]} من طمّنـــي</span>
          <span className="block text-[0.75rem] text-faint">مكالمة واردة</span>
        </span>
      </span>
      <span className="welcome-ring-button flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#15803d] font-bold whitespace-nowrap text-white max-[359px]:text-[0.75rem]">
        <span className="grid shrink-0 max-[359px]:hidden">
          <PhoneIcon size={18} />
        </span>
        اضغط وجرّب المكالمة
      </span>
    </button>
  );
}
