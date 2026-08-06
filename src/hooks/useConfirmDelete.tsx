import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmDeleteRequest {
  /** e.g. "Kaydı sil" — kept short, the record name goes in `description`. */
  title: string;
  /** Must name the specific record and, if any, how many linked records go with it. */
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

/**
 * Replaces window.confirm() for destructive delete actions (QA-B/C BUG-10) with the app's own
 * AlertDialog: the browser-native confirm() shows no record name, no linked-record count, and
 * looks/behaves differently per browser. `confirmDelete({ title, description, onConfirm })`
 * opens the dialog; render `dialog` once near the root of the page/component that calls it.
 * Cancelling sends no request; confirming sends exactly one and disables the action (and the
 * cancel button) until it settles, so a double-click can't fire two delete requests.
 */
export function useConfirmDelete() {
  const [request, setRequest] = useState<ConfirmDeleteRequest | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!request) return;
    setLoading(true);
    try {
      await request.onConfirm();
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }

  const dialog = (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !loading) setRequest(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title ?? "Kaydı sil"}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
          >
            {loading ? "Siliniyor..." : (request?.confirmLabel ?? "Sil")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmDelete: (req: ConfirmDeleteRequest) => setRequest(req), dialog };
}
