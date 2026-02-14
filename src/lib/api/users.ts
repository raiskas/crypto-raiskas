import { createClient } from "@/lib/supabase/client";

interface UpdateUserData {
  nome?: string;
  email?: string;
}

export async function updateUser(userId: string, data: UpdateUserData) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from("usuarios")
    .update(data)
    .eq("id", userId);
    
  if (error) {
    throw new Error(error.message);
  }
} 