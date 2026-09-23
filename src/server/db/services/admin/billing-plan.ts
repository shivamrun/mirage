import {
  createBillingPlan,
  listBillingPlans,
  updateBillingPlan,
} from "@/server/db/dal/billing-plan";
import type {
  AdminBillingPlanMutationValues,
  AdminUpdateBillingPlanValues,
} from "@/shared/schemas";

type PostgresConstraintError = {
  code?: string;
  constraint_name?: string;
};

function getBillingPlanConflict(error: unknown) {
  const constraintError = error as PostgresConstraintError;

  if (constraintError.code !== "23505") {
    return null;
  }

  if (constraintError.constraint_name === "billing_plan_name_idx") {
    return {
      field: "name" as const,
      message: "A billing plan with this name already exists.",
    };
  }

  if (constraintError.constraint_name === "billing_plan_stripePriceId_idx") {
    return {
      field: "stripePriceId" as const,
      message: "A billing plan with this Stripe price ID already exists.",
    };
  }

  return {
    field: "unknown" as const,
    message: "A billing plan with these details already exists.",
  };
}

export async function listAdminBillingPlans() {
  return listBillingPlans();
}

export async function createAdminBillingPlan(
  values: AdminBillingPlanMutationValues,
) {
  try {
    const plan = await createBillingPlan(values);

    return plan
      ? {
          plan,
          status: "created" as const,
        }
      : {
          status: "failed" as const,
        };
  } catch (error) {
    const conflict = getBillingPlanConflict(error);

    if (conflict) {
      return {
        conflict,
        status: "conflict" as const,
      };
    }

    throw error;
  }
}

export async function updateAdminBillingPlan({
  id,
  values,
}: {
  id: string;
  values: AdminUpdateBillingPlanValues;
}) {
  try {
    const plan = await updateBillingPlan({ id, values });

    return plan
      ? {
          plan,
          status: "updated" as const,
        }
      : {
          status: "not-found" as const,
        };
  } catch (error) {
    const conflict = getBillingPlanConflict(error);

    if (conflict) {
      return {
        conflict,
        status: "conflict" as const,
      };
    }

    throw error;
  }
}
