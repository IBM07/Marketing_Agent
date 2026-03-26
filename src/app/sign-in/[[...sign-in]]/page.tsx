import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="z-10 relative">
        <SignIn appearance={{
          variables: {
            colorPrimary: 'hsl(var(--primary))',
            colorBackground: 'var(--card)',
            colorText: 'var(--foreground)',
            colorTextSecondary: 'var(--muted)',
            colorInputBackground: 'var(--background)',
            colorInputText: 'var(--foreground)',
            colorDanger: 'hsl(var(--destructive, 0 100% 50%))',
            borderRadius: '0.5rem',
          },
          elements: {
            rootBox: "glass-effect rounded-xl overflow-hidden",
            card: "bg-transparent shadow-none border-none",
            headerTitle: "text-foreground text-2xl font-bold font-sans",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton: "bg-background border-card-border hover:bg-card-border text-foreground transition-all",
            socialButtonsBlockButtonText: "text-foreground font-medium",
            dividerLine: "bg-card-border",
            dividerText: "text-muted-foreground",
            formFieldLabel: "text-muted-foreground",
            formFieldInput: "bg-background border-card-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all",
            formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground transition-all py-2.5 font-semibold",
            footerActionText: "text-muted-foreground",
            footerActionLink: "text-primary hover:text-primary/80 transition-colors",
            identityPreviewText: "text-foreground",
            identityPreviewEditButtonIcon: "text-primary",
            formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground transition-colors",
            formFieldErrorText: "text-red-500",
          },
        }} />
      </div>
    </div>
  );
}
