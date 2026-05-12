import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace Settings | HyperDrive AI",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
