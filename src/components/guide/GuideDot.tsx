import type { GuideTip } from "./tips";

/** "?" badge next to a part of the page; visible only in guide mode. */
export default function GuideDot({ tip }: { tip: GuideTip }) {
  return (
    <button type="button" className="guide-dot" data-tip={tip} aria-label="What is this?">
      ?
    </button>
  );
}
