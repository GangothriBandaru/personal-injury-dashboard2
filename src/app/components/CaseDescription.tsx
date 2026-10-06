import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";

// ── Case description ─────────────────────────────────────────────────────────
// A case's own description, shown on one line in a compact area at the right of
// the case title. Whether it
// is cut off is measured from the text as it actually renders at the current
// width — never from a character count — so "View more" appears only when
// there is more to read, for any case, at any screen size. Expanding shows the
// complete description wrapped within the header; "View less" returns it to
// one line. The description itself is never shortened, only its display.

export function CaseDescription({ text, id = "case-description" }: { text: string; id?: string }) {
  // An invisible one-line copy spanning the full description area, measured in
  // both states so the control stays correct while expanded and on resize.
  const probeRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = probeRef.current;
    if (!el) return;
    const measure = () => {
      const more = el.scrollWidth > el.clientWidth + 1;
      setOverflows(more);
      if (!more) setExpanded(false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const toggle = (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      aria-controls={id}
      className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-deep hover:text-ink transition-colors whitespace-nowrap"
    >
      {expanded ? "View less" : "View more"}
      {expanded
        ? <ArrowUp className="w-3.5 h-3.5" strokeWidth={1.75} />
        : <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />}
    </button>
  );

  return (
    // A compact preview area at the right of the header — never the whole
    // width beside the title — so the collapsed line stays short and well
    // clear of the case name. The expanded text wraps within the same area.
    <div className="relative flex-1 min-w-0 max-w-[28rem] ml-auto">
      <p ref={probeRef} aria-hidden="true" className="secondary-text leading-relaxed truncate invisible absolute inset-x-0 top-0 pointer-events-none">
        {text}
      </p>

      {expanded ? (
        // Complete description, wrapping within the area — long unbroken
        // strings break anywhere rather than running out of the header.
        <div className="text-right">
          <p id={id} className="secondary-text leading-relaxed text-left ml-auto w-fit max-w-full [overflow-wrap:anywhere]">
            {text}
          </p>
          <div className="mt-1">{toggle}</div>
        </div>
      ) : (
        <div className="flex items-baseline justify-end gap-2 min-w-0">
          <p id={id} className="secondary-text leading-relaxed truncate min-w-0">
            {text}
          </p>
          {overflows && toggle}
        </div>
      )}
    </div>
  );
}
