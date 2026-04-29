import { supabase } from "./supabase";

export function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export async function fetchAuthUsersByIds(userIds) {
  const validUserIds = unique(userIds);

  console.log("RPC CALL -> get_user_emails", validUserIds);

  if (validUserIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("get_user_emails", {
    user_ids: validUserIds,
  });

  if (error) {
    console.error("RPC ERROR:", error);
    throw error;
  }

  return new Map(
    (data || []).map((user) => [
      user.id,
      { id: user.id, email: user.email },
    ])
  );
}