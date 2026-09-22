import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRole = "candidate" | "employer" | "agency" | "admin";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}

export async function ensureProfile(userId:string, email?:string, metadata?:Record<string,unknown>) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id,role,full_name,email").eq("id",userId).maybeSingle();
  if (existing) return existing;
  const requested = metadata?.role;
  const role:AppRole = requested === "employer" || requested === "agency" ? requested : "candidate";
  const { data, error } = await admin.from("profiles").insert({
    id:userId,
    email:email ?? null,
    role,
    full_name:typeof metadata?.full_name==="string" ? metadata.full_name : null,
    skills:Array.isArray(metadata?.skills) ? metadata.skills : [],
    experience_years:typeof metadata?.experience_years==="number" ? metadata.experience_years : 0,
    country:typeof metadata?.country==="string" ? metadata.country : null,
  }).select("id,role,full_name,email").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function requireRole(roles:AppRole[]) {
  const user = await requireUser();
  const profile = await ensureProfile(user.id,user.email,user.user_metadata);
  if (!roles.includes(profile.role as AppRole)) throw new Error("FORBIDDEN");
  return { user, profile };
}
