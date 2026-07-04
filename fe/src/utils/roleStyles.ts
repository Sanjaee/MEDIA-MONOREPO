/**
 * Shared role badge and name CSS classes for consistent display
 * (owner, admin, mod, mvp, god, vip, member) - matches globals.css
 */

export function getRoleBadge(role?: string): string {
  switch (role) {
    case "owner":
      return "owner_badge text-[10px]";
    case "admin":
      return "admin_badge text-[10px]";
    case "mod":
      return "mod_badge text-[10px]";
    case "mvp":
      return "mvp_badge text-[10px]";
    case "god":
      return "god_badge text-[10px]";
    case "vip":
      return "vip_badge text-[10px]";
    case "member":
      return "member_badge text-[10px]";
    default:
      return "member_badge text-[10px]";
  }
}

export function getRoleNameClass(role?: string): string {
  switch (role) {
    case "owner":
      return "owner_name";
    case "admin":
      return "admin_name";
    case "mod":
      return "mod_name";
    case "mvp":
      return "mvp_name";
    case "god":
      return "god_name";
    case "vip":
      return "vip_name";
    case "member":
      return "member_name";
    default:
      return "member_name";
  }
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "god":
      return "God";
    case "mod":
      return "Moderator";
    case "vip":
      return "VIP Member";
    case "admin":
      return "Admin";
    case "mvp":
      return "MVP";
    default:
      return "Member";
  }
}
