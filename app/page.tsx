import { redirect } from "next/navigation";

// Default landing → Pipeline (see brief §4.2 PIPE-1).
export default function Home() {
  redirect("/pipeline");
}
