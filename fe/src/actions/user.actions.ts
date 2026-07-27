"use server";

const API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8080/api";

export async function getUserProfileByUsername(username: string) {
  try {
    const res = await fetch(`${API_URL}/users/profile/${username}`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function searchUsersAction(query: string) {
  try {
    const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
      cache: 'no-store'
    });
    if (!res.ok) return [];
    return await res.json();
	} catch (e) {
		return [];
	}
}

export async function getTopLarp() {
	try {
		const res = await fetch(`${API_URL}/users/top-larp`, {
			cache: 'no-store'
		});
		if (!res.ok) return [];
		const data = await res.json();
		return data.users || [];
	} catch (e) {
		return [];
	}
}
