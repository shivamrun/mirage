"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleDollarSign, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AuthInputField, AuthStatusMessage } from "@/features/auth/components";
import { api } from "@/shared/api/client";
import {
  type AdminCreditAdjustmentInput,
  type AdminCreditAdjustmentValues,
  adminCreditAdjustmentSchema,
} from "@/shared/schemas";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

export function AdminCreditAdjustmentDialog({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminCreditAdjustmentInput,
    undefined,
    AdminCreditAdjustmentValues
  >({
    resolver: zodResolver(adminCreditAdjustmentSchema),
    defaultValues: {
      amount: "" as unknown as number,
      reason: "",
      sourceId: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      amount: "" as unknown as number,
      reason: "",
      sourceId: "",
    });
    setStatus(undefined);
  }, [form, open]);

  async function onSubmit(values: AdminCreditAdjustmentValues) {
    setStatus(undefined);

    try {
      const { error } = await api.api.admin
        .users({ userId })
        .credits.adjust.post({
          amount: values.amount,
          idempotencyKey: crypto.randomUUID(),
          reason: values.reason,
          sourceId: values.sourceId,
        });

      if (error) {
        setStatus({
          text:
            (error.value as { message?: string })?.message ??
            "Credit adjustment failed.",
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      setStatus({
        text:
          error instanceof Error
            ? error.message
            : "Credit adjustment failed unexpectedly.",
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <CircleDollarSign data-icon="inline-start" />
          Adjust credits
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Adjust credits</AlertDialogTitle>
            <AlertDialogDescription>
              Add credits with a positive amount or debit credits with a
              negative amount.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <AuthInputField
                error={form.formState.errors.amount?.message}
                id="admin-credit-adjustment-amount"
                label="Amount"
                placeholder="10 or -10"
                required
                step={1}
                type="number"
                {...form.register("amount")}
              />

              <AuthInputField
                error={form.formState.errors.sourceId?.message}
                id="admin-credit-adjustment-source-id"
                label="Source ID"
                placeholder="Optional ticket, invoice, or note ID"
                {...form.register("sourceId")}
              />

              <Field data-invalid={Boolean(form.formState.errors.reason)}>
                <FieldLabel htmlFor="admin-credit-adjustment-reason">
                  Reason
                </FieldLabel>
                <Textarea
                  aria-invalid={
                    Boolean(form.formState.errors.reason) || undefined
                  }
                  id="admin-credit-adjustment-reason"
                  placeholder="Required audit note"
                  required
                  {...form.register("reason")}
                />
                {form.formState.errors.reason?.message ? (
                  <FieldError>
                    {form.formState.errors.reason.message}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save adjustment"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
