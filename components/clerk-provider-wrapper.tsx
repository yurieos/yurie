'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        variables: {
          colorPrimary: '#fafafa',
          colorDanger: '#ef4444',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorBackground: '#18181b',
          colorInputBackground: '#27272a',
          colorInputText: '#fafafa',
          colorText: '#fafafa',
          colorTextOnPrimaryBackground: '#18181b',
          colorTextSecondary: '#a1a1aa',
          borderRadius: '0.625rem',
          colorNeutral: '#a1a1aa',
          spacingUnit: '1rem',
          fontFamily: 'inherit',
        },
        elements: {
          // Root & Card
          rootBox: 'font-sans',
          card: 'bg-[#18181b] border-0 shadow-none',
          
          // Modal
          modalBackdrop: 'bg-black/80',
          modalContent: 'bg-[#18181b] border border-[#27272a] rounded-xl',
          modalCloseButton: 'text-[#a1a1aa] hover:text-[#fafafa] rounded-md p-1 transition-colors',
          
          // Headers
          headerTitle: 'text-[#fafafa] text-lg font-medium',
          headerSubtitle: 'text-[#a1a1aa] text-sm',
          
          // Navbar - clean
          navbar: 'bg-[#18181b] border-0',
          navbarButton: 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] rounded-md mx-1 px-3 py-2 text-sm transition-colors',
          navbarButtonIcon: 'text-[#a1a1aa] w-4 h-4',
          navbarButtons: 'gap-0.5',
          'navbarButton__active': 'bg-[#27272a] text-[#fafafa]',
          'navbarButtonIcon__active': 'text-[#fafafa]',
          
          // Page
          pageScrollBox: 'bg-[#18181b] px-6 py-5',
          page: 'bg-[#18181b]',
          profilePage: 'bg-[#18181b]',
          
          // Sections - NO dividers
          profileSection: 'border-0 pb-4 mb-2',
          profileSectionTitle: 'text-[#a1a1aa] text-xs uppercase tracking-wider font-medium mb-3',
          profileSectionTitleText: 'text-[#a1a1aa]',
          profileSectionContent: 'space-y-1',
          profileSectionPrimaryButton: 'text-[#fafafa] hover:text-[#e4e4e7] text-sm transition-colors',
          
          // Forms
          formButtonPrimary: 'bg-[#fafafa] hover:bg-[#e4e4e7] text-[#18181b] font-medium rounded-md h-9 px-4 text-sm transition-colors',
          formButtonReset: 'text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors',
          formFieldInput: 'bg-[#27272a] border-0 text-[#fafafa] placeholder:text-[#71717a] rounded-md h-10 px-3 text-sm focus:ring-1 focus:ring-[#52525b]',
          formFieldLabel: 'text-[#a1a1aa] text-sm mb-1',
          formFieldAction: 'text-[#fafafa] hover:text-[#e4e4e7] text-sm transition-colors',
          formFieldInputShowPasswordButton: 'text-[#a1a1aa] hover:text-[#fafafa]',
          formFieldSuccessText: 'text-[#22c55e] text-sm',
          formFieldErrorText: 'text-[#ef4444] text-sm',
          formResendCodeLink: 'text-[#fafafa] hover:text-[#e4e4e7] text-sm',
          
          // Buttons
          button: 'transition-colors',
          buttonArrowIcon: 'text-[#a1a1aa]',
          
          // Menus
          menuButton: 'text-[#a1a1aa] hover:text-[#fafafa] rounded-md p-1 transition-colors',
          menuList: 'bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-lg py-1',
          menuItem: 'text-[#fafafa] hover:bg-[#3f3f46] px-3 py-2 text-sm transition-colors',
          
          // Social
          socialButtonsBlockButton: 'bg-[#27272a] hover:bg-[#3f3f46] border-0 text-[#fafafa] rounded-md h-10 transition-colors',
          socialButtonsBlockButtonText: 'text-[#fafafa] text-sm',
          socialButtonsProviderIcon: 'w-4 h-4',
          
          // Dividers - subtle
          dividerLine: 'bg-[#3f3f46]',
          dividerText: 'text-[#71717a] text-xs',
          
          // User popover
          userButtonPopoverCard: 'bg-[#18181b] border border-[#27272a] shadow-lg rounded-lg',
          userButtonPopoverMain: 'bg-[#18181b] p-3',
          userButtonPopoverActions: 'border-t border-[#27272a] p-1',
          userButtonPopoverActionButton: 'text-[#fafafa] hover:bg-[#27272a] rounded-md transition-colors',
          userButtonPopoverActionButtonText: 'text-[#fafafa] text-sm',
          userButtonPopoverActionButtonIcon: 'text-[#a1a1aa] w-4 h-4',
          userButtonPopoverFooter: 'hidden',
          userPreviewMainIdentifier: 'text-[#fafafa] font-medium text-sm',
          userPreviewSecondaryIdentifier: 'text-[#a1a1aa] text-xs',
          
          // Avatar
          avatarBox: 'rounded-full',
          avatarImage: 'rounded-full',
          
          // Badges
          badge: 'bg-[#27272a] text-[#a1a1aa] border-0 rounded px-2 py-0.5 text-xs',
          tagInputContainer: 'bg-[#27272a] border-0 rounded-md',
          tagPillContainer: 'bg-[#27272a] text-[#a1a1aa] rounded',
          
          // Alerts
          alert: 'bg-[#27272a] border-0 rounded-md p-3',
          alertText: 'text-[#fafafa] text-sm',
          
          // Identity
          identityPreview: 'bg-transparent p-0',
          identityPreviewText: 'text-[#fafafa] text-sm',
          identityPreviewEditButton: 'text-[#fafafa] hover:text-[#e4e4e7] text-sm transition-colors',
          identityPreviewEditButtonIcon: 'text-[#fafafa] w-3.5 h-3.5',
          
          // Footer
          footer: 'border-0 bg-[#18181b] py-3',
          footerAction: 'text-[#a1a1aa]',
          footerActionLink: 'text-[#fafafa] hover:text-[#e4e4e7] text-sm transition-colors',
          footerActionText: 'text-[#a1a1aa] text-sm',
          footerPages: 'hidden',
          
          // Misc
          scrollBox: 'scrollbar-none',
          phoneInputBox: 'bg-[#27272a] border-0 rounded-md',
          tableHead: 'text-[#a1a1aa] text-xs border-0',
          breadcrumbs: 'text-[#a1a1aa]',
          breadcrumbsItem: 'text-[#a1a1aa] hover:text-[#fafafa] text-sm',
          breadcrumbsItemDivider: 'text-[#3f3f46]',
          selectButton: 'bg-[#27272a] border-0 text-[#fafafa] rounded-md h-10',
          selectButtonIcon: 'text-[#a1a1aa]',
          selectOptionsContainer: 'bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-lg',
          selectOption: 'text-[#fafafa] hover:bg-[#3f3f46] px-3 py-2 text-sm',
          otpCodeFieldInput: 'bg-[#27272a] border-0 text-[#fafafa] rounded-md w-10 h-11 text-center text-lg focus:ring-1 focus:ring-[#52525b]',
          accordionTriggerButton: 'text-[#fafafa] hover:bg-[#27272a] rounded-md p-2 transition-colors',
          accordionContent: 'bg-[#27272a] rounded-md p-3 mt-1',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
