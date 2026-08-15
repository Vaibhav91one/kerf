'use client';

// One confirmation for every irreversible action. Unpublishing is a delete, and
// a delete that happens on a single click with no way back is the kind of thing
// people only notice afterwards.
//
// It owns the pending state itself: `onConfirm` may return a promise, the
// button spins while it settles, and the dialog closes only on success — so a
// failed delete leaves the dialog open with the error visible rather than
// silently dismissing.

import { useState, type ReactElement, type ReactNode } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/kerf/spinner';

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: {
  /** A single element — Base UI's `render` clones it, so a fragment or null will not do. */
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never yank the dialog out from under an in-flight request.
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="px-4 text-[14px] text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            }
          />
          <Button variant={destructive ? 'destructive' : 'default'} onClick={confirm} disabled={pending}>
            {pending && <Spinner className="mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
