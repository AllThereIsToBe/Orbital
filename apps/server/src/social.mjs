import { allFocusSessionsForUsers, fromJson, getFriendshipsForUser, getUserById } from "./db.mjs";

const windowStart = (windowName) => {
  const now = new Date();

  if (windowName === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  if (windowName === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() + diff);
    return date.getTime();
  }

  if (windowName === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  if (windowName === "year") {
    return new Date(now.getFullYear(), 0, 1).getTime();
  }

  return 0;
};

export const getFriendData = (userId) =>
  getFriendshipsForUser.all(userId, userId).map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    requester: { id: row.requester_user_id, username: row.requester_username },
    target: { id: row.target_user_id, username: row.target_username }
  }));

export const buildLeaderboard = (userId, windowName, tagId) => {
  const friendships = getFriendshipsForUser.all(userId, userId);
  const acceptedIds = new Set([userId]);

  for (const row of friendships) {
    if (row.status !== "accepted") {
      continue;
    }

    acceptedIds.add(row.requester_user_id === userId ? row.target_user_id : row.requester_user_id);
  }

  const ids = JSON.stringify([...acceptedIds]);
  const start = windowStart(windowName);
  const sessions = allFocusSessionsForUsers.all(ids)
    .map((row) => ({
      ...row,
      tagIds: fromJson(row.tag_ids_json, [])
    }))
    .filter((row) => new Date(row.start_at).getTime() >= start)
    .filter((row) => (tagId ? row.tagIds.includes(tagId) : true));

  const totals = new Map();

  for (const session of sessions) {
    totals.set(session.user_id, (totals.get(session.user_id) || 0) + session.duration_min);
  }

  return [...totals.entries()]
    .map(([participantId, minutes]) => ({
      userId: participantId,
      username: getUserById.get(participantId)?.username,
      minutes
    }))
    .sort((left, right) => right.minutes - left.minutes);
};
