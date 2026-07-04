import type { Adapter, AdapterUser, AdapterAccount, AdapterSession } from "next-auth/adapters"

const API_URL = (process.env.BACKEND_API_URL || "http://api:8080/api") + "/auth/adapter"

export function GoAdapter(): Adapter {
  return {
    async createUser(user) {
      const res = await fetch(`${API_URL}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      })
      if (!res.ok) throw new Error("Failed to create user")
      return res.json()
    },
    async getUser(id) {
      const res = await fetch(`${API_URL}/user/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Failed to get user")
      return res.json()
    },
    async getUserByEmail(email) {
      const res = await fetch(`${API_URL}/user/email/${email}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Failed to get user by email")
      return res.json()
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const res = await fetch(`${API_URL}/user/account/${provider}/${providerAccountId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Failed to get user by account")
      return res.json()
    },
    async updateUser(user) {
      const res = await fetch(`${API_URL}/user/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      })
      if (!res.ok) throw new Error("Failed to update user")
      return res.json()
    },
    async linkAccount(account) {
      const res = await fetch(`${API_URL}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      })
      if (!res.ok) throw new Error("Failed to link account")
      return res.json()
    },
    async createSession(session) {
      const res = await fetch(`${API_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      })
      if (!res.ok) throw new Error("Failed to create session")
      const data = await res.json()
      return { ...data, expires: new Date(data.Expires || data.expires) }
    },
    async getSessionAndUser(sessionToken) {
      const res = await fetch(`${API_URL}/session/${sessionToken}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Failed to get session and user")
      
      const data = await res.json()
      if (!data.session || !data.user) return null
      
      return {
        session: { ...data.session, expires: new Date(data.session.Expires || data.session.expires) },
        user: data.user
      }
    },
    async updateSession(session) {
      const res = await fetch(`${API_URL}/session/${session.sessionToken}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      })
      if (!res.ok) throw new Error("Failed to update session")
      const data = await res.json()
      return { ...data, expires: new Date(data.Expires || data.expires) }
    },
    async deleteSession(sessionToken) {
      const res = await fetch(`${API_URL}/session/${sessionToken}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete session")
      return res.json()
    }
  }
}
