"use server";

import { redirect } from "next/navigation";

import { adminUsersHrefFromFormData } from "./admin-users-query";

export async function applyAdminUsersListState(formData: FormData) {
  redirect(adminUsersHrefFromFormData(formData));
}
