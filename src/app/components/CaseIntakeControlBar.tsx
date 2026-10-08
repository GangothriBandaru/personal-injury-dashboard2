import { Search, Plus } from "lucide-react";
import { Button } from "./ui/button";

interface CaseIntakeControlBarProps {
  onNewCase?: () => void;
  search?: string;
  onSearch?: (value: string) => void;
}

export function CaseIntakeControlBar({ onNewCase, search, onSearch }: CaseIntakeControlBarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1 max-w-xl relative">
          <Search strokeWidth={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A98A3]" />
          <input
            type="text"
            placeholder="Search by Plaintiff, Defendant, Client, or Case ID..."
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full bg-white border border-line rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#0F1E2B] placeholder:text-[#8A98A3] focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        <select className="bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-[#33424C] focus:outline-none focus:border-brand cursor-pointer hover:bg-tint transition-colors min-w-[160px]">
          <option value="all">All Cases</option>
          <option value="progress">In Progress</option>
          <option value="ready">Ready For Review</option>
        </select>

        <select className="bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-[#33424C] focus:outline-none focus:border-brand cursor-pointer hover:bg-tint transition-colors min-w-[180px]">
          <option value="updated">Recently Updated</option>
          <option value="intake">Intake Date</option>
          <option value="progress">Progress</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      <Button
        onClick={onNewCase}
        className="bg-brand hover:bg-deep text-white border-0 gap-2 ml-4"
      >
        <Plus strokeWidth={1.75} className="w-4 h-4" />
        New Case
      </Button>
    </div>
  );
}
