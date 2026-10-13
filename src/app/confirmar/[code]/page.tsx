import { RsvpForm } from "@/components/RsvpForm";

export default async function GroupConfirmPage({ params }: PageProps<"/confirmar/[code]">) {
  const { code } = await params;
  return <RsvpForm code={code} />;
}