import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";

// The assistant prop is a slot for the global AI Assistant launcher. The rest
// topbar is unchanged.
export function DashboardTopbar({ assistant }: { assistant?: React.ReactNode }) {
  return (
    <div className="h-16 bg-white border-b border-line flex items-center justify-end px-6 gap-6">
      {assistant}
      <button className="relative p-2 rounded-lg text-[#5B6B78] hover:bg-tint hover:text-ink transition-colors duration-150">
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full ring-2 ring-white"></span>
      </button>

      <div className="flex items-center gap-3 pl-4 border-l border-line">
        <Avatar className="w-9 h-9 border border-line">
          <AvatarFallback className="bg-ink text-white text-sm font-semibold">
            JD
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm text-ink font-medium leading-tight">Jennifer Davis</div>
          <div className="mono-ref text-xs">j.davis@lexguard.law</div>
        </div>
      </div>
    </div>
  );
}
