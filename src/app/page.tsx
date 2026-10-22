import { redirect } from "next/navigation";

// El proxy envía "/" a /dashboard o /login según la sesión; esto es un respaldo.
export default function Home() {
  redirect("/dashboard");
}
