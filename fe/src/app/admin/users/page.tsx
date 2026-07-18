import { getAllUsers } from "@/actions/admin.actions";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-2">
          View all registered users and their roles.
        </p>
      </div>

      <UsersClient initialData={users} />
    </div>
  );
}
