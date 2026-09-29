import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { referralCodeSchema } from "./helpers";

const referralStatusSchema = z.enum(["pending", "completed"]);

export const betterAuthReferralSchema = {
  referralCode: {
    fields: {
      userId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
        unique: true,
      },

      code: {
        type: "string",
        required: true,
        unique: true,
        validator: {
          input: referralCodeSchema,
        },
      },

      createdAt: {
        type: "date",
        defaultValue: () => new Date(),
        required: true,
      },
    },
  },

  referrals: {
    fields: {
      referrerUserId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },

      referredUserId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
        unique: true,
      },

      referralCodeId: {
        type: "string",
        references: {
          model: "referralCode",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },

      status: {
        type: "string",
        defaultValue: "completed",
        required: true,
        validator: {
          input: referralStatusSchema,
        },
      },

      completedAt: {
        type: "date",
        required: false,
      },

      createdAt: {
        type: "date",
        defaultValue: () => new Date(),
        required: true,
      },
    },
  },

  referralStepCompletion: {
    fields: {
      referralId: {
        type: "string",
        references: {
          model: "referrals",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },

      step: {
        type: "string",
        required: true,
      },

      completionKey: {
        type: "string",
        required: true,
        unique: true,
      },

      metadata: {
        type: "json",
        required: false,
      },

      completedAt: {
        type: "date",
        defaultValue: () => new Date(),
        required: true,
      },
    },
  },
} satisfies NonNullable<BetterAuthPlugin["schema"]>;
