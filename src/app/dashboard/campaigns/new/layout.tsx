import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deploy Agent | HyperDrive AI",
};

export default function NewCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
