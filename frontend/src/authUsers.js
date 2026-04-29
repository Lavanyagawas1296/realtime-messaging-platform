import { supabase } from "./supabase";

const unique = (values) => [...new Set((values || []).filter(Boolean))];

console.log("CALLING get_user_emails with:", validUserIds);

if (error) {
  console.error("RPC ERROR:", error);
}

// export async function fetchAuthUsersByIds(userIds) {
//   const validUserIds = unique(userIds);

//   console.log("RPC CALL -> get_user_emails", validUserIds);

//   if (validUserIds.length === 0) return new Map();

//   const { data, error } = await supabase.rpc("get_user_emails", {
//     user_ids: validUserIds,
//   });

//   if (error) {
//     console.error("RPC ERROR FULL:", error);
//     throw error;
//   }

//   return new Map(
//     (data || []).map((authUser) => [
//       authUser.id,
//       { id: authUser.id, email: authUser.email },
//     ])
//   );
// }

export function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export async function fetchAuthUsersByIds(userIds, supabase) {
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