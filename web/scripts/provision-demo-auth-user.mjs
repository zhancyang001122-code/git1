import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const secretKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  required("SUPABASE_SERVICE_ROLE_KEY");
const email = required("DEMO_AUTH_EMAIL").toLowerCase();
const password = required("DEMO_AUTH_PASSWORD");

if (!/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("DEMO_AUTH_EMAIL must be an email address");
}
if (password.length < 32) {
  throw new Error("DEMO_AUTH_PASSWORD must contain at least 32 characters");
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let existing;
for (let page = 1; page <= 20 && !existing; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw new Error(`Supabase listUsers failed (${error.status})`);
  existing = data.users.find((user) => user.email?.toLowerCase() === email);
  if (data.users.length < 100) break;
}

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { account_type: "portfolio_demo" },
  });
  if (error) throw new Error(`Supabase updateUser failed (${error.status})`);
  console.log("PASS isolated Supabase demo user updated.");
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: "portfolio_demo" },
  });
  if (error) throw new Error(`Supabase createUser failed (${error.status})`);
  console.log("PASS isolated Supabase demo user created.");
}
