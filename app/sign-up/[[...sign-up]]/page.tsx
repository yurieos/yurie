import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <SignUp 
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "bg-card border border-border rounded-xl",
              headerTitle: "text-foreground text-lg font-medium",
              headerSubtitle: "text-muted-foreground text-sm",
              socialButtonsBlockButton: "bg-muted hover:bg-accent border-0 text-foreground rounded-lg h-10 text-sm transition-colors",
              socialButtonsBlockButtonText: "text-foreground text-sm",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg h-10 text-sm transition-colors",
              footerActionLink: "text-primary hover:text-primary/80 text-sm transition-colors",
              formFieldInput: "bg-muted border-0 text-foreground placeholder:text-muted-foreground rounded-lg h-10 text-sm focus:ring-1 focus:ring-primary",
              formFieldLabel: "text-muted-foreground text-sm",
              identityPreviewEditButton: "text-primary hover:text-primary/80 text-sm",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground text-xs",
              footer: "border-0",
              footerAction: "text-muted-foreground text-sm",
            }
          }}
        />
      </div>
    </div>
  )
}

