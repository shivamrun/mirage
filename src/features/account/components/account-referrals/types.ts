type CopyStatus = "idle" | "copied" | "failed";

type ReferralDashboard = {
  code: string;
  stats: {
    completed: number;
    joinedToday: number;
    pending: number;
    total: number;
  };
};

type ReferralListItem = {
  id: string;
  status: "pending" | "completed";
  completedAt: Date | string | null;
  createdAt: Date | string;
  referredUser: {
    email: string;
    id: string;
    image: string | null;
    name: string;
  };
};

type ReferralList = {
  referrals: ReferralListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type { CopyStatus, ReferralDashboard, ReferralList, ReferralListItem };
