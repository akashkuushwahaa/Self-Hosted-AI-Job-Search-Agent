"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { followUpDue, localToday, type Details, type Status } from "@/lib/tracker";
import { errorClass, inputClass, labelClass } from "../ui";
import { saveDetails } from "./actions";

// The viewer's own date, not the server's (a Docker server runs in UTC). During hydration React
// uses the server's date, then swaps in the browser's, so the two can never mismatch.
const noSubscribe = () => () => {};
export function useToday(serverToday: string) {
  return useSyncExternalStore(noSubscribe, () => localToday(), () => serverToday);
}

const short = (day: string) => new Date(`${day}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function DetailsSummary({ details, status, today }: { details: Details | null; status: Status; today: string }) {
  if (!details) return null;
  const due = followUpDue(details.followUpOn, status, today);
  const parts = [
    details.appliedOn && `Applied ${short(details.appliedOn)}`,
    details.nextStep && `Next: ${details.nextStep}`,
  ].filter(Boolean);
  if (!parts.length && !details.followUpOn) return null;
  return (
    <p className="mt-1.5 text-xs text-muted">
      {parts.join(" · ")}
      {details.followUpOn && (
        <span className={`block ${due === "overdue" ? "font-medium text-red-700 dark:text-red-400" : due === "today" ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>
          {due === "overdue" ? `Follow-up overdue (${short(details.followUpOn)})` : due === "today" ? "Follow up today" : `Follow up ${short(details.followUpOn)}`}
        </span>
      )}
    </p>
  );
}

export function DetailsForm({ jobId, title, details, editable }: { jobId: string; title: string; details: Details | null; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveDetails.bind(null, jobId), null);
  const id = (field: string) => `${field}-${jobId}`;
  const field = `${inputClass} h-8 py-1 text-xs`;

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id("details")}
        onClick={() => setOpen(!open)}
        className="rounded-sm text-xs text-muted transition-[color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        {open ? "Hide details" : details?.notes ? "Details · has notes" : "Details"}
      </button>
      {open && (
        <form id={id("details")} action={action} aria-label={`Details for ${title}`} className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={id("appliedOn")} className={`${labelClass} text-xs`}>Applied</label>
              <input id={id("appliedOn")} name="appliedOn" type="date" defaultValue={details?.appliedOn ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label htmlFor={id("followUpOn")} className={`${labelClass} text-xs`}>Follow up</label>
              <input id={id("followUpOn")} name="followUpOn" type="date" defaultValue={details?.followUpOn ?? ""} disabled={!editable} className={field} />
            </div>
          </div>
          <div>
            <label htmlFor={id("nextStep")} className={`${labelClass} text-xs`}>Next step</label>
            <input id={id("nextStep")} name="nextStep" maxLength={200} defaultValue={details?.nextStep ?? ""} placeholder="e.g. Phone screen" disabled={!editable} className={field} />
          </div>
          <div>
            <label htmlFor={id("notes")} className={`${labelClass} text-xs`}>Notes</label>
            <textarea id={id("notes")} name="notes" rows={3} maxLength={5000} defaultValue={details?.notes ?? ""} disabled={!editable} className={`${inputClass} py-1 text-xs`} />
          </div>
          <div className="flex items-center gap-2">
            {editable ? (
              <button disabled={pending} className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            ) : (
              <span className="text-xs text-muted">Notes and dates are saved on your own install.</span>
            )}
            {state?.ok && !pending && <span role="status" className="text-xs text-accent">Saved</span>}
            {state?.error && <span role="alert" className={`${errorClass} text-xs`}>{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
