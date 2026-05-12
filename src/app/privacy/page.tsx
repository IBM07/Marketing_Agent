import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | HyperDrive AI",
  description: "Privacy policy for HyperDrive AI.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-24 px-6">
      <div className="max-w-3xl w-full">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none text-muted-foreground">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Information We Collect</h2>
          <p className="mb-4">
            We collect information you provide directly to us, such as when you create or modify your account, use our services, or communicate with us. This includes names, emails, and any data input into our AI generation tools.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. How We Use Information</h2>
          <p className="mb-4">
            We use the information we collect to provide, maintain, and improve our services, to develop new ones, and to protect HyperDrive AI and our users. We also use this information to offer you tailored content, such as more relevant AI outputs.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Information Sharing</h2>
          <p className="mb-4">
            We do not share your personal information with companies, organizations, or individuals outside of HyperDrive AI except in the following cases: with your consent, for external processing, or for legal reasons.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Data Security</h2>
          <p className="mb-4">
            We work hard to protect our users from unauthorized access to or unauthorized alteration, disclosure, or destruction of information we hold. In particular, we encrypt many of our services using SSL and encrypt passwords in transit and at rest.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Your Choices</h2>
          <p className="mb-4">
            You may update, correct, or delete your account information at any time by logging into your online account. You can also contact us to request access to, correction, or deletion of any personal information that you have provided to us.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Changes</h2>
          <p className="mb-4">
            We may change this Privacy Policy from time to time. We will not reduce your rights under this Privacy Policy without your explicit consent. We always indicate the date the last changes were published.
          </p>
        </div>
      </div>
    </div>
  );
}
