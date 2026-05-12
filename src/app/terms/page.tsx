import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | HyperDrive AI",
  description: "Terms of Service for HyperDrive AI.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-24 px-6">
      <div className="max-w-3xl w-full">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-muted-foreground">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing or using the HyperDrive AI service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the service.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
          <p className="mb-4">
            HyperDrive AI provides an artificial intelligence-powered marketing infrastructure platform, including content generation, campaign management, and analytics features. You understand and agree that the service is provided "AS-IS".
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. User Accounts</h2>
          <p className="mb-4">
            When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our service.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Acceptable Use</h2>
          <p className="mb-4">
            You agree not to use the service to generate content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, libelous, or otherwise objectionable. We reserve the right to suspend or terminate accounts that violate this policy.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Intellectual Property</h2>
          <p className="mb-4">
            The Service and its original content, features, and functionality are and will remain the exclusive property of HyperDrive AI and its licensors. You retain all rights to any content you submit, post or display on or through the Service.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Limitation of Liability</h2>
          <p className="mb-4">
            In no event shall HyperDrive AI, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
          </p>
        </div>
      </div>
    </div>
  );
}
