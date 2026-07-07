"use server"

import { cookies } from "next/headers"

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api"

export async function getConversationsAction(userId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || 
                cookieStore.get("authjs.session-token")?.value ||
                cookieStore.get("__Secure-authjs.session-token")?.value ||
                cookieStore.get("next-auth.session-token")?.value ||
                cookieStore.get("__Secure-next-auth.session-token")?.value
  
  if (!token) return []

  try {
    const res = await fetch(`${API_URL}/chat/conversations`, {
      headers: {
        "X-User-Id": userId,
        Cookie: `session=${token}; next-auth.session-token=${token}`
      },
      next: { revalidate: 0 }
    })
    
    if (!res.ok) return []
    const json = await res.json()
    return json.data || []
  } catch (error) {
    console.error("Failed to fetch conversations:", error)
    return []
  }
}

export async function getMessagesAction(conversationId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || 
                cookieStore.get("authjs.session-token")?.value ||
                cookieStore.get("__Secure-authjs.session-token")?.value ||
                cookieStore.get("next-auth.session-token")?.value ||
                cookieStore.get("__Secure-next-auth.session-token")?.value
  
  if (!token) return []

  try {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
      headers: {
        Cookie: `session=${token}; next-auth.session-token=${token}`
      },
      next: { revalidate: 0 }
    })
    
    if (!res.ok) return []
    const json = await res.json()
    return json.data || []
  } catch (error) {
    console.error("Failed to fetch messages:", error)
    return []
  }
}

export async function createConversationAction(senderId: string, receiverId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || 
                cookieStore.get("authjs.session-token")?.value ||
                cookieStore.get("__Secure-authjs.session-token")?.value ||
                cookieStore.get("next-auth.session-token")?.value || 
                cookieStore.get("__Secure-next-auth.session-token")?.value
  
  if (!token) return null

  try {
    const res = await fetch(`${API_URL}/chat/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": senderId,
        Cookie: `session=${token}; next-auth.session-token=${token}`
      },
      body: JSON.stringify({ receiverId }),
      cache: "no-store"
    })
    
    if (!res.ok) {
      return null
    }
    
    return await res.json().then(data => data.data)
  } catch (error) {
    console.error("createConversationAction error:", error)
    return null
  }
}

export async function getUnreadCountAction(userId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || 
                cookieStore.get("authjs.session-token")?.value ||
                cookieStore.get("__Secure-authjs.session-token")?.value ||
                cookieStore.get("next-auth.session-token")?.value || 
                cookieStore.get("__Secure-next-auth.session-token")?.value
  
  if (!token) return 0

  try {
    const res = await fetch(`${API_URL}/chat/unread-count`, {
      headers: {
        "X-User-Id": userId,
        Cookie: `session=${token}; next-auth.session-token=${token}`
      },
      cache: "no-store"
    })
    
    if (!res.ok) return 0
    const json = await res.json()
    return json.data?.count || 0
  } catch (error) {
    console.error("getUnreadCountAction error:", error)
    return 0
  }
}

export async function markConversationAsReadAction(conversationId: string, userId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || 
                cookieStore.get("authjs.session-token")?.value ||
                cookieStore.get("__Secure-authjs.session-token")?.value ||
                cookieStore.get("next-auth.session-token")?.value || 
                cookieStore.get("__Secure-next-auth.session-token")?.value
  
  if (!token) return false

  try {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/read`, {
      method: "PUT",
      headers: {
        "X-User-Id": userId,
        Cookie: `session=${token}; next-auth.session-token=${token}`
      }
    })
    
    return res.ok
  } catch (error) {
    console.error("markConversationAsReadAction error:", error)
    return false
  }
}
