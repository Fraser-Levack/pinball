import Link from "next/link";
import { notFound } from "next/navigation";
import AddAppForm from "@/components/AddAppForm";
import { BUILDS_ENABLED } from "@/lib/build/enabled";

export default function AddAppPage() {
  if (!BUILDS_ENABLED) notFound();
  return (
    <div className="builder">
      <Link href="/apps" className="dim small">← ALL APPS</Link>
      <h1>ADD AN APP</h1>
      <p className="dim">
        For apps built before the game saved them: add the build&apos;s index.html and the prompt it came from.
      </p>
      <AddAppForm />
    </div>
  );
}
