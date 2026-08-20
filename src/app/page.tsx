import { TimeTrackerApp } from "@/components/TimeTrackerApp";

// TimeTrackerApp's initial state is `defaultViewWeek()`, which reads the real current date. A
// static prerender would freeze that at build time and bake a wrong "current week" into the
// shipped bundle — increasingly wrong as days pass between releases — and mismatch whatever the
// client computes on hydration. Forcing this route dynamic keeps it evaluated per-request instead.
export const dynamic = "force-dynamic";

export default function Home() {
  return <TimeTrackerApp />;
}
