"use server";
export async function getDashboardStatsAction() { return { totalUsers: 0, totalPosts: 0, totalComments: 0 }; }
export async function getRecentUsersAction() { return []; }
export async function banUserAction(userId: string, reason: string) { return { success: true }; }
export async function updateUserRoleAction(userId: string, role: string) { return { success: true }; }
export async function getNewUserRegistrations() { return []; }
export async function getAllUsers() { return []; }
