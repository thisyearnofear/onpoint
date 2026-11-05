import { redirect } from "next/navigation";
import { LabModeClient } from "./LabModeClient";

const SLUG_TO_MODE: Record<string, string> = {
  "try-on": "try-on",
  stylist: "stylist",
  saved: "my-looks",
  settings: "settings",
};

export default async function LabModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (mode === "shop") redirect("/shop");
  if (mode === "dashboard") redirect("/lab/try-on");
  const mapped = SLUG_TO_MODE[mode];
  if (!mapped) redirect("/lab/try-on");
  return <LabModeClient initialMode={mapped} />;
}
