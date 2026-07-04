"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { count, sql } from "drizzle-orm";

import { auth } from "@/auth";

export async function getNewUserRegistrations() {
  try {
    const stats = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${users.createdAt})`,
        users: count(users.id),
      })
      .from(users)
      .where(sql`${users.createdAt} >= NOW() - INTERVAL '90 days'`)
      .groupBy(sql`1`)
      .orderBy(sql`1`);
      
    const dataMap = new Map();
    for (const s of stats) {
       dataMap.set(new Date(s.date).toISOString().split('T')[0], Number(s.users));
    }

    const last90Days = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
       const d = new Date(today);
       d.setDate(d.getDate() - i);
       const dateStr = d.toISOString().split('T')[0];
       last90Days.push({
         date: dateStr,
         users: dataMap.get(dateStr) || 0
       });
    }

    return last90Days;
  } catch (error) {
    console.error("Failed to fetch user registration stats:", error);
    return [];
  }
}

export async function getAllUsers() {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== "owner") {
      throw new Error("Unauthorized");
    }

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        image: users.image,
        role: users.role,
        isVerified: users.isVerified,
        isBanned: users.isBanned,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(sql`${users.createdAt} DESC`);

    return allUsers.map(u => ({
      ...u,
      createdAt: u.createdAt?.toISOString(),
    }));
  } catch (error) {
    console.error("Failed to fetch all users:", error);
    return [];
  }
}
