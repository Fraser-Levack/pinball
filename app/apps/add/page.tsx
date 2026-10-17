import Link from "next/link";
import AddAppForm from "@/components/AddAppForm";

export default function AddAppPage() {
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
